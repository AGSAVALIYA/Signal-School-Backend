// The principal picks the app's look for the whole school; everyone gets it with /me.
const { as, reset, close, makeSchool } = require('./helpers');

let A;
beforeAll(async () => {
  await reset();
  A = await makeSchool('A');
});
afterAll(close);

test('school starts on the Signal Shala look; the principal can change it and staff see it in /me', async () => {
  expect((await as(A.admin).get('/school')).body.data.theme).toBe('signal');
  const res = await as(A.admin).patch('/school').send({ theme: 'chalkboard' });
  expect(res.status).toBe(200);
  expect(res.body.data.theme).toBe('chalkboard');
  const me = await as(A.teacher).get('/me');
  expect(me.body.data.schools[0]).toMatchObject({ id: A.school.id, theme: 'chalkboard' });
});

test('unknown looks are refused and teachers cannot change it', async () => {
  expect((await as(A.admin).patch('/school').send({ theme: 'dark' })).status).toBe(400);
  expect((await as(A.teacher).patch('/school').send({ theme: 'notebook' })).status).toBe(403);
});
