// Response cache: enabled here (it is off by default in tests). Set TEST_REDIS_URL to run the same tests against Redis.
process.env.CACHE_TTL = '60';
if (process.env.TEST_REDIS_URL) process.env.REDIS_URL = process.env.TEST_REDIS_URL;
const cache = require('../src/utils/cache');
const { as, reset, close, makeSchool, today } = require('./helpers');

let A;
let B;
beforeAll(async () => {
  if (process.env.REDIS_URL) for (let i = 0; i < 50 && !cache.redisReady(); i += 1) await new Promise((r) => setTimeout(r, 100));
});
beforeEach(async () => {
  await Promise.all([reset(), cache.clear()]);
  A = await makeSchool('A');
  B = await makeSchool('B');
});
afterAll(async () => {
  await cache.close();
  await close();
});

const sheet = (status) => ({ rows: A.students.slice(0, 3).map((s) => ({ studentId: s.student.id, status })) });

test('a saved attendance sheet shows on the next dashboard read', async () => {
  const first = await as(A.admin).get('/dashboard');
  expect(first.headers['x-cache']).toBe('MISS');
  const again = await as(A.admin).get('/dashboard');
  expect(again.headers['x-cache']).toBe('HIT');
  expect(again.body).toEqual(first.body);

  expect((await as(A.teacher).put(`/attendance/sections/${A.s1.id}/${today()}`).send(sheet('A'))).status).toBe(200);
  const after = await as(A.admin).get('/attendance/today');
  expect(after.headers['x-cache']).toBe('MISS');
  expect(after.body.data.absentees).toHaveLength(3);
});

test('a refused write does not clear the cache', async () => {
  await as(A.admin).get('/sections');
  expect((await as(A.admin).post('/sections').send({})).status).toBe(400);
  expect((await as(A.admin).get('/sections')).headers['x-cache']).toBe('HIT');
});

test('answers that depend on the user and school are cached separately', async () => {
  const mine = await as(A.teacher).get('/today');
  const other = await as(A.teacher2).get('/today');
  expect(other.headers['x-cache']).toBe('MISS');
  expect(other.body).not.toEqual(mine.body);
  expect((await as(A.teacher).get('/today')).headers['x-cache']).toBe('HIT');

  await as(A.admin).get('/sections');
  const b = await as(B.admin).get('/sections');
  expect(b.headers['x-cache']).toBe('MISS');
  expect(b.body.data[0].id).not.toBe((await as(A.admin).get('/sections')).body.data[0].id);
});

test('a write in one school leaves the other school cached', async () => {
  await as(B.admin).get('/syllabus/progress');
  await as(A.teacher).put(`/attendance/sections/${A.s1.id}/${today()}`).send(sheet('P'));
  expect((await as(B.admin).get('/syllabus/progress')).headers['x-cache']).toBe('HIT');
});
