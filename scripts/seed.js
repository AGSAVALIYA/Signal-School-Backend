// Demo data that looks like a working Signal Shala: two schools, three academic years with promotions, children who
// joined, moved away or finished school, daily attendance, syllabus progress, marks, health check-ups, diary notes,
// activity groups, holidays and an activity log. Children and teachers get drawn faces (never real photos).
// DESTROYS all existing data in the target database. Deterministic: the same date gives the same data.
//
// Usage: npm run db:seed            (refuses NODE_ENV=production unless --force)
//        npm run db:seed -- --school-day   today is a school day even on a Sunday (no weekly holiday; for screenshots)
// Logins (password "password123"): owner@demo.test, principal@demo.test, clerk@demo.test, sunita@demo.test (class
// teacher Std 1 A), rahul@demo.test (Maths and English, Std 5–7), imran@demo.test (Nerul).
const { QueryTypes } = require('sequelize');
const m = require('../src/db/models');
const { hashPassword } = require('../src/modules/auth/auth.service');
const storage = require('../src/utils/storage');
const { todayIn, addDays } = require('../src/utils/dates');
const avatars = require('./demo/avatars');
const C = require('./demo/content');

// Deterministic random numbers (no Math.random: reruns give the same school).
let state = 20240615;
const rand = () => {
  state = (state * 1664525 + 1013904223) >>> 0;
  return state / 2 ** 32;
};
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
const chance = (p) => rand() < p;
const iso = (d) => d.toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const q = (sql, replacements, type = QueryTypes.SELECT) => m.sequelize.query(sql, { replacements, type });

const TZ = 'Asia/Kolkata';
const SCHOOL_DAY = process.argv.includes('--school-day');
const today = todayIn(TZ);
const yesterday = addDays(today, -1);
const startYear = Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 6 ? 1 : 0);

const GRADE_NAMES = ['Balwadi', 'Std 1', 'Std 2', 'Std 3', 'Std 4', 'Std 5', 'Std 6', 'Std 7'];
const gradeTranslations = (name) => {
  if (name === 'Balwadi') return { mr: 'बालवाडी', hi: 'बालवाड़ी', gu: 'બાલવાડી' };
  const n = name.split(' ')[1];
  return { mr: `इयत्ता ${n}`, hi: `कक्षा ${n}`, gu: `ધોરણ ${n}` };
};

async function photo(kind, seed, gender, folder) {
  const buf = await (kind === 'child' ? avatars.child(seed, gender) : avatars.adult(seed, gender));
  return storage.saveImage(buf, folder, { thumb: true });
}

async function makeUsers(org, pw, schools) {
  const { thane, nerul } = schools;
  const people = [
    [
      'Meera Kulkarni',
      'owner',
      'F',
      [
        [thane, 'owner', true],
        [nerul, 'owner', false],
      ],
      'mr',
      '9820000001',
    ],
    ['Anita Deshmukh', 'principal', 'F', [[thane, 'admin', true]], 'mr', '9820000002'],
    ['Ganesh Pawar', 'clerk', 'M', [[thane, 'clerk', true]], 'mr', '9820000003'],
    ['Sunita Patil', 'sunita', 'F', [[thane, 'teacher', true]], 'mr', '9820000004'],
    ['Rahul Verma', 'rahul', 'M', [[thane, 'teacher', true]], 'hi', '9820000005'],
    ['Kavita Jadhav', 'kavita', 'F', [[thane, 'teacher', true]], 'mr', '9820000006'],
    ['Sachin More', 'sachin', 'M', [[thane, 'teacher', true]], 'mr', null],
    ['Pooja Gaikwad', 'pooja', 'F', [[thane, 'teacher', true]], 'mr', null],
    ['Farida Shaikh', 'farida', 'F', [[thane, 'teacher', true]], 'hi', null],
    ['Imran Shaikh', 'imran', 'M', [[nerul, 'teacher', true]], 'hi', '9820000010'],
  ];
  const users = {};
  for (const [i, [name, key, gender, memberships, lang, phone]] of people.entries()) {
    const u = await m.User.create({
      organizationId: org.id,
      name,
      email: `${key}@demo.test`,
      phone,
      passwordHash: pw,
      mustChangePassword: false,
      preferredLanguage: lang,
      photoKey: key === 'clerk' || key === 'sachin' ? null : await photo('adult', 900 + i * 37, gender, 'users'),
      lastLoginAt: new Date(Date.now() - i * 3600e3),
    });
    for (const [school, role, isDefault] of memberships) await m.UserSchool.create({ userId: u.id, schoolId: school.id, role, isDefault });
    users[key] = u;
  }
  return users;
}

