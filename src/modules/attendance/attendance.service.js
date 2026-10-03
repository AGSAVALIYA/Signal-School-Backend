const { Op, QueryTypes } = require('sequelize');
const m = require('../../db/models');
const { AppError, badRequest } = require('../../utils/errors');
const { todayIn, addDays, daysInMonth, weekday } = require('../../utils/dates');
const { isStaff, assertYearWritable } = require('../../utils/scope');
const storage = require('../../utils/storage');

const PRESENT = ['P', 'LATE'];

// Students who belong to the section on a given date (joined on/before, not exited before).
const activeOn = (classSectionId, date) => ({
  classSectionId,
  [Op.and]: [{ [Op.or]: [{ enrolledOn: null }, { enrolledOn: { [Op.lte]: date } }] }, { [Op.or]: [{ status: 'active' }, { exitedOn: { [Op.gt]: date } }] }],
});

// Why a date cannot be edited by this user, or null if it can.
function lockReason(req, year, date) {
  const today = todayIn(req.school.timezone);
  if (date > today) return 'DATE_IN_FUTURE';
  if (date < year.startDate || date > year.endDate) return 'DATE_OUTSIDE_YEAR';
  const unlocked = year.unlockedUntil && new Date(year.unlockedUntil) > new Date();
  if (year.status === 'closed' && !unlocked) return 'YEAR_CLOSED';
  if (!isStaff(req) && date < addDays(today, -req.school.attendanceEditDays)) return 'ATTENDANCE_LOCKED';
  return null;
}

async function holidayOn(school, date) {
  const h = await m.Holiday.findOne({ where: { schoolId: school.id, date } });
  if (h) return { name: h.name, type: h.type };
  return school.weeklyOffs.includes(weekday(date)) ? { name: null, type: 'weekly_off' } : null;
}

async function getSheet(req, section, date) {
  const year = await section.getAcademicYear();
  const enrollments = await m.Enrollment.findAll({
    where: activeOn(section.id, date),
    include: [{ model: m.Student, attributes: ['id', 'name', 'grNumber', 'photoKey', 'gender'] }],
    order: [
      ['rollNumber', 'ASC NULLS LAST'],
      [m.Student, 'name', 'ASC'],
    ],
  });
  const marks = await m.Attendance.findAll({ where: { classSectionId: section.id, date }, attributes: ['studentId', 'status', 'remark'] });
  const byStudent = Object.fromEntries(marks.map((a) => [a.studentId, a]));
  const session = await m.AttendanceSession.findOne({ where: { classSectionId: section.id, date } });
  const reason = lockReason(req, year, date);
  return {
    section: { id: section.id, name: section.name },
    date,
    holiday: await holidayOn(req.school, date),
    session,
    editable: !reason,
    lockReason: reason,
    rows: await Promise.all(
      enrollments.map(async (e) => ({
        enrollmentId: e.id,
        studentId: e.studentId,
        name: e.Student.name,
        grNumber: e.Student.grNumber,
        rollNumber: e.rollNumber,
        thumbUrl: await storage.thumbUrlFor(e.Student.photoKey),
        status: byStudent[e.studentId]?.status ?? null,
        remark: byStudent[e.studentId]?.remark ?? null,
      })),
    ),
  };
}

// Saves the whole class in one transaction. Idempotent; a stale offline save never overwrites a newer one.
async function saveSheet(req, section, date, rows, clientMarkedAt) {
  const year = await section.getAcademicYear();
  const reason = lockReason(req, year, date);
  if (reason) throw new AppError(reason === 'DATE_IN_FUTURE' || reason === 'DATE_OUTSIDE_YEAR' ? 400 : 423, reason);
  assertYearWritable(year);

  const enrollments = await m.Enrollment.findAll({ where: activeOn(section.id, date), attributes: ['id', 'studentId'] });
  const byStudent = new Map(enrollments.map((e) => [e.studentId, e.id]));
  if (rows.some((r) => !byStudent.has(r.studentId))) throw badRequest('VALIDATION', { fields: { rows: 'UNKNOWN_STUDENT' } });

  const markedAt = clientMarkedAt && new Date(clientMarkedAt) < new Date() ? new Date(clientMarkedAt) : new Date();
  await m.sequelize.transaction(async (transaction) => {
    if (rows.length) {
      const values = rows.map((_, i) => `(:school, :year, :e${i}, :s${i}, :section, :date, :st${i}, :r${i}, :user, :markedAt, now(), now())`).join(',');
      const replacements = { school: req.school.id, year: year.id, section: section.id, date, user: req.user.id, markedAt };
      rows.forEach((r, i) =>
        Object.assign(replacements, { [`e${i}`]: byStudent.get(r.studentId), [`s${i}`]: r.studentId, [`st${i}`]: r.status, [`r${i}`]: r.remark ?? null }),
      );
      await m.sequelize.query(
        `INSERT INTO attendance (school_id, academic_year_id, enrollment_id, student_id, class_section_id, date, status, remark, marked_by, marked_at, created_at, updated_at)
         VALUES ${values}
         ON CONFLICT (student_id, date) DO UPDATE SET status = EXCLUDED.status, remark = EXCLUDED.remark, marked_by = EXCLUDED.marked_by,
           marked_at = EXCLUDED.marked_at, class_section_id = EXCLUDED.class_section_id, enrollment_id = EXCLUDED.enrollment_id, updated_at = now()
         WHERE attendance.marked_at <= EXCLUDED.marked_at`,
        { replacements, transaction },
      );
    }
    const [counts] = await m.sequelize.query(
      `SELECT count(*) FILTER (WHERE status = 'P')::int AS p, count(*) FILTER (WHERE status = 'A')::int AS a,
              count(*) FILTER (WHERE status = 'L')::int AS l, count(*) FILTER (WHERE status = 'LATE')::int AS late
       FROM attendance WHERE class_section_id = :section AND date = :date`,
      { replacements: { section: section.id, date }, type: QueryTypes.SELECT, transaction },
    );
    await m.AttendanceSession.upsert(
      {
        schoolId: req.school.id,
        academicYearId: year.id,
        classSectionId: section.id,
        date,
        submittedBy: req.user.id,
        submittedAt: new Date(),
        presentCount: counts.p,
        absentCount: counts.a,
        leaveCount: counts.l,
        lateCount: counts.late,
      },
      { transaction, conflictFields: ['class_section_id', 'date'] },
    );
  });
}

