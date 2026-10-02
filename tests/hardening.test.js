// Security hardening: token handling, file links, uploads and data minimisation.
const jwt = require('jsonwebtoken');
const { api, as, reset, close, makeSchool, m } = require('./helpers');
const storage = require('../src/utils/storage');

let A;
beforeEach(async () => {
  await reset();
  A = await makeSchool('A');
});
afterAll(close);

const login = (identifier, password = 'password123') => api().post('/api/v1/auth/login').send({ identifier, password });

test('a reused refresh token (after the grace period) ends every session of that user', async () => {
  const { refreshToken } = (await login('teacher.a@t.test')).body.data;
  const next = (await api().post('/api/v1/auth/refresh').send({ refreshToken })).body.data;
  await m.RefreshToken.update(
    { revokedAt: new Date(Date.now() - 5 * 60000) },
    { where: { userId: A.teacher.user.id, revokedAt: { [require('sequelize').Op.ne]: null } } },
  );
  expect((await api().post('/api/v1/auth/refresh').send({ refreshToken })).status).toBe(401);
  // The thief's replay revoked the legitimate chain too.
  expect((await api().post('/api/v1/auth/refresh').send({ refreshToken: next.refreshToken })).status).toBe(401);
  expect((await api().get('/api/v1/me').set('Authorization', `Bearer ${next.accessToken}`)).status).toBe(401);
});

test('a second refresh inside the grace period fails without logging the user out', async () => {
  const { refreshToken } = (await login('teacher.a@t.test')).body.data;
  const next = (await api().post('/api/v1/auth/refresh').send({ refreshToken })).body.data;
  expect((await api().post('/api/v1/auth/refresh').send({ refreshToken })).status).toBe(401);
  expect((await api().post('/api/v1/auth/refresh').send({ refreshToken: next.refreshToken })).status).toBe(200);
});

test('tokens signed with another algorithm or secret are rejected', async () => {
  const none = jwt.sign({ sub: A.owner.user.id, tv: 0 }, null, { algorithm: 'none' });
  const forged = jwt.sign({ sub: A.owner.user.id, tv: 0 }, 'another-secret-0123456789');
  for (const token of [none, forged]) expect((await api().get('/api/v1/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
});

test('unknown login and wrong password give the same answer', async () => {
  const a = await login('nobody@t.test');
  const b = await login('teacher.a@t.test', 'wrong-password');
  expect(a.status).toBe(401);
  expect(a.body.error.code).toBe(b.body.error.code);
});

test('local files need a valid, unexpired signature', async () => {
  const key = await storage.saveImage(
    await require('sharp')({ create: { width: 4, height: 4, channels: 3, background: '#fff' } })
      .png()
      .toBuffer(),
    'test',
  );
  const url = await storage.urlFor(key);
  expect((await api().get(url)).status).toBe(200);
  expect((await api().get(`/files/${key}`)).status).toBe(404);
  expect((await api().get(url.replace(/s=[^&]+/, 's=AAAA'))).status).toBe(404);
  expect((await api().get(url.replace(/e=\d+/, 'e=1000'))).status).toBe(404);
});

test('a file that only claims to be an image is refused with FILE_TYPE', async () => {
  const res = await as(A.teacher)
    .post(`/students/${A.students[0].student.id}/photo`)
    .attach('photo', Buffer.from('not really a picture'), { filename: 'x.jpg', contentType: 'image/jpeg' });
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('FILE_TYPE');
});

test('teachers see colleagues by name only; the office sees contact details', async () => {
  const t = await as(A.teacher).get('/users');
  expect(t.status).toBe(200);
  expect(JSON.stringify(t.body.data)).not.toMatch(/@t\.test|lastLoginAt/);
  const a = await as(A.admin).get('/users');
  expect(JSON.stringify(a.body.data)).toMatch(/@t\.test/);
});

test('an unsafe X-Request-Id is replaced', async () => {
  const res = await api().get('/health').set('X-Request-Id', 'bad id <script>');
  expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
});

test('a rollover key of another school cannot be replayed', async () => {
  const B = await makeSchool('B');
  await m.RolloverRun.create({ schoolId: B.school.id, idempotencyKey: 'shared-key-123', summary: { academicYearId: 1 } });
  const res = await as(A.admin)
    .post('/academic-years/rollover')
    .send({
      idempotencyKey: 'shared-key-123',
      plan: {
        sourceYearId: A.year.id,
        name: 'X',
        startDate: '2090-06-01',
        endDate: '2091-04-30',
        activate: false,
        copy: { subjects: false, syllabus: false, assignments: false },
        sections: [],
        promotions: [],
      },
    });
  expect(res.status).toBe(400);
});