// ---- Children: simulated year by year (admissions, promotions, detentions, families moving away, finishing school).
function simulate({ years, grades, size, lateJoin }) {
  const kids = [];
  const used = new Set();
  const newKid = (gradeIndex, year, joinOn) => {
    const lang = pick(['mr', 'mr', 'mr', 'hi', 'hi', 'gu', 'mr']);
    const gender = chance(0.5) ? 'F' : 'M';
    let name;
    do {
      const native = C.NATIVE[lang];
      name = chance(0.15) && native ? pick(native) : `${pick(gender === 'F' ? C.GIRLS : C.BOYS)} ${pick(C.SURNAMES)}`;
    } while (used.has(name));
    used.add(name);
    const age = 5 + gradeIndex + (chance(0.25) ? 1 : 0); // some children start school late
    const born = new Date(Date.UTC(Number(year.startDate.slice(0, 4)) - age, between(0, 11), between(1, 28)));
    const kid = {
      name,
      gender,
      lang,
      ability: rand(),
      // Most children come nearly every day; about one in eight misses school often (work at the signal, migration).
      absentRate: chance(0.12) ? between(22, 38) : between(2, 11),
      dob: iso(born),
      approxDob: chance(0.15),
      admissionDate: joinOn,
      enrollments: [],
      status: 'active',
    };
    kid.enrollments.push({ yearIndex: years.indexOf(year), gradeIndex, enrolledOn: joinOn, status: 'active' });
    kids.push(kid);
    return kid;
  };
  const lastDay = (y) => (y.endDate < today ? y.endDate : yesterday);

  years.forEach((year, yi) => {
    if (yi === 0) {
      grades.forEach((_, g) => {
        for (let n = between(size[0], size[1]); n > 0; n -= 1) newKid(g, year, year.startDate);
      });
    } else {
      const prev = years[yi - 1];
      for (const kid of kids.filter((k) => k.status === 'active')) {
        const e = kid.enrollments.at(-1);
        if (e.yearIndex !== yi - 1) continue;
        e.exitedOn = prev.endDate;
        if (e.gradeIndex === grades.length - 1) {
          e.status = 'graduated';
          Object.assign(kid, { status: 'graduated', leftOn: prev.endDate });
        } else if (chance(0.07)) {
          e.status = 'left';
          Object.assign(kid, { status: 'left', leftOn: prev.endDate, leftReason: 'migrated', leftNote: 'Family moved back to the village after the year.' });
        } else {
          const detained = chance(0.04);
          e.status = detained ? 'detained' : 'promoted';
          kid.enrollments.push({ yearIndex: yi, gradeIndex: e.gradeIndex + (detained ? 0 : 1), enrolledOn: year.startDate, status: 'active', previous: e });
        }
      }
      for (let n = between(size[0], size[1]); n > 0; n -= 1) newKid(0, year, year.startDate);
      // Older children who never went to school join the class for their age.
      grades.forEach((_, g) => {
        for (let n = g ? between(1, 4) : 0; n > 0; n -= 1) newKid(g, year, year.startDate);
      });
    }
    // Children of migrant families join during the year too.
    const span = daysBetween(year.startDate, lastDay(year));
    grades.forEach((_, g) => {
      for (let n = between(0, lateJoin); n > 0; n -= 1) newKid(g, year, addDays(year.startDate, between(10, Math.max(11, span - 20))));
    });
    // ...and some leave during the year.
    for (const kid of kids.filter((k) => k.status === 'active' && k.enrollments.at(-1).yearIndex === yi)) {
      const e = kid.enrollments.at(-1);
      if (!chance(0.05)) continue;
      const leftOn = addDays(e.enrolledOn, between(20, Math.max(21, daysBetween(e.enrolledOn, lastDay(year)) - 5)));
      if (leftOn >= lastDay(year)) continue;
      const transferred = chance(0.4);
      e.status = transferred ? 'transferred' : 'left';
      e.exitedOn = leftOn;
      Object.assign(kid, {
        status: 'left',
        leftOn,
        leftReason: transferred ? 'transferred' : pick(['migrated', 'migrated', 'dropped_out']),
        leftToSchool: transferred ? pick(['ZP School, Kalwa', 'TMC School No. 12, Thane', 'Govt. Primary School, Gulbarga']) : null,
      });
    }
  });
  return kids;
}

