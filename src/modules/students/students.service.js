const { QueryTypes } = require('sequelize');
const m = require('../../db/models');
const storage = require('../../utils/storage');
const { conflict } = require('../../utils/errors');

// Atomically reserves `count` GR numbers for a school (no race between concurrent admissions).
async function allocateGr(school, count, transaction) {
  const [[row]] = await m.sequelize.query(
    `UPDATE schools SET next_gr_number = next_gr_number + :count WHERE id = :id RETURNING next_gr_number - :count AS first, gr_prefix AS prefix`,
    { replacements: { id: school.id, count }, transaction },
  );
  return Array.from({ length: count }, (_, i) => `${row.prefix}${row.first + i}`);
}

async function assertGrFree(schoolId, grNumber, transaction, exceptId) {
  const existing = await m.Student.findOne({ where: { schoolId, grNumber }, transaction });
  if (existing && existing.id !== exceptId)
    throw conflict('GR_DUPLICATE', { params: { gr: grNumber, name: existing.name }, fields: { grNumber: 'DUPLICATE' } });
}

const ageOf = (s, today = new Date()) => {
  if (s.dob) {
    const d = new Date(`${s.dob}T00:00:00Z`);
    let age = today.getUTCFullYear() - d.getUTCFullYear();
    if (today.getUTCMonth() < d.getUTCMonth() || (today.getUTCMonth() === d.getUTCMonth() && today.getUTCDate() < d.getUTCDate())) age -= 1;
    return age;
  }
  return s.estimatedBirthYear ? today.getUTCFullYear() - s.estimatedBirthYear : null;
};

async function studentDto(student, enrollment) {
  const s = student.toJSON ? student.toJSON() : student;
  delete s.Enrollments;
  return {
    ...s,
    age: ageOf(s),
    photoUrl: await storage.urlFor(s.photoKey),
    enrollment: enrollment
      ? {
          id: enrollment.id,
          academicYearId: enrollment.academicYearId,
          classSectionId: enrollment.classSectionId,
          sectionName: enrollment.ClassSection?.name,
          rollNumber: enrollment.rollNumber,
          status: enrollment.status,
        }
      : null,
  };
}

// Per-year summary for the student history tab.
function history(studentId) {
  return m.sequelize.query(
    `SELECT e.id AS "enrollmentId", e.status, e.roll_number AS "rollNumber", e.enrolled_on AS "enrolledOn", e.exited_on AS "exitedOn",
       y.id AS "academicYearId", y.name AS "yearName", y.status AS "yearStatus", s.id AS "sectionId", s.name AS "sectionName",
       count(a.id) FILTER (WHERE a.status IN ('P','LATE'))::int AS present,
       count(a.id) FILTER (WHERE a.status = 'A')::int AS absent,
       count(a.id) FILTER (WHERE a.status = 'L')::int AS leave,
       (SELECT json_agg(json_build_object('subject', sb.name, 'term', r.term, 'grade', r.grade, 'marks', r.marks, 'maxMarks', r.max_marks) ORDER BY sb.sort_order, r.term)
          FROM report_entries r JOIN subjects sb ON sb.id = r.subject_id WHERE r.enrollment_id = e.id) AS reports
     FROM enrollments e
     JOIN academic_years y ON y.id = e.academic_year_id
     JOIN class_sections s ON s.id = e.class_section_id
     LEFT JOIN attendance a ON a.enrollment_id = e.id
     WHERE e.student_id = :studentId
     GROUP BY e.id, y.id, s.id ORDER BY y.start_date DESC`,
    { replacements: { studentId }, type: QueryTypes.SELECT },
  );
}

module.exports = { allocateGr, assertGrFree, studentDto, history, ageOf };
