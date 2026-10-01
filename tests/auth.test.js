const { api, as, reset, close, makeSchool, m } = require('./helpers');

let A;
beforeEach(async () => {
  await reset();
  A = await makeSchool('A');
});
afterAll(close);

const login = (identifier, password = 'password123') => api().post('/api/v1/auth/login').send({ identifier, password });

test('login returns tokens and profile without password hash', async () => {
  const res = await login('Teacher.A@t.test');
  expect(res.status).toBe(200);
  expect(res.body.data.accessToken).toBeTruthy();
  expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/);
  expect(res.body.data.user.schools[0]).toMatchObject({ id: A.school.id, role: 'teacher' });
});

test('wrong password is 401 and account locks after 10 failures', async () => {
  for (let i = 0; i < 10; i += 1) expect((await login('teacher.a@t.test', 'nope')).status).toBe(401);
  expect((await login('teacher.a@t.test')).status).toBe(429);
});

test('refresh token rotates and cannot be reused', async () => {
  const { refreshToken } = (await login('teacher.a@t.test')).body.data;
  const first = await api().post('/api/v1/auth/refresh').send({ refreshToken });
  expect(first.status).toBe(200);
  expect((await api().post('/api/v1/auth/refresh').send({ refreshToken })).status).toBe(401);
});

test('password change revokes old tokens', async () => {
  const res = await as(A.teacher).post('/me/password').send({ currentPassword: 'password123', newPassword: 'newpassword1' });
  expect(res.status).toBe(200);
  expect((await as(A.teacher).get('/me')).status).toBe(401);
  expect((await login('teacher.a@t.test', 'newpassword1')).status).toBe(200);
});

test('deactivated user is rejected immediately', async () => {
  expect((await as(A.admin).post(`/users/${A.teacher.user.id}/deactivate`)).status).toBe(200);
  expect((await as(A.teacher).get('/me')).status).toBe(401);
  expect((await login('teacher.a@t.test')).status).toBe(403);
});

test('admin creates a teacher and gets a temporary password once', async () => {
  const res = await as(A.admin).post('/users').send({ name: 'New T', phone: '98765 43210', role: 'teacher' });
  expect(res.status).toBe(201);
  expect(res.body.data.tempPassword).toHaveLength(10);
  const l = await login('9876543210', res.body.data.tempPassword);
  expect(l.status).toBe(200);
  expect(l.body.data.user.mustChangePassword).toBe(true);
});

test('admin cannot grant owner; teacher cannot manage users', async () => {
  expect((await as(A.admin).post('/users').send({ name: 'X', email: 'x@t.test', role: 'owner' })).status).toBe(403);
  expect((await as(A.teacher).post('/users').send({ name: 'X', email: 'x@t.test', role: 'teacher' })).status).toBe(403);
});

test('existing org user is linked to a second school instead of duplicated', async () => {
  const s2 = await m.School.create({ organizationId: A.org.id, name: 'Second' });
  await m.UserSchool.create({ userId: A.owner.user.id, schoolId: s2.id, role: 'owner' });
  const res = await as({ ...A.owner, schoolId: s2.id })
    .post('/users')
    .send({ name: 'Teacher A', email: 'teacher.a@t.test', role: 'teacher' });
  expect(res.status).toBe(201);
  expect(res.body.data.tempPassword).toBeNull();
  expect(await m.UserSchool.count({ where: { userId: A.teacher.user.id } })).toBe(2);
});