async function buildSchool({ school, users, yearCount, gradeNames, size, lateJoin, classTeachers, subjectTeachers, photoSeed }) {
  // Years: the last one is the current year; earlier ones are closed.
  const years = [];
  for (let i = yearCount - 1; i >= 0; i -= 1) {
    const y = startYear - i;
    years.push(
      await m.AcademicYear.create({
        schoolId: school.id,
        name: `${y}-${String(y + 1).slice(2)}`,
        startDate: `${y}-06-15`,
        endDate: `${y + 1}-04-30`,
        status: i === 0 ? 'active' : 'closed',
        closedAt: i === 0 ? null : new Date(`${y + 1}-05-05T10:00:00Z`),
      }),
    );
  }
  const grades = [];
  for (const [i, name] of gradeNames.entries())
    grades.push(
      await m.Grade.create({ schoolId: school.id, name, nameTranslations: gradeTranslations(name), sortOrder: i, isFinal: i === gradeNames.length - 1 }),
    );
  for (let i = 0; i < grades.length - 1; i += 1) await grades[i].update({ nextGradeId: grades[i + 1].id });

  await m.Holiday.bulkCreate(
    years.flatMap((y) =>
      C.holidaysFor(Number(y.startDate.slice(0, 4)))
        .filter(([d]) => d >= y.startDate && d <= y.endDate)
        .map(([date, name, type]) => ({ schoolId: school.id, date, name, type })),
    ),
  );

  // Classes, subjects, teachers and syllabus for every year.
  const sections = {}; // `${yearIndex}:${gradeIndex}` → section
  const subjects = []; // { subject, yearIndex, gradeIndex, teacherId }
  for (const [yi, year] of years.entries()) {
    for (const [gi, grade] of grades.entries()) {
      const section = await m.ClassSection.create({ schoolId: school.id, academicYearId: year.id, gradeId: grade.id, name: `${grade.name} A`, sortOrder: 0 });
      sections[`${yi}:${gi}`] = section;
      const classTeacher = users[classTeachers[gi]];
      await m.TeacherAssignment.create({
        schoolId: school.id,
        academicYearId: year.id,
        userId: classTeacher.id,
        classSectionId: section.id,
        role: 'class_teacher',
      });
      for (const [si, [name, chapters]] of Object.entries(C.subjectsFor(gi)).entries()) {
        const subject = await m.Subject.create({ schoolId: school.id, academicYearId: year.id, classSectionId: section.id, name, sortOrder: si });
        const st = subjectTeachers.find(([subs, from, to]) => subs.includes(name) && gi >= from && gi <= to);
        const teacher = st ? users[st[3]] : classTeacher;
        if (st)
          await m.TeacherAssignment.create({
            schoolId: school.id,
            academicYearId: year.id,
            userId: teacher.id,
            classSectionId: section.id,
            subjectId: subject.id,
            role: 'subject_teacher',
          });
        subjects.push({ subject, yearIndex: yi, gradeIndex: gi, teacherId: teacher.id });
        // Syllabus with progress: past years nearly finished, this year in step with the calendar (some subjects behind).
        const lastDay = year.endDate < today ? year.endDate : yesterday;
        const elapsed = clamp(daysBetween(year.startDate, lastDay) / daysBetween(year.startDate, year.endDate), 0, 1);
        const target = year.status === 'active' ? clamp(elapsed * (0.6 + rand() * 0.7), 0.05, 1) : 0.85 + rand() * 0.15;
        const topics = [];
        for (const [ci, [chapterName, topicNames]] of chapters.entries()) {
          const chapter = await m.Chapter.create({ schoolId: school.id, subjectId: subject.id, name: chapterName, sortOrder: ci });
          topicNames.forEach((content, ti) => topics.push({ schoolId: school.id, chapterId: chapter.id, content, sortOrder: ti }));
        }
        const created = await m.Topic.bulkCreate(topics, { returning: ['id'] });
        const done = Math.round(created.length * target);
        const span = daysBetween(year.startDate, lastDay);
        await m.TopicCompletion.bulkCreate(
          created.slice(0, done).map((t, i) => ({
            schoolId: school.id,
            topicId: t.id,
            completedBy: teacher.id,
            completedOn: addDays(year.startDate, Math.round(((i + 1) / (done + 1)) * span)),
          })),
        );
      }
    }
  }

  // Children.
  const kids = simulate({ years, grades, size, lateJoin });
  kids.sort((a, b) => (a.admissionDate < b.admissionDate ? -1 : a.admissionDate > b.admissionDate ? 1 : 0));
  const area = school.location === 'Thane' ? C.AREAS : ['Nerul sector 6', 'Shiravane', 'Juinagar', 'LP signal, Nerul'];
  const rows = [];
  for (const [i, k] of kids.entries()) {
    const relation = pick(C.RELATION[k.lang] || C.RELATION.en);
    const surname = k.name.split(' ').slice(1).join(' ');
    const withPhoto = k.status === 'active' ? chance(0.8) : chance(0.4);
    rows.push({
      schoolId: school.id,
      grNumber: `${school.grPrefix}${i + 1}`,
      name: k.name,
      gender: k.gender,
      dob: k.approxDob ? null : k.dob,
      dobIsApproximate: k.approxDob,
      estimatedBirthYear: k.approxDob ? Number(k.dob.slice(0, 4)) : null,
      bloodGroup: chance(0.4) ? pick(['B+', 'O+', 'A+', 'AB+', 'O-']) : null,
      address: `${pick(area)}, ${school.location}`,
      fatherName: surname ? `${pick(C.BOYS)} ${surname}` : null,
      motherName: surname ? `${pick(C.GIRLS)} ${surname}` : null,
      guardianName: chance(0.8) ? `${pick(relation === 'Father' || relation === 'वडील' ? C.BOYS : C.GIRLS)} ${surname}`.trim() : null,
      guardianRelation: relation,
      guardianPhone: chance(0.9) ? `9${String(800000000 + ((i * 7919 + school.id * 104729) % 199999999)).padStart(9, '0')}` : null,
      guardianLanguage: k.lang,
      admissionDate: k.admissionDate,
      status: k.status,
      leftOn: k.leftOn || null,
      leftReason: k.status === 'left' ? k.leftReason : null,
      leftNote: k.leftNote || null,
      leftToSchool: k.leftToSchool || null,
      consentPhoto: withPhoto,
      photoKey: withPhoto ? await photo('child', photoSeed + i * 131, k.gender, `students/${school.id}`) : null,
    });
  }
  const students = await m.Student.bulkCreate(rows, { returning: ['id'] });
  kids.forEach((k, i) => (k.id = students[i].id));
  await school.update({ nextGrNumber: kids.length + 1 });

  // Enrollments year by year (roll numbers in name order, as registers are kept), linked to last year's.
  for (const [yi, year] of years.entries()) {
    const list = kids.flatMap((k) => k.enrollments.filter((e) => e.yearIndex === yi).map((e) => ({ k, e })));
    const bySection = {};
    for (const x of list) (bySection[x.e.gradeIndex] ||= []).push(x);
    for (const group of Object.values(bySection)) group.sort((a, b) => a.k.name.localeCompare(b.k.name)).forEach((x, i) => (x.e.roll = i + 1));
    const created = await m.Enrollment.bulkCreate(
      list.map(({ k, e }) => ({
        schoolId: school.id,
        academicYearId: year.id,
        studentId: k.id,
        classSectionId: sections[`${yi}:${e.gradeIndex}`].id,
        rollNumber: e.roll,
        status: e.status,
        enrolledOn: e.enrolledOn,
        exitedOn: e.exitedOn || null,
        previousEnrollmentId: e.previous?.id || null,
      })),
      { returning: ['id'] },
    );
    list.forEach((x, i) => (x.e.id = created[i].id));
  }

  // Attendance for every school day (no Sundays or holidays), from each child's own likelihood of being absent,
  // more absences in the monsoon months. Taken by the class teacher at about 9:45.
  await q(`CREATE TEMP TABLE IF NOT EXISTS demo_rates (student_id INT PRIMARY KEY, rate INT)`, {}, QueryTypes.RAW);
  await q(`TRUNCATE demo_rates`, {}, QueryTypes.RAW);
  await q(`INSERT INTO demo_rates VALUES ${kids.map((k) => `(${k.id}, ${k.absentRate})`).join(',')}`, {}, QueryTypes.INSERT);
  await q(
    `INSERT INTO attendance (school_id, academic_year_id, enrollment_id, student_id, class_section_id, date, status, marked_by, marked_at)
     SELECT e.school_id, e.academic_year_id, e.id, e.student_id, e.class_section_id, d::date,
       CASE WHEN x.h < r.rate + x.monsoon THEN 'A' WHEN x.h < r.rate + x.monsoon + 2 THEN 'L' WHEN x.h < r.rate + x.monsoon + 4 THEN 'LATE' ELSE 'P' END,
       ta.user_id, (d::date + time '09:45') AT TIME ZONE :tz
     FROM enrollments e
     JOIN academic_years y ON y.id = e.academic_year_id
     JOIN demo_rates r ON r.student_id = e.student_id
     LEFT JOIN teacher_assignments ta ON ta.class_section_id = e.class_section_id AND ta.role = 'class_teacher'
     CROSS JOIN LATERAL generate_series(greatest(e.enrolled_on, y.start_date), least(coalesce(e.exited_on, y.end_date), :yesterday::date), interval '1 day') d
     CROSS JOIN LATERAL (SELECT abs(hashtext(e.id || ':' || d::date)) % 100 AS h,
                                CASE WHEN extract(month FROM d) IN (7, 8) THEN 6 ELSE 0 END AS monsoon) x
     WHERE e.school_id = :school AND extract(dow FROM d) <> 0
       AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.school_id = e.school_id AND h.date = d::date)`,
    { school: school.id, yesterday, tz: TZ },
    QueryTypes.INSERT,
  );

  const current = years.at(-1);
  const active = kids.filter((k) => k.status === 'active');
  // A few children have stopped coming (the dashboard asks the principal to call their families).
  const recent = (await q(`SELECT DISTINCT date FROM attendance WHERE academic_year_id = :y ORDER BY date DESC LIMIT 5`, { y: current.id })).map((r) => r.date);
  const streak = active
    .filter((k) => k.enrollments.at(-1).enrolledOn < addDays(today, -30))
    .filter((_, i) => i % 23 === 5)
    .slice(0, 4);
  if (recent.length && streak.length)
    await q(
      `UPDATE attendance SET status = 'A' WHERE student_id IN (:ids) AND date IN (:dates)`,
      { ids: streak.map((k) => k.id), dates: recent.slice(0, 4) },
      QueryTypes.UPDATE,
    );

  // Today: most classes have already taken attendance; two are still waiting (one is Std 1 A, for trying it out).
  const isSchoolDay =
    (SCHOOL_DAY || new Date(`${today}T00:00:00Z`).getUTCDay() !== 0) &&
    today >= current.startDate &&
    !(await m.Holiday.findOne({ where: { schoolId: school.id, date: today } }));
  if (isSchoolDay) {
    const waiting = [1, 3];
    await q(
      `INSERT INTO attendance (school_id, academic_year_id, enrollment_id, student_id, class_section_id, date, status, marked_by, marked_at)
       SELECT e.school_id, e.academic_year_id, e.id, e.student_id, e.class_section_id, :today::date,
         CASE WHEN abs(hashtext(e.id || ':' || :today)) % 100 < r.rate THEN 'A' ELSE 'P' END, ta.user_id, now() - interval '2 hours'
       FROM enrollments e JOIN demo_rates r ON r.student_id = e.student_id
       LEFT JOIN teacher_assignments ta ON ta.class_section_id = e.class_section_id AND ta.role = 'class_teacher'
       WHERE e.academic_year_id = :y AND e.status = 'active' AND e.class_section_id NOT IN (:waiting)`,
      { today, y: current.id, waiting: waiting.map((g) => sections[`${years.length - 1}:${g}`]?.id ?? 0) },
      QueryTypes.INSERT,
    );
    if (streak.length)
      await q(`UPDATE attendance SET status = 'A' WHERE student_id IN (:ids) AND date = :today`, { ids: streak.map((k) => k.id), today }, QueryTypes.UPDATE);
  }
  await q(
    `INSERT INTO attendance_sessions (school_id, academic_year_id, class_section_id, date, submitted_by, submitted_at, present_count, absent_count, leave_count, late_count)
     SELECT school_id, academic_year_id, class_section_id, date, max(marked_by), max(marked_at),
       count(*) FILTER (WHERE status = 'P'), count(*) FILTER (WHERE status = 'A'), count(*) FILTER (WHERE status = 'L'), count(*) FILTER (WHERE status = 'LATE')
     FROM attendance WHERE school_id = :school GROUP BY 1, 2, 3, 4`,
    { school: school.id },
    QueryTypes.INSERT,
  );

  // Marks: both terms of past years; this year's first term only for the older classes (Std 1 is still open to try).
  const entries = [];
  for (const { subject, yearIndex, gradeIndex, teacherId } of subjects) {
    const year = years[yearIndex];
    const terms = year.status === 'active' ? (gradeIndex >= 5 ? ['S1'] : []) : ['S1', 'S2'];
    for (const k of kids) {
      const e = k.enrollments.find((x) => x.yearIndex === yearIndex && x.gradeIndex === gradeIndex);
      if (!e || ['left', 'transferred'].includes(e.status)) continue;
      for (const term of terms) {
        const score = clamp(k.ability * 0.6 + 0.3 + (rand() - 0.5) * 0.25 + (term === 'S2' ? 0.04 : 0), 0.1, 1);
        const balwadi = gradeIndex === 0;
        entries.push({
          schoolId: school.id,
          academicYearId: year.id,
          enrollmentId: e.id,
          subjectId: subject.id,
          term,
          grade: balwadi ? (score > 0.75 ? 'A' : score > 0.5 ? 'B' : 'C') : null,
          marks: balwadi ? null : Math.round(score * 50),
          maxMarks: balwadi ? null : 50,
          remarks: score > 0.85 ? 'Very good' : score < 0.4 ? 'Needs more practice' : null,
          enteredBy: teacherId,
        });
      }
    }
  }
  for (let i = 0; i < entries.length; i += 2000) await m.ReportEntry.bulkCreate(entries.slice(i, i + 2000));

  // Health check-ups every June (and a few needing a doctor again).
  const checks = [];
  for (const k of kids) {
    for (const e of k.enrollments) {
      const year = years[e.yearIndex];
      const on = addDays(year.startDate, 20 + (k.id % 10));
      if (on > yesterday || (e.exitedOn && on > e.exitedOn) || on < e.enrolledOn) continue;
      const age = (Date.parse(on) - Date.parse(k.dob)) / (365.25 * 86400000);
      checks.push({
        schoolId: school.id,
        studentId: k.id,
        checkedOn: on,
        heightCm: Math.round((76 + age * 6.2 + (rand() - 0.5) * 8) * 10) / 10,
        weightKg: Math.round((9 + age * 2.1 + (rand() - 0.5) * 3) * 10) / 10,
        needsFollowUp: false,
        createdBy: users.clerk?.id ?? null,
      });
    }
  }
  const followUp = active.filter((_, i) => i % 29 === 7).slice(0, 5);
  for (const [i, k] of followUp.entries()) {
    const last = checks.filter((c) => c.studentId === k.id).at(-1);
    if (last) Object.assign(last, { needsFollowUp: true, notes: C.HEALTH_NOTES[i % C.HEALTH_NOTES.length] });
  }
  await m.HealthCheck.bulkCreate(checks);

  // Diary: notes about children and the class over the last weeks.
  const ci = years.length - 1;
  const teacherOf = (gi) => users[classTeachers[gi]].id;
  const days = (await q(`SELECT DISTINCT date FROM attendance WHERE academic_year_id = :y ORDER BY date DESC LIMIT 25`, { y: current.id })).map((r) => r.date);
  if (days.length) {
    await m.DailyLog.bulkCreate(
      active
        .filter((_, i) => i % 3 === 0)
        .map((k) => {
          const e = k.enrollments.at(-1);
          return {
            schoolId: school.id,
            academicYearId: current.id,
            enrollmentId: e.id,
            studentId: k.id,
            date: pick(days.filter((d) => d >= e.enrolledOn).concat(days[0])),
            note: pick(C.CHILD_NOTES),
            createdBy: teacherOf(e.gradeIndex),
          };
        }),
    );
    await m.ClassDailyLog.bulkCreate(
      grades.flatMap((_, gi) =>
        days.slice(0, 8).map((date, i) => ({
          schoolId: school.id,
          academicYearId: current.id,
          classSectionId: sections[`${ci}:${gi}`].id,
          date,
          note: C.CLASS_NOTES[(gi + i) % C.CLASS_NOTES.length],
          createdBy: teacherOf(gi),
        })),
      ),
    );
  }

  // Activity groups for this year.
  for (const [name, nameTranslations] of C.ACTIVITIES) {
    const group = await m.ActivityGroup.create({ schoolId: school.id, academicYearId: current.id, name, nameTranslations });
    const members = active.filter((k) => k.enrollments.at(-1).gradeIndex >= 2 && chance(0.15));
    await m.ActivityMember.bulkCreate(members.map((k) => ({ activityGroupId: group.id, enrollmentId: k.enrollments.at(-1).id })));
  }

  return { years, grades, sections, kids, active, streak, followUp, classTeachers };
}

