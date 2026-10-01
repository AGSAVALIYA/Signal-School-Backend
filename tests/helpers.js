const request = require('supertest');
const createApp = require('../src/app');
const m = require('../src/db/models');
const { hashPassword, issueTokens } = require('../src/modules/auth/auth.service');
const { todayIn } = require('../src/utils/dates');

const app = createApp();
const api = () => request(app);
const reset = () => m.sequelize.query('TRUNCATE organizations RESTART IDENTITY CASCADE');
const close = () => m.sequelize.close();
const today = () => todayIn('Asia/Kolkata');

// Returns a supertest agent wrapper that sends the user's token and school.
const as = (ctx) => {
  const wrap = (method) => (url) => {
    const r = api()[method](`/api/v1${url}`);
    if (ctx.token) r.set('Authorization', `Bearer ${ctx.token}`);
    if (ctx.schoolId) r.set('X-School-Id', String(ctx.schoolId));
    if (ctx.yearId) r.set('X-Academic-Year', String(ctx.yearId));
    return r;
  };
  return { get: wrap('get'), post: wrap('post'), put: wrap('put'), patch: wrap('patch'), delete: wrap('delete') };
};

async function makeUser(org, school, role, name, extra = {}) {
  const user = await m.User.create({
    organizationId: org.id,
    name,
    email: `${name.toLowerCase().replace(/\s/g, '.')}@t.test`,
    passwordHash: await hashPassword('password123'),
    mustChangePassword: false,
    ...extra,
  });
  await m.UserSchool.create({ userId: user.id, schoolId: school.id, role, isDefault: true });
  const { accessToken } = await issueTokens(user);
  return { user, token: accessToken, schoolId: school.id };
}

// One complete school: owner, admin, two teachers, two grades, active year, 2 sections, subjects, students.
async function makeSchool(label = 'A') {
  const org = await m.Organization.create({ name: `Org ${label}` });
  const school = await m.School.create({ organizationId: org.id, name: `School ${label}`, grPrefix: `${label}-` });
  const owner = await makeUser(org, school, 'owner', `Owner ${label}`);
  const admin = await makeUser(org, school, 'admin', `Admin ${label}`);
  const teacher = await makeUser(org, school, 'teacher', `Teacher ${label}`);
  const teacher2 = await makeUser(org, school, 'teacher', `Teacher2 ${label}`);
  const g2 = await m.Grade.create({ schoolId: school.id, name: 'Std 2', sortOrder: 1, isFinal: true });
  const g1 = await m.Grade.create({ schoolId: school.id, name: 'Std 1', sortOrder: 0, nextGradeId: g2.id });
  const t = today();
  const yy = Number(t.slice(0, 4));
  const year = await m.AcademicYear.create({ schoolId: school.id, name: `${yy}`, startDate: `${yy - 1}-06-01`, endDate: `${yy + 1}-04-30`, status: 'active' });
  const s1 = await m.ClassSection.create({ schoolId: school.id, academicYearId: year.id, gradeId: g1.id, name: 'Std 1 A' });
  const s2 = await m.ClassSection.create({ schoolId: school.id, academicYearId: year.id, gradeId: g2.id, name: 'Std 2 A' });
  const maths = await m.Subject.create({ schoolId: school.id, academicYearId: year.id, classSectionId: s1.id, name: 'Maths' });
  await m.TeacherAssignment.create({ schoolId: school.id, academicYearId: year.id, userId: teacher.user.id, classSectionId: s1.id, role: 'class_teacher' });
  const students = [];
  for (const [i, [name, section]] of [
    ['Asha', s1],
    ['Bala', s1],
    ['Chitra', s1],
    ['Dev', s2],
    ['Esha', s2],
  ].entries()) {
    const st = await m.Student.create({ schoolId: school.id, grNumber: `${label}-${i + 1}`, name: `${name} ${label}` });
    const e = await m.Enrollment.create({
      schoolId: school.id,
      academicYearId: year.id,
      studentId: st.id,
      classSectionId: section.id,
      rollNumber: i + 1,
      enrolledOn: year.startDate,
    });
    students.push({ student: st, enrollment: e });
  }
  await school.update({ nextGrNumber: 6 });
  const chapter = await m.Chapter.create({ schoolId: school.id, subjectId: maths.id, name: 'Numbers', sortOrder: 0 });
  const topic = await m.Topic.create({ schoolId: school.id, chapterId: chapter.id, content: 'Counting', sortOrder: 0 });
  return { org, school, owner, admin, teacher, teacher2, g1, g2, year, s1, s2, maths, students, chapter, topic };
}

module.exports = { api, as, reset, close, makeSchool, makeUser, today, m };
