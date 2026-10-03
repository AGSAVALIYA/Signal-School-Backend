const router = require('express').Router();
const { Op, QueryTypes } = require('sequelize');
const { z } = require('zod');
const validate = require('../../middlewares/validate');
const { requirePerm, yearScope } = require('../../middlewares/auth');
const { cacheResponse } = require('../../utils/cache');
const m = require('../../db/models');
const attendance = require('../attendance/attendance.service');
const { todayIn, addDays } = require('../../utils/dates');
const { page } = require('../../utils/http');
const { isStaff } = require('../../utils/scope');

const AUDIT_AREAS = [
  'attendance',
  'student',
  'syllabus',
  'marks',
  'diary',
  'health',
  'user',
  'assignment',
  'year',
  'school',
  'organization',
  'section',
  'subject',
  'grade',
  'holiday',
];

const q = (sql, replacements) => m.sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

// Principal's dashboard: setup checklist, today's attendance, trends, syllabus and at-risk students.
router.get('/dashboard', requirePerm('reports.view'), yearScope({ required: false }), cacheResponse('dashboard'), async (req, res) => {
  const s = req.school.id;
  const y = req.year?.id ?? 0;
  const date = todayIn(req.school.timezone);
  const [[counts], trend, atRisk, syllabus, birthdays, consecutiveAbsences] = await Promise.all([
    q(
      `SELECT (SELECT count(*) FROM enrollments WHERE academic_year_id = :y AND status = 'active')::int AS students,
              (SELECT count(*) FROM user_schools us JOIN users u ON u.id = us.user_id AND u.status = 'active' WHERE us.school_id = :s AND us.role = 'teacher')::int AS teachers,
              (SELECT count(*) FROM class_sections WHERE academic_year_id = :y)::int AS sections,
              (SELECT count(*) FROM subjects WHERE academic_year_id = :y)::int AS subjects,
              (SELECT count(*) FROM grades WHERE school_id = :s)::int AS grades,
              (SELECT count(*) FROM (SELECT DISTINCT ON (h.student_id) h.needs_follow_up FROM health_checks h JOIN students st ON st.id = h.student_id
                 WHERE h.school_id = :s AND st.status = 'active' ORDER BY h.student_id, h.checked_on DESC, h.id DESC) x WHERE x.needs_follow_up)::int AS "healthFollowUps"`,
      { s, y },
    ),
    q(
      `SELECT date, sum(present_count + late_count)::int AS present, sum(present_count + late_count + absent_count + leave_count)::int AS marked
       FROM attendance_sessions WHERE school_id = :s AND academic_year_id = :y AND date > :from GROUP BY date ORDER BY date`,
      { s, y, from: addDays(date, -14) },
    ),
    q(
      `SELECT st.id, st.name, cs.name AS "sectionName", st.guardian_phone AS "guardianPhone", st.guardian_language AS "guardianLanguage",
              round(100.0 * count(*) FILTER (WHERE a.status IN ('P','LATE')) / count(*))::int AS percent, count(*)::int AS marked
       FROM attendance a JOIN students st ON st.id = a.student_id JOIN class_sections cs ON cs.id = a.class_section_id
       WHERE a.school_id = :s AND a.academic_year_id = :y AND a.date > :from AND st.status = 'active'
       GROUP BY st.id, cs.name HAVING count(*) >= 5 AND 100.0 * count(*) FILTER (WHERE a.status IN ('P','LATE')) / count(*) < 75
       ORDER BY percent ASC LIMIT 50`,
      { s, y, from: addDays(date, -30) },
    ),
    q(
      `SELECT cs.id AS "sectionId", cs.name AS "sectionName", count(t.id)::int AS total, count(tc.id)::int AS done
       FROM class_sections cs JOIN grades g ON g.id = cs.grade_id LEFT JOIN subjects sb ON sb.class_section_id = cs.id
       LEFT JOIN chapters c ON c.subject_id = sb.id LEFT JOIN topics t ON t.chapter_id = c.id LEFT JOIN topic_completions tc ON tc.topic_id = t.id
       WHERE cs.academic_year_id = :y GROUP BY cs.id, g.sort_order ORDER BY g.sort_order, cs.sort_order, cs.name`,
      { y },
    ),
    q(
      `SELECT st.id, st.name, cs.name AS "sectionName" FROM students st
       JOIN enrollments e ON e.student_id = st.id AND e.academic_year_id = :y AND e.status = 'active' JOIN class_sections cs ON cs.id = e.class_section_id
       WHERE st.school_id = :s AND st.dob IS NOT NULL AND to_char(st.dob, 'MM-DD') = :md ORDER BY st.name`,
      { s, y, md: date.slice(5) },
    ),
    // Absent on each of the latest marked days (holidays are never marked, so they don't break a streak).
    q(
      `WITH candidates AS (
         -- Only children absent at least once in the last week can be on a streak (partial index on absences).
         SELECT DISTINCT student_id FROM attendance WHERE school_id = :s AND status = 'A' AND date > :recent AND date <= :date
       ), streaks AS (
         -- Per child, via the (student_id, date) index: the last day marked anything but absent, then the absences after it.
         SELECT c.student_id, k.days, k.since FROM candidates c
         LEFT JOIN LATERAL (
           SELECT date AS ok FROM attendance WHERE student_id = c.student_id AND date <= :date AND status <> 'A' ORDER BY date DESC LIMIT 1
         ) last_ok ON true
         CROSS JOIN LATERAL (
           SELECT count(*)::int AS days, min(date) AS since FROM attendance
           WHERE student_id = c.student_id AND academic_year_id = :y AND status = 'A' AND date <= :date AND date > coalesce(last_ok.ok, :from)
         ) k
         WHERE k.days >= :min
       )
       SELECT st.id, st.name, cs.name AS "sectionName", k.days, k.since,
              st.guardian_phone AS "guardianPhone", st.guardian_language AS "guardianLanguage"
       FROM streaks k JOIN students st ON st.id = k.student_id AND st.status = 'active'
       JOIN enrollments e ON e.student_id = st.id AND e.academic_year_id = :y AND e.status = 'active'
       JOIN class_sections cs ON cs.id = e.class_section_id
       ORDER BY k.days DESC, st.name LIMIT 50`,
      { s, y, date, from: addDays(date, -60), recent: addDays(date, -7), min: 3 },
    ),
  ]);
  res.json({
    data: {
      year: req.year ? { id: req.year.id, name: req.year.name, status: req.year.status, endDate: req.year.endDate } : null,
      counts,
      setup: {
        year: Boolean(req.year),
        grades: counts.grades > 0,
        sections: counts.sections > 0,
        subjects: counts.subjects > 0,
        teachers: counts.teachers > 0,
        students: counts.students > 0,
      },
      today: req.year ? await attendance.today(req, y) : null,
      trend,
      atRisk,
      syllabus: syllabus.map((r) => ({ ...r, percent: r.total ? Math.round((100 * r.done) / r.total) : 0 })),
      birthdays,
      consecutiveAbsences,
    },
  });
});