// A believable activity log for the last two weeks (what the principal sees under "Activity log").
async function activityLog(school, users, info) {
  const rows = [];
  const at = (daysAgo, hour) => new Date(Date.parse(`${addDays(today, -daysAgo)}T${String(hour).padStart(2, '0')}:15:00+05:30`));
  const cur = info.years.length - 1;
  info.grades.forEach((g, gi) => {
    for (let d = 1; d <= 6; d += 1)
      rows.push({
        action: 'attendance.save',
        userId: users[info.classTeachers[gi]].id,
        entityType: 'section',
        entityId: info.sections[`${cur}:${gi}`].id,
        summary: `${g.name} A`,
        createdAt: at(d, 9),
      });
  });
  for (const k of info.active.slice(-6))
    rows.push({ action: 'student.create', userId: users.clerk.id, entityType: 'student', entityId: k.id, summary: k.name, createdAt: at(between(1, 12), 11) });
  for (const k of info.followUp)
    rows.push({ action: 'health.create', userId: users.clerk.id, entityType: 'student', entityId: k.id, summary: today, createdAt: at(3, 12) });
  rows.push({ action: 'marks.save', userId: users.rahul.id, entityType: 'subject', summary: 'Maths · Std 5 A', createdAt: at(2, 14) });
  rows.push({ action: 'syllabus.complete', userId: users.sunita.id, entityType: 'topic', summary: 'Numbers up to 100', createdAt: at(1, 13) });
  rows.push({ action: 'holiday.create', userId: users.principal.id, entityType: 'holiday', summary: 'Diwali vacation', createdAt: at(9, 16) });
  rows.push({ action: 'school.update', userId: users.principal.id, entityType: 'school', entityId: school.id, createdAt: at(10, 17) });
  await m.AuditLog.bulkCreate(rows.map((r) => ({ schoolId: school.id, ...r })));
}

