// Large dataset for performance work: 1 school, 2 academic years, 24 classes × 50 children, ~200 school days of
// attendance per year, syllabus, marks, diary. Built with set-based SQL so it loads in seconds.
// Usage: NODE_ENV=development npm run db:seed:perf   (wipes the target database, like db:seed)
const m = require('../src/db/models');
const { hashPassword } = require('../src/modules/auth/auth.service');
const { todayIn } = require('../src/utils/dates');

const CLASSES = 24;
const PER_CLASS = 50;

async function run() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to wipe a production database');
  const q = (sql, replacements) => m.sequelize.query(sql, { replacements });
  await q('TRUNCATE organizations RESTART IDENTITY CASCADE');
  const pw = await hashPassword('password123');
  const today = todayIn('Asia/Kolkata');
  const y = Number(today.slice(0, 4));
  const startCur = Number(today.slice(5, 7)) >= 6 ? `${y}-06-01` : `${y - 1}-06-01`;
  const startPrev = `${Number(startCur.slice(0, 4)) - 1}-06-01`;

  await q(`INSERT INTO organizations (name) VALUES ('Perf Trust')`);
  await q(`INSERT INTO schools (organization_id, name, gr_prefix, next_gr_number) VALUES (1, 'Perf School', 'P-', ${CLASSES * PER_CLASS + 1})`);
  await q(
    `INSERT INTO users (organization_id, name, email, password_hash, must_change_password) VALUES
           (1, 'Perf Owner', 'owner@perf.test', :pw, false), (1, 'Perf Teacher', 'teacher@perf.test', :pw, false)`,
    { pw },
  );
  await q(`INSERT INTO user_schools (user_id, school_id, role, is_default) VALUES (1, 1, 'owner', true), (2, 1, 'teacher', true)`);
  await q(
    `INSERT INTO academic_years (school_id, name, start_date, end_date, status) VALUES
           (1, 'Previous', :p, (:p)::date + 333, 'closed'), (1, 'Current', :c, (:c)::date + 333, 'active')`,
    { p: startPrev, c: startCur },
  );
  await q(`INSERT INTO grades (school_id, name, sort_order) SELECT 1, 'Grade ' || g, g FROM generate_series(1, ${CLASSES / 2}) g`);
  // Each grade promotes to the next; the last one is final (so the rollover benchmark promotes and graduates).
  await q(`UPDATE grades g SET next_grade_id = n.id FROM grades n WHERE n.sort_order = g.sort_order + 1`);
  await q(`UPDATE grades SET is_final = true WHERE next_grade_id IS NULL`);
  // Two sections per grade, in both years
  await q(`INSERT INTO class_sections (school_id, academic_year_id, grade_id, name, sort_order)
           SELECT 1, y, g, 'Grade ' || g || ' ' || s, so FROM generate_series(1, 2) y, generate_series(1, ${CLASSES / 2}) g,
             unnest(ARRAY['A','B']) WITH ORDINALITY AS t(s, so)`);
  await q(`INSERT INTO subjects (school_id, academic_year_id, class_section_id, name, sort_order)
           SELECT 1, cs.academic_year_id, cs.id, sub, i FROM class_sections cs, unnest(ARRAY['Marathi','English','Maths','EVS']) WITH ORDINALITY AS t(sub, i)`);
  await q(`INSERT INTO teacher_assignments (school_id, academic_year_id, user_id, class_section_id, role)
           SELECT 1, 2, 2, id, 'class_teacher' FROM class_sections WHERE academic_year_id = 2 ORDER BY id LIMIT 2`);
  await q(`INSERT INTO chapters (school_id, subject_id, name, sort_order) SELECT 1, sb.id, 'Chapter ' || c, c FROM subjects sb, generate_series(1, 5) c`);
  await q(`INSERT INTO topics (school_id, chapter_id, content, sort_order) SELECT 1, ch.id, 'Topic ' || t, t FROM chapters ch, generate_series(1, 4) t`);
  await q(
    `INSERT INTO topic_completions (school_id, topic_id, completed_by, completed_on)
           SELECT 1, id, 2, :c FROM topics WHERE id % 3 = 0`,
    { c: startCur },
  );
  // Children with guardians, photo keys left empty (photos are measured separately)
  await q(
    `INSERT INTO students (school_id, gr_number, name, gender, dob, guardian_name, guardian_phone, guardian_language, admission_date)
           SELECT 1, 'P-' || n, 'Child ' || n || ' ' || (ARRAY['Pawar','Shinde','More','Jadhav','Patil'])[1 + n % 5],
                  (ARRAY['F','M'])[1 + n % 2], DATE '2016-01-01' + (n % 1500), 'Parent ' || n, '98' || lpad(n::text, 8, '0'),
                  (ARRAY['mr','hi','gu'])[1 + n % 3], :p
           FROM generate_series(1, ${CLASSES * PER_CLASS}) n`,
    { p: startPrev },
  );
  // Same children in both years (promoted), section by n
  await q(`INSERT INTO enrollments (school_id, academic_year_id, student_id, class_section_id, roll_number, status, enrolled_on)
           SELECT 1, y.id, s.id, cs.id, 1 + (s.id - 1) % ${PER_CLASS}, CASE WHEN y.status = 'active' THEN 'active' ELSE 'promoted' END, y.start_date
           FROM students s CROSS JOIN academic_years y
           JOIN class_sections cs ON cs.academic_year_id = y.id AND cs.sort_order = 1 + ((s.id - 1) / ${PER_CLASS}) % 2
             AND cs.grade_id = 1 + ((s.id - 1) / (2 * ${PER_CLASS})) % ${CLASSES / 2}`);
  // Attendance: every non-Sunday from year start until today (or year end), ~8% absent
  await q(
    `INSERT INTO attendance (school_id, academic_year_id, enrollment_id, student_id, class_section_id, date, status, marked_by)
           SELECT 1, e.academic_year_id, e.id, e.student_id, e.class_section_id, d::date,
                  CASE WHEN (e.student_id * 7 + extract(doy FROM d)::int) % 13 = 0 THEN 'A' ELSE 'P' END, 2
           FROM enrollments e JOIN academic_years y ON y.id = e.academic_year_id,
                generate_series(y.start_date, LEAST(y.end_date, :t::date), interval '1 day') d
           WHERE extract(dow FROM d) <> 0`,
    { t: today },
  );
  await q(`INSERT INTO attendance_sessions (school_id, academic_year_id, class_section_id, date, submitted_by, present_count, absent_count)
           SELECT 1, academic_year_id, class_section_id, date, 2, count(*) FILTER (WHERE status = 'P'), count(*) FILTER (WHERE status = 'A')
           FROM attendance GROUP BY 1, 2, 3, 4`);
  await q(`INSERT INTO report_entries (school_id, academic_year_id, enrollment_id, subject_id, term, marks, max_marks, entered_by)
           SELECT 1, e.academic_year_id, e.id, sb.id, 'S1', (e.student_id * 13 + sb.id) % 50, 50, 2
           FROM enrollments e JOIN subjects sb ON sb.class_section_id = e.class_section_id`);
  await q(`INSERT INTO daily_logs (school_id, academic_year_id, enrollment_id, student_id, date, note, created_by)
           SELECT 1, e.academic_year_id, e.id, e.student_id, y.start_date + (k * 7), 'Note ' || k, 2
           FROM enrollments e JOIN academic_years y ON y.id = e.academic_year_id, generate_series(0, 20) k`);
  await q('ANALYZE');
  const [[c]] = await q(`SELECT (SELECT count(*) FROM students) s, (SELECT count(*) FROM attendance) a, (SELECT count(*) FROM report_entries) r`);
  console.log(`Perf data: ${c.s} children, ${c.a} attendance rows, ${c.r} marks. Logins owner@perf.test / teacher@perf.test, password123`);
  await m.sequelize.close();
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