// Teacher home: my sections with today's attendance status and my subjects with progress.
router.get('/today', yearScope({ required: false }), cacheResponse('today', { perUser: true }), async (req, res) => {
  if (!req.year) return res.json({ data: { year: null, sections: [], subjects: [], holiday: null } });
  const date = todayIn(req.school.timezone);
  const mine = !isStaff(req);
  const sections = await q(
    `SELECT cs.id, cs.name, bool_or(ta.role = 'class_teacher') AS "isClassTeacher",
            s.present_count + s.late_count AS present, s.absent_count AS absent, s.submitted_at AS "submittedAt",
            (SELECT count(*) FROM enrollments e WHERE e.class_section_id = cs.id AND e.status = 'active')::int AS strength
     FROM class_sections cs JOIN grades g ON g.id = cs.grade_id
     LEFT JOIN teacher_assignments ta ON ta.class_section_id = cs.id AND ta.user_id = :u
     LEFT JOIN attendance_sessions s ON s.class_section_id = cs.id AND s.date = :date
     WHERE cs.academic_year_id = :y ${mine ? 'AND ta.id IS NOT NULL' : ''}
     GROUP BY cs.id, s.id, g.sort_order ORDER BY bool_or(ta.role = 'class_teacher') DESC NULLS LAST, g.sort_order, cs.sort_order, cs.name`,
    { u: req.user.id, date, y: req.year.id },
  );
  const subjects = await q(
    `SELECT sb.id, sb.name, cs.id AS "sectionId", cs.name AS "sectionName", count(t.id)::int AS total, count(tc.id)::int AS done
     FROM subjects sb JOIN class_sections cs ON cs.id = sb.class_section_id
     JOIN teacher_assignments ta ON ta.class_section_id = cs.id AND ta.user_id = :u AND (ta.subject_id = sb.id OR ta.role = 'class_teacher')
     LEFT JOIN chapters c ON c.subject_id = sb.id LEFT JOIN topics t ON t.chapter_id = c.id LEFT JOIN topic_completions tc ON tc.topic_id = t.id
     WHERE sb.academic_year_id = :y GROUP BY sb.id, cs.id ORDER BY cs.name, sb.sort_order, sb.name`,
    { u: req.user.id, y: req.year.id },
  );
  res.json({
    data: {
      date,
      year: { id: req.year.id, name: req.year.name, status: req.year.status },
      holiday: await attendance.holidayOn(req.school, date),
      sections,
      subjects: subjects.map((r) => ({ ...r, percent: r.total ? Math.round((100 * r.done) / r.total) : 0 })),
    },
  });
});

router.get(
  '/audit',
  requirePerm('audit.view'),
  validate({
    query: z.object({
      userId: z.coerce.number().optional(),
      entityType: z.string().optional(),
      action: z.string().optional(),
      // Comma list of action prefixes, e.g. "attendance,student" (see AUDIT_AREAS).
      areas: z
        .string()
        .optional()
        .transform((v) => (v ? v.split(',').filter((a) => AUDIT_AREAS.includes(a)) : [])),
      page: z.coerce.number().optional(),
      pageSize: z.coerce.number().optional(),
    }),
  }),
  async (req, res) => {
    const { limit, offset } = page(req.v.query);
    const { userId, entityType, action, areas } = req.v.query;
    const where = { schoolId: req.school.id, ...(userId ? { userId } : {}), ...(entityType ? { entityType } : {}), ...(action ? { action } : {}) };
    if (areas.length) where[Op.and] = [{ [Op.or]: areas.map((a) => ({ action: { [Op.like]: `${a}.%` } })) }];
    const { rows, count } = await m.AuditLog.findAndCountAll({
      where,
      include: [{ model: m.User, attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    res.json({ data: rows, meta: { total: count } });
  },
);

module.exports = router;
