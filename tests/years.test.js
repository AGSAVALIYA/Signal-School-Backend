const { as, reset, close, makeSchool, m } = require('./helpers');

let A;
beforeEach(async () => {
  await reset();
  A = await makeSchool('A');
  await m.TopicCompletion.create({ schoolId: A.school.id, topicId: A.topic.id, completedBy: A.teacher.user.id, completedOn: A.year.startDate });
});
afterAll(close);

const next = () => {
  const y = Number(A.year.endDate.slice(0, 4));
  return { name: `${y}-${y + 1}`, startDate: `${y}-06-01`, endDate: `${y + 1}-04-30` };
};
const preview = () =>
  as(A.admin)
    .post('/academic-years/rollover/preview')
    .send({ sourceYearId: A.year.id, ...next() });

test('validates dates and overlap; cannot delete a year with data', async () => {
  expect((await as(A.admin).post('/academic-years').send({ name: 'x', startDate: '2030-06-01', endDate: '2030-01-01' })).status).toBe(400);
  expect((await as(A.admin).post('/academic-years').send({ name: 'x', startDate: A.year.startDate, endDate: A.year.endDate })).body.error.code).toBe(
    'YEAR_OVERLAP',
  );
  expect((await as(A.admin).delete(`/academic-years/${A.year.id}`)).body.error.code).toBe('YEAR_HAS_DATA');
  expect((await as(A.teacher).post('/academic-years').send(next())).status).toBe(403);
});

test('preview maps Std 1 A → Std 2 A and graduates the final grade', async () => {
  const { data } = (await preview()).body;
  const asha = data.promotions.find((p) => p.studentName === 'Asha A');
  const dev = data.promotions.find((p) => p.studentName === 'Dev A');
  expect(asha).toMatchObject({ action: 'promote', targetKey: `src-${A.s2.id}` });
  expect(dev).toMatchObject({ action: 'graduate', targetKey: null });
});

test('preview lists classes and students by class level, not alphabetically', async () => {
  await A.s1.update({ name: 'Zeta' }); // would sort last by name
  const { data } = (await preview()).body;
  expect(data.sections.map((s) => s.sourceId)).toEqual([A.s1.id, A.s2.id]);
  const order = data.promotions.map((p) => p.fromSectionId);
  expect(order).toEqual([...order].sort((x, y) => (x === A.s1.id ? 0 : 1) - (y === A.s1.id ? 0 : 1)));
  expect(order[0]).toBe(A.s1.id);
});

test('rollover copies structure without completions and promotes students in one go', async () => {
  const plan = (await preview()).body.data;
  plan.promotions.find((p) => p.studentName === 'Bala A').action = 'detain';
  plan.promotions.find((p) => p.studentName === 'Bala A').targetKey = `src-${A.s1.id}`;
  plan.promotions.find((p) => p.studentName === 'Chitra A').action = 'leave';
  plan.activate = true;
  const res = await as(A.admin).post('/academic-years/rollover').send({ idempotencyKey: 'key-12345', plan });
  expect(res.status).toBe(201);
  expect(res.body.data).toMatchObject({ sections: 2, subjects: 1, topics: 1, assignments: 1, promotions: { promote: 1, detain: 1, leave: 1, graduate: 2 } });

  const newYear = await m.AcademicYear.findByPk(res.body.data.academicYearId);
  expect(newYear.status).toBe('active');
  expect((await A.year.reload()).status).toBe('closed');
  expect(await m.TopicCompletion.count()).toBe(1);
  const asha = A.students[0].student;
  expect(await m.Student.count({ where: { name: 'Asha A' } })).toBe(1);
  expect(await m.Enrollment.count({ where: { studentId: asha.id } })).toBe(2);
  expect(await m.Student.findOne({ where: { name: 'Chitra A' } })).toMatchObject({ status: 'left', leftOn: A.year.endDate, leftReason: 'other' });
  const bala = A.students[1];
  expect(await m.Enrollment.findByPk(bala.enrollment.id)).toMatchObject({ status: 'detained', exitedOn: A.year.endDate });
  const balaNew = await m.Enrollment.findOne({ where: { studentId: bala.student.id, academicYearId: res.body.data.academicYearId } });
  expect(balaNew).toMatchObject({ status: 'active', previousEnrollmentId: bala.enrollment.id, enrolledOn: newYear.startDate });
  expect((await m.ClassSection.findByPk(balaNew.classSectionId)).name).toBe('Std 1 A');
  expect((await m.Student.findOne({ where: { name: 'Dev A' } })).status).toBe('graduated');

  const hist = await as(A.admin).get(`/students/${asha.id}/history`);
  expect(hist.body.data.map((h) => h.sectionName)).toEqual(['Std 2 A', 'Std 1 A']);
  // Past year stays viewable and read-only.
  const past = await as({ ...A.admin, yearId: A.year.id }).get('/sections');
  expect(past.body.data).toHaveLength(2);
  expect((await as(A.teacher).put(`/attendance/sections/${A.s1.id}/${A.year.startDate}`).send({ rows: [] })).status).toBe(423);
});

test('repeating the same request returns the first result, even concurrently', async () => {
  const plan = (await preview()).body.data;
  const send = () => as(A.admin).post('/academic-years/rollover').send({ idempotencyKey: 'same-key-1', plan });
  const [a, b] = await Promise.all([send(), send()]);
  expect(a.body.data.academicYearId).toBe(b.body.data.academicYearId);
  expect(await m.AcademicYear.count()).toBe(2);
});

test('an invalid plan creates nothing', async () => {
  const plan = (await preview()).body.data;
  plan.promotions[0].targetKey = 'missing';
  const res = await as(A.admin).post('/academic-years/rollover').send({ idempotencyKey: 'bad-plan-1', plan });
  expect(res.status).toBe(400);
  expect(await m.AcademicYear.count()).toBe(1);
  expect(await m.ClassSection.count()).toBe(2);
});

test('later promotions for students added after the wizard', async () => {
  const plan = (await preview()).body.data;
  plan.promotions = [];
  const { body } = await as(A.admin).post('/academic-years/rollover').send({ idempotencyKey: 'no-promos-1', plan });
  const target = await m.ClassSection.findOne({ where: { academicYearId: body.data.academicYearId, name: 'Std 2 A' } });
  const res = await as(A.admin)
    .post(`/academic-years/${body.data.academicYearId}/promotions`)
    .send({ items: [{ enrollmentId: A.students[0].enrollment.id, action: 'promote', targetSectionId: target.id }] });
  expect(res.status).toBe(200);
  expect(await m.Enrollment.count({ where: { academicYearId: body.data.academicYearId } })).toBe(1);
});
