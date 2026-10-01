const { as, reset, close, makeSchool, today, m } = require('./helpers');
const { todayIn, addDays } = require('../src/utils/dates');

let A;
let rows;
beforeEach(async () => {
  await reset();
  A = await makeSchool('A');
  rows = A.students.slice(0, 3).map(({ student }, i) => ({ studentId: student.id, status: i === 1 ? 'A' : 'P' }));
});
afterAll(close);

const url = (date = today(), section = A.s1.id) => `/attendance/sections/${section}/${date}`;

test('teacher saves the whole class in one call and gets counts back', async () => {
  const res = await as(A.teacher).put(url()).send({ rows });
  expect(res.status).toBe(200);
  expect(res.body.data.session).toMatchObject({ presentCount: 2, absentCount: 1 });
  expect(res.body.data.rows.map((r) => r.status)).toEqual(['P', 'A', 'P']);
});

test('saving again updates instead of duplicating', async () => {
  await as(A.teacher).put(url()).send({ rows });
  rows[1].status = 'P';
  await as(A.teacher).put(url()).send({ rows });
  expect(await m.Attendance.count()).toBe(3);
  expect((await m.AttendanceSession.findOne()).absentCount).toBe(0);
});

test('future dates are refused', async () => {
  const res = await as(A.teacher)
    .put(url(addDays(today(), 1)))
    .send({ rows });
  expect(res.body.error.code).toBe('DATE_IN_FUTURE');
});

test('teacher edit window is enforced, admin may still correct', async () => {
  const old = addDays(today(), -10);
  expect((await as(A.teacher).put(url(old)).send({ rows })).body.error.code).toBe('ATTENDANCE_LOCKED');
  expect((await as(A.admin).put(url(old)).send({ rows })).status).toBe(200);
});

test('a stale offline save does not overwrite a newer one', async () => {
  await as(A.teacher).put(url()).send({ rows });
  const stale = rows.map((r) => ({ ...r, status: 'L' }));
  await as(A.teacher)
    .put(url())
    .send({ rows: stale, clientMarkedAt: new Date(Date.now() - 3600000).toISOString() });
  expect((await m.Attendance.findAll({ order: [['studentId', 'ASC']] })).map((a) => a.status)).toEqual(['P', 'A', 'P']);
});

test('closed years are read-only until unlocked', async () => {
  await A.year.update({ status: 'closed' });
  expect((await as(A.admin).put(url()).send({ rows })).status).toBe(423);
  await as(A.admin).post(`/academic-years/${A.year.id}/unlock`).send({ minutes: 30, reason: 'late correction' });
  expect((await as(A.admin).put(url()).send({ rows })).status).toBe(200);
});

test('monthly register returns totals and excludes nothing marked', async () => {
  await as(A.teacher).put(url()).send({ rows });
  const res = await as(A.admin).get(`/attendance/register?sectionId=${A.s1.id}&month=${today().slice(0, 7)}`);
  expect(res.status).toBe(200);
  expect(res.body.data.students[1].totals).toMatchObject({ absent: 1, percent: 0 });
  expect(res.body.data.dayTotals[today()]).toBe(2);
});

test('today summary lists pending and done sections with absentees', async () => {
  await as(A.teacher).put(url()).send({ rows });
  const res = await as(A.admin).get('/attendance/today');
  expect(res.body.data.sections.find((s) => s.id === A.s1.id).absent).toBe(1);
  expect(res.body.data.sections.find((s) => s.id === A.s2.id).submittedAt).toBeNull();
  expect(res.body.data.absentees).toHaveLength(1);
});

test('school calendar date does not depend on server timezone', () => {
  expect(todayIn('Asia/Kolkata', new Date('2026-10-01T18:45:00Z'))).toBe('2026-10-02');
  expect(todayIn('Asia/Kolkata', new Date('2026-10-01T18:15:00Z'))).toBe('2026-10-01');
});

test('holidays are listed on the sheet', async () => {
  await as(A.admin).post('/holidays').send({ date: today(), name: 'Diwali' });
  expect((await as(A.teacher).get(url())).body.data.holiday).toMatchObject({ name: 'Diwali' });
});
