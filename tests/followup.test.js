// Gaps found after v1: duplicate admissions (#3), absence streaks (#4), one child's month (#5).
const { as, reset, close, makeSchool, today, m } = require('./helpers');
const { addDays } = require('../src/utils/dates');

let A;
let B;
beforeAll(async () => {
  await reset();
  A = await makeSchool('A');
  B = await makeSchool('B');
  await A.students[0].student.update({ name: 'Aarti Shinde', guardianPhone: '98765 43210' });
  await A.students[1].student.update({ status: 'left', name: 'Kshitij Pawar' });
});
afterAll(close);

describe('possible duplicates (#3)', () => {
  const find = (who, query) => as(who).get(`/students/possible-duplicates?${new URLSearchParams(query)}`);

  test('finds a similar name and an identical guardian phone, including children who left', async () => {
    expect((await find(A.admin, { name: 'Arti Shinde' })).body.data[0]).toMatchObject({ name: 'Aarti Shinde', grNumber: 'A-1' });
    const byPhone = await find(A.admin, { name: 'Somebody Else', guardianPhone: '+91 9876543210' });
    expect(byPhone.body.data[0]).toMatchObject({ name: 'Aarti Shinde', samePhone: true, lastClass: 'Std 1 A' });
    expect((await find(A.admin, { name: 'Kshitij Pawar' })).body.data[0]).toMatchObject({ status: 'left' });
  });

  test('short input returns nothing; other schools are never searched', async () => {
    expect((await find(A.admin, { name: 'Aa' })).body.data).toEqual([]);
    expect((await find(B.owner, { name: 'Aarti Shinde', guardianPhone: '9876543210' })).body.data).toEqual([]);
  });
});

describe('absence streaks (#4)', () => {
  const t = today();
  const mark = (student, date, status) =>
    m.Attendance.create({
      schoolId: A.school.id,
      academicYearId: A.year.id,
      enrollmentId: student.enrollment.id,
      studentId: student.student.id,
      classSectionId: student.enrollment.classSectionId,
      date,
      status,
    });

  test('lists children absent on their last 3+ marked days, newest streak first', async () => {
    const [streaky, broken, d] = [A.students[2], A.students[3], A.students[4]];
    for (const [i, s] of ['P', 'A', 'A', 'A'].entries()) await mark(streaky, addDays(t, -3 + i), s);
    for (const [i, s] of ['A', 'P', 'A', 'A'].entries()) await mark(broken, addDays(t, -3 + i), s);
    for (const [i, s] of ['A', 'A', 'A', 'A', 'A'].entries()) await mark(d, addDays(t, -10 + 2 * i), s); // gaps = holidays
    const res = await as(A.admin).get('/dashboard');
    const list = res.body.data.consecutiveAbsences;
    expect(list.map((x) => [x.name, x.days])).toEqual([
      ['Esha A', 5],
      ['Chitra A', 3],
    ]);
    expect(list[1].since).toBe(addDays(t, -2));
    expect((await as(B.owner).get('/dashboard')).body.data.consecutiveAbsences).toEqual([]);
  });
});

describe('one child, one month (#5)', () => {
  test('returns every day with marks, holidays, weekly offs and totals', async () => {
    const s = A.students[2];
    const month = today().slice(0, 7);
    const res = await as(A.teacher).get(`/students/${s.student.id}/attendance?month=${month}`);
    expect(res.status).toBe(200);
    const { days, totals } = res.body.data;
    expect(days[0].date).toBe(`${month}-01`);
    expect(days.filter((d) => d.status).length).toBeGreaterThan(0);
    expect(totals.present + totals.absent + totals.leave).toBe(days.filter((d) => d.status && !d.off).length);
  });

  test('bad month is 400, another school is 404', async () => {
    expect((await as(A.teacher).get(`/students/${A.students[0].student.id}/attendance?month=2026-13`)).status).toBe(400);
    expect((await as(B.owner).get(`/students/${A.students[0].student.id}/attendance?month=2026-01`)).status).toBe(404);
  });
});

test('activity log filters by person and by area, with paging', async () => {
  await as(A.admin).post('/holidays').send({ date: '2030-01-26', name: 'Republic Day' });
  await as(A.teacher)
    .put(`/attendance/sections/${A.s1.id}/${today()}`)
    .send({ rows: [{ studentId: A.students[0].student.id, status: 'P' }] });
  const byTeacher = await as(A.admin).get(`/audit?userId=${A.teacher.user.id}`);
  expect(byTeacher.body.data.every((l) => l.userId === A.teacher.user.id)).toBe(true);
  const attendanceOnly = await as(A.admin).get('/audit?areas=attendance,bogus');
  expect(attendanceOnly.body.data.length).toBeGreaterThan(0);
  expect(attendanceOnly.body.data.every((l) => l.action.startsWith('attendance.'))).toBe(true);
  const page2 = await as(A.admin).get('/audit?pageSize=1&page=2');
  expect(page2.body.data).toHaveLength(1);
  expect(page2.body.meta.total).toBeGreaterThan(1);
});
