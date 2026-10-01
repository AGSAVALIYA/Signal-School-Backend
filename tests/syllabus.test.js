const { as, reset, close, makeSchool, today, m } = require('./helpers');

let A;
beforeEach(async () => {
  await reset();
  A = await makeSchool('A');
});
afterAll(close);

const tree = () => as(A.admin).get(`/syllabus/subjects/${A.maths.id}`);

test('renaming a chapter keeps the "taught" ticks', async () => {
  expect((await as(A.teacher).post(`/syllabus/topics/${A.topic.id}/complete`).send({})).status).toBe(200);
  const { chapters } = (await tree()).body.data;
  const res = await as(A.admin)
    .put(`/syllabus/subjects/${A.maths.id}`)
    .send({
      chapters: [
        { id: chapters[0].id, name: 'Numbers (renamed)', topics: [{ id: A.topic.id, content: 'Counting to 20' }, { content: 'Addition' }] },
        { name: 'Shapes', topics: [] },
      ],
    });
  expect(res.status).toBe(200);
  expect(res.body.data.progress).toEqual({ total: 2, done: 1, percent: 50 });
  expect(res.body.data.chapters[0].Topics[0].completion.teacher.name).toBe('Teacher A');
});

test('a topic that was taught cannot be silently removed', async () => {
  await as(A.teacher).post(`/syllabus/topics/${A.topic.id}/complete`).send({});
  const res = await as(A.admin).put(`/syllabus/subjects/${A.maths.id}`).send({ chapters: [] });
  expect(res.body.error.code).toBe('TOPIC_HAS_COMPLETION');
});

test('teachers always mark as themselves; others cannot undo their tick', async () => {
  await as(A.teacher).post(`/syllabus/topics/${A.topic.id}/complete`).send({ teacherId: A.admin.user.id });
  expect((await m.TopicCompletion.findOne()).completedBy).toBe(A.teacher.user.id);
  await m.TeacherAssignment.create({
    schoolId: A.school.id,
    academicYearId: A.year.id,
    userId: A.teacher2.user.id,
    classSectionId: A.s1.id,
    subjectId: A.maths.id,
    role: 'subject_teacher',
  });
  expect((await as(A.teacher2).delete(`/syllabus/topics/${A.topic.id}/complete`)).status).toBe(403);
  expect((await as(A.teacher2).put(`/syllabus/subjects/${A.maths.id}`).send({ chapters: [] })).status).toBe(403);
});

test('progress report by section and subject', async () => {
  await as(A.teacher).post(`/syllabus/topics/${A.topic.id}/complete`).send({ date: today() });
  const res = await as(A.admin).get('/syllabus/progress');
  expect(res.body.data[0]).toMatchObject({ subjectName: 'Maths', total: 1, done: 1, percent: 100 });
});

test('marks grid upserts and feeds the report card', async () => {
  const entries = A.students.slice(0, 2).map(({ enrollment }, i) => ({ enrollmentId: enrollment.id, grade: i ? 'B' : 'A', remarks: 'Good' }));
  expect((await as(A.teacher).put('/marks').send({ subjectId: A.maths.id, term: 'S1', entries })).status).toBe(200);
  entries[1].grade = 'A+';
  await as(A.teacher).put('/marks').send({ subjectId: A.maths.id, term: 'S1', entries });
  expect(await m.ReportEntry.count()).toBe(2);
  const grid = await as(A.teacher).get(`/marks?subjectId=${A.maths.id}&term=S1`);
  expect(grid.body.data.rows[1].grade).toBe('A+');
  const card = await as(A.admin).get(`/report-cards/${A.students[1].student.id}?term=S1`);
  expect(card.body.data.subjects[0]).toMatchObject({ subject: 'Maths', grade: 'A+' });
});

test('dashboard and teacher home', async () => {
  const dash = await as(A.admin).get('/dashboard');
  expect(dash.body.data.counts).toMatchObject({ students: 5, sections: 2 });
  expect(dash.body.data.setup.students).toBe(true);
  const home = await as(A.teacher).get('/today');
  expect(home.body.data.sections.map((s) => s.name)).toEqual(['Std 1 A']);
  expect(home.body.data.subjects[0]).toMatchObject({ name: 'Maths', total: 1 });
});

test('class diary note appears on present students', async () => {
  const res = await as(A.teacher).put(`/diary/sections/${A.s1.id}/${today()}`).field('note', 'Learned numbers').field('subjectIds', `[${A.maths.id}]`);
  expect(res.status).toBe(200);
  const diary = await as(A.teacher).get(`/diary/students/${A.students[0].student.id}`);
  expect(diary.body.data[0]).toMatchObject({ kind: 'class', note: 'Learned numbers', subjects: ['Maths'] });
});

test('structure: cannot delete a section that has students', async () => {
  expect((await as(A.admin).delete(`/sections/${A.s1.id}`)).body.error.code).toBe('IN_USE');
  const sec = await as(A.admin).post('/sections').send({ gradeId: A.g1.id, name: 'Std 1 B' });
  expect(sec.status).toBe(201);
  expect((await as(A.admin).delete(`/sections/${sec.body.data.id}`)).status).toBe(204);
});