// Monthly register: students × days with totals; holidays and weekly offs are excluded from percentages.
async function register(req, section, month) {
  const days = daysInMonth(month);
  const [from, to] = [days[0], days[days.length - 1]];
  const enrollments = await m.Enrollment.findAll({
    where: {
      classSectionId: section.id,
      [Op.and]: [{ [Op.or]: [{ enrolledOn: null }, { enrolledOn: { [Op.lte]: to } }] }, { [Op.or]: [{ exitedOn: null }, { exitedOn: { [Op.gte]: from } }] }],
    },
    include: [{ model: m.Student, attributes: ['id', 'name', 'grNumber'] }],
    order: [
      ['rollNumber', 'ASC NULLS LAST'],
      [m.Student, 'name', 'ASC'],
    ],
  });
  const marks = await m.Attendance.findAll({
    where: { classSectionId: section.id, date: { [Op.between]: [from, to] } },
    attributes: ['studentId', 'date', 'status'],
  });
  const holidays = await m.Holiday.findAll({ where: { schoolId: req.school.id, date: { [Op.between]: [from, to] } } });
  const holidayMap = Object.fromEntries(holidays.map((h) => [h.date, h.name]));
  const off = (d) => holidayMap[d] !== undefined || req.school.weeklyOffs.includes(weekday(d));
  const cell = {};
  marks.forEach((a) => {
    cell[`${a.studentId}|${a.date}`] = a.status;
  });

  const students = enrollments.map((e) => {
    const statuses = Object.fromEntries(days.map((d) => [d, cell[`${e.studentId}|${d}`] ?? null]));
    const vals = Object.values(statuses).filter(Boolean);
    const present = vals.filter((s) => PRESENT.includes(s)).length;
    const absent = vals.filter((s) => s === 'A').length;
    const leave = vals.filter((s) => s === 'L').length;
    return {
      studentId: e.studentId,
      name: e.Student.name,
      grNumber: e.Student.grNumber,
      rollNumber: e.rollNumber,
      statuses,
      totals: { present, absent, leave, percent: present + absent + leave ? Math.round((100 * present) / (present + absent + leave)) : null },
    };
  });
  const dayTotals = Object.fromEntries(days.map((d) => [d, students.filter((s) => PRESENT.includes(s.statuses[d])).length]));
  return {
    section: { id: section.id, name: section.name },
    month,
    days: days.map((d) => ({ date: d, off: off(d), holiday: holidayMap[d] ?? null })),
    students,
    dayTotals,
  };
}

// Today's school-wide status for the dashboard: which sections are done/pending, plus absentees.
async function today(req, yearId) {
  const date = todayIn(req.school.timezone);
  const sections = await m.sequelize.query(
    `SELECT cs.id, cs.name, s.present_count + s.late_count AS present, s.absent_count AS absent, s.leave_count AS leave, s.submitted_at AS "submittedAt",
            (SELECT count(*) FROM enrollments e WHERE e.class_section_id = cs.id AND e.status = 'active')::int AS strength
     FROM class_sections cs JOIN grades g ON g.id = cs.grade_id
     LEFT JOIN attendance_sessions s ON s.class_section_id = cs.id AND s.date = :date
     WHERE cs.academic_year_id = :y ORDER BY g.sort_order, cs.sort_order, cs.name`,
    { replacements: { date, y: yearId }, type: QueryTypes.SELECT },
  );
  const absentees = await m.sequelize.query(
    `SELECT st.id, st.name, st.guardian_name AS "guardianName", st.guardian_phone AS "guardianPhone", st.guardian_language AS "guardianLanguage", cs.name AS "sectionName"
     FROM attendance a JOIN students st ON st.id = a.student_id JOIN class_sections cs ON cs.id = a.class_section_id
     WHERE a.school_id = :s AND a.academic_year_id = :y AND a.date = :date AND a.status = 'A' ORDER BY cs.name, st.name`,
    { replacements: { s: req.school.id, y: yearId, date }, type: QueryTypes.SELECT },
  );
  return { date, holiday: await holidayOn(req.school, date), sections, absentees };
}

module.exports = { getSheet, saveSheet, register, today, holidayOn, lockReason, PRESENT };