async function seed() {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force'))
    throw new Error('Refusing to wipe a production database (pass --force if you really mean it)');
  const started = Date.now();
  await m.sequelize.query(`TRUNCATE organizations RESTART IDENTITY CASCADE`);
  const pw = await hashPassword('password123');
  const org = await m.Organization.create({ name: 'Signal Shala Trust (demo)', headOffice: 'Thane', contactNumber: '022 2500 0000' });
  const thane = await m.School.create({
    organizationId: org.id,
    name: 'Signal Shala, Thane',
    location: 'Thane',
    address: 'Under Teen Hath Naka flyover, Eastern Express Highway, Thane (W) 400601',
    contactNumber: '022 2500 0001',
    grPrefix: 'SS-',
    defaultLanguage: 'mr',
    theme: 'signal',
    ...(SCHOOL_DAY && { weeklyOffs: [] }),
  });
  const nerul = await m.School.create({
    organizationId: org.id,
    name: 'Signal Shala, Nerul',
    location: 'Navi Mumbai',
    address: 'Near LP signal, Nerul, Navi Mumbai 400706',
    grPrefix: 'SN-',
    defaultLanguage: 'mr',
    theme: 'marigold',
    ...(SCHOOL_DAY && { weeklyOffs: [] }),
  });
  const users = await makeUsers(org, pw, { thane, nerul });

  const main = await buildSchool({
    school: thane,
    users,
    yearCount: 3,
    gradeNames: GRADE_NAMES,
    size: [13, 18],
    lateJoin: 2,
    classTeachers: ['pooja', 'sunita', 'kavita', 'kavita', 'sachin', 'rahul', 'farida', 'sachin'],
    subjectTeachers: [
      [['Maths', 'English'], 5, 7, 'rahul'],
      [['Hindi', 'Science'], 5, 7, 'farida'],
    ],
    photoSeed: 11,
  });
  await activityLog(thane, users, main);
  const small = await buildSchool({
    school: nerul,
    users,
    yearCount: 2,
    gradeNames: GRADE_NAMES.slice(0, 3),
    size: [10, 14],
    lateJoin: 1,
    classTeachers: ['imran', 'imran', 'imran'],
    subjectTeachers: [],
    photoSeed: 5003,
  });

  const [{ attendance }] = await q(`SELECT count(*)::int AS attendance FROM attendance`);
  console.log(
    [
      `Seeded in ${((Date.now() - started) / 1000).toFixed(1)} s:`,
      `  ${thane.name}: ${main.kids.length} children over ${main.years.length} years (${main.active.length} in school now), ${main.grades.length} classes`,
      `  ${nerul.name}: ${small.kids.length} children over ${small.years.length} years (${small.active.length} now)`,
      `  ${attendance} attendance marks`,
      'Logins (password "password123"): owner@demo.test, principal@demo.test, clerk@demo.test,',
      '  sunita@demo.test (class teacher, Std 1 A), rahul@demo.test (Maths/English Std 5–7), imran@demo.test (Nerul)',
    ].join('\n'),
  );
}

seed()
  .then(() => m.sequelize.close())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
