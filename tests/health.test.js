const { as, reset, close, makeSchool, today } = require('./helpers');
const { parseDate } = require('../src/modules/students/import.service');

let A;
let B;
beforeAll(async () => {
  await reset();
  A = await makeSchool('A');
  B = await makeSchool('B');
});
afterAll(close);

const sid = () => A.students[0].student.id;

test('teacher records a check-up; history lists it newest first with the author', async () => {
  const a = await as(A.teacher).post(`/students/${sid()}/health`).send({ checkedOn: '2024-01-10', heightCm: 110.5, weightKg: 18 });
  expect(a.status).toBe(201);
  const b = await as(A.teacher).post(`/students/${sid()}/health`).send({ checkedOn: today(), weightKg: 19, needsFollowUp: true, notes: 'Skin rash' });
  expect(b.status).toBe(201);
  const list = await as(A.admin).get(`/students/${sid()}/health`);
  expect(list.body.data.map((h) => h.weightKg)).toEqual([19, 18]);
  expect(list.body.data[0]).toMatchObject({ needsFollowUp: true, author: 'Teacher A' });
});

test('follow-up list shows students whose latest check-up needs a doctor', async () => {
  const res = await as(A.admin).get('/health/follow-ups');
  expect(res.body.data).toEqual([expect.objectContaining({ studentId: sid(), notes: 'Skin rash' })]);
});

test('empty, future or impossible check-ups are refused', async () => {
  expect((await as(A.teacher).post(`/students/${sid()}/health`).send({ checkedOn: today() })).status).toBe(400);
  expect((await as(A.teacher).post(`/students/${sid()}/health`).send({ checkedOn: '2999-01-01', weightKg: 20 })).body.error.code).toBe('DATE_IN_FUTURE');
  expect((await as(A.teacher).post(`/students/${sid()}/health`).send({ checkedOn: today(), weightKg: 900 })).status).toBe(400);
});

test('another school cannot read or delete health records; only author or staff can delete', async () => {
  expect((await as(B.owner).get(`/students/${sid()}/health`)).status).toBe(404);
  const id = (await as(A.admin).get(`/students/${sid()}/health`)).body.data[0].id;
  expect((await as(B.owner).delete(`/health/${id}`)).status).toBe(404);
  expect((await as(A.teacher2).delete(`/health/${id}`)).status).toBe(403);
  expect((await as(A.teacher).delete(`/health/${id}`)).status).toBe(204);
});

test('leaving records the destination school; readmission clears it', async () => {
  const id = A.students[1].student.id;
  const res = await as(A.admin).post(`/students/${id}/leave`).send({ date: today(), reason: 'transferred', toSchool: 'ZP School, Kalwa' });
  expect(res.status).toBe(200);
  expect(res.body.data).toMatchObject({ status: 'left', leftToSchool: 'ZP School, Kalwa' });
  await as(A.admin).post(`/students/${id}/readmit`).send({ classSectionId: A.s1.id });
  expect((await as(A.admin).get(`/students/${id}`)).body.data.leftToSchool).toBeNull();
});

test('marks above the maximum are rejected with a clear field code', async () => {
  const res = await as(A.teacher)
    .put('/marks')
    .send({ subjectId: A.maths.id, term: 'S1', entries: [{ enrollmentId: A.students[0].enrollment.id, marks: 60, maxMarks: 50 }] });
  expect(res.status).toBe(400);
  expect(res.body.error.fields['entries.0.marks']).toBe('MORE_THAN_MAX');
});

test('import dates: impossible days are invalid, real ones normalised', () => {
  expect(parseDate('31/02/2020')).toBeUndefined();
  expect(parseDate('2020-13-01')).toBeUndefined();
  expect(parseDate('5/6/2018')).toBe('2018-06-05');
  expect(parseDate('2018-06-05')).toBe('2018-06-05');
  expect(parseDate('')).toBeNull();
});

test('dashboard counts children whose latest check-up needs a doctor, and absentees carry the guardian language', async () => {
  await as(A.teacher).post(`/students/${A.students[2].student.id}/health`).send({ checkedOn: today(), notes: 'Eye check', needsFollowUp: true });
  const res = await as(A.admin).get('/dashboard');
  expect(res.body.data.counts.healthFollowUps).toBeGreaterThanOrEqual(1);
  await A.students[0].student.update({ guardianPhone: '9876543210', guardianLanguage: 'mr' });
  await as(A.teacher)
    .put(`/attendance/sections/${A.s1.id}/${today()}`)
    .send({ rows: [{ studentId: A.students[0].student.id, status: 'A' }] });
  const t = await as(A.admin).get('/attendance/today');
  expect(t.body.data.absentees[0]).toMatchObject({ guardianLanguage: 'mr', guardianPhone: '9876543210' });
});
