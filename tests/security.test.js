// Scope matrix: every route is protected, and another organization can never read or change school A's records.
const { as, api, reset, close, makeSchool, today, m } = require('./helpers');
const router = require('../src/routes');

function collect(stack, out = []) {
  for (const layer of stack) {
    if (layer.route) for (const method of Object.keys(layer.route.methods)) out.push({ method, path: layer.route.path });
    else if (layer.handle?.stack) collect(layer.handle.stack, out);
  }
  return out;
}
const PUBLIC = ['/auth/login', '/auth/refresh', '/auth/logout'];
const routes = collect(router.stack);

let A;
let B;
let ids;
beforeAll(async () => {
  await reset();
  A = await makeSchool('A');
  B = await makeSchool('B');
  const holiday = await m.Holiday.create({ schoolId: A.school.id, date: today(), name: 'Fest' });
  const activity = await m.ActivityGroup.create({ schoolId: A.school.id, academicYearId: A.year.id, name: 'Dance' });
  const assignment = await m.TeacherAssignment.findOne({ where: { schoolId: A.school.id } });
  const log = await m.DailyLog.create({
    schoolId: A.school.id,
    academicYearId: A.year.id,
    enrollmentId: A.students[0].enrollment.id,
    studentId: A.students[0].student.id,
    date: today(),
    note: 'x',
    createdBy: A.teacher.user.id,
  });
  ids = { holiday: holiday.id, activity: activity.id, assignment: assignment.id, log: log.id };
});
afterAll(close);

// Fill route params with school A's ids.
function fill(path) {
  const byPrefix = [
    ['/academic-years', A.year.id],
    ['/students', A.students[0].student.id],
    ['/report-cards', A.students[0].student.id],
    ['/diary/students', A.students[0].student.id],
    ['/diary/sections', A.s1.id],
    ['/diary/entries', ids.log],
    ['/attendance/sections', A.s1.id],
    ['/syllabus/subjects', A.maths.id],
    ['/syllabus/topics', A.topic.id],
    ['/sections', A.s1.id],
    ['/subjects', A.maths.id],
    ['/grades', A.g1.id],
    ['/users', A.teacher.user.id],
    ['/assignments', ids.assignment],
    ['/activities', ids.activity],
    ['/holidays', ids.holiday],
  ];
  const id = (byPrefix.find(([p]) => path.startsWith(p)) || [null, 1])[1];
  return path
    .replace(':kind', 'student')
    .replace(':date', today())
    .replace(/:[a-zA-Z]+/g, String(id));
}

test('route list is discovered', () => {
  expect(routes.length).toBeGreaterThan(60);
});

test.each(routes.filter((r) => !PUBLIC.includes(r.path)).map((r) => [r.method.toUpperCase(), r.path]))('%s %s requires login', async (method, path) => {
  const res = await api()[method.toLowerCase()](`/api/v1${fill(path)}`);
  expect(res.status).toBe(401);
});

test.each(routes.filter((r) => /:/.test(r.path)).map((r) => [r.method.toUpperCase(), r.path]))(
  '%s %s is invisible to another organization',
  async (method, path) => {
    const res = await as(B.owner)[method.toLowerCase()](fill(path)).send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).not.toBe(500);
  },
);

test('a teacher id equal to an admin id does not grant admin rights', async () => {
  expect(A.teacher.user.id).not.toBe(A.admin.user.id);
  expect((await as(A.teacher).post('/users').send({ name: 'x', email: 'y@t.test', role: 'teacher' })).status).toBe(403);
  expect((await as(A.teacher).delete(`/sections/${A.s2.id}`)).status).toBe(403);
});

test('teacher cannot write to a section they are not assigned to', async () => {
  const res = await as(A.teacher)
    .put(`/attendance/sections/${A.s2.id}/${today()}`)
    .send({ rows: [{ studentId: A.students[3].student.id, status: 'P' }] });
  expect(res.status).toBe(403);
});

test('X-School-Id of a school the user does not belong to is refused', async () => {
  const res = await as({ ...A.owner, schoolId: B.school.id }).get('/students');
  expect(res.status).toBe(403);
});
