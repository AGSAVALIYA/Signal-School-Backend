const router = require('express').Router();
const { QueryTypes } = require('sequelize');
const { z } = require('zod');
const validate = require('../../middlewares/validate');
const { requirePerm, yearScope } = require('../../middlewares/auth');
const m = require('../../db/models');
const attendance = require('../attendance/attendance.service');
const { todayIn, addDays } = require('../../utils/dates');
const { page } = require('../../utils/http');
const { isStaff } = require('../../utils/scope');

const q = (sql, replacements) => m.sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

// Principal's dashboard: setup checklist, today's attendance, trends, syllabus and at-risk students.
router.get('/dashboard', requirePerm('reports.view'), yearScope({ required: false }), async (req, res) => {
  const s = req.school.id;
  const y = req.year?.id ?? 0;
  const date = todayIn(req.school.timezone);
  const [[counts], trend, atRisk, syllabus, birthdays] = await Promise.all([
    q(
      `SELECT (SELECT count(*) FROM enrollments WHERE academic_year_id = :y AND status = 'active')::int AS students,
              (SELECT count(*) FROM user_schools us JOIN users u ON u.id = us.user_id AND u.status = 'active' WHERE us.school_id = :s AND us.role = 'teacher')::int AS teachers,
              (SELECT count(*) FROM class_sections WHERE academic_year_id = :y)::int AS sections,
              (SELECT count(*) FROM subjects WHERE academic_year_id = :y)::int AS subjects,
              (SELECT count(*) FROM grades WHERE school_id = :s)::int AS grades`,
      { s, y },
    ),
    q(
      `SELECT date, sum(present_count + late_count)::int AS present, sum(present_count + late_count + absent_count + leave_count)::int AS marked
       FROM attendance_sessions WHERE school_id = :s AND academic_year_id = :y AND date > :from GROUP BY date ORDER BY date`,
      { s, y, from: addDays(date, -14) },
    ),
    q(
      `SELECT st.id, st.name, cs.name AS "sectionName", st.guardian_phone AS "guardianPhone",
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
    },
  });
});

// Teacher home: my sections with today's attendance status and my subjects with progress.
router.get('/today', yearScope({ required: false }), async (req, res) => {
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
      page: z.coerce.number().optional(),
      pageSize: z.coerce.number().optional(),
    }),
  }),
  async (req, res) => {
    const { limit, offset } = page(req.v.query);
    const { userId, entityType, action } = req.v.query;
    const where = { schoolId: req.school.id, ...(userId ? { userId } : {}), ...(entityType ? { entityType } : {}), ...(action ? { action } : {}) };
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
