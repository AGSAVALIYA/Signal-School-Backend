// Load test of a school morning against a running API: teachers log in, open their home screen, take attendance for
// their class and look at the class list, while the office and principal use the dashboard, registers, searches and
// children's profiles. Runs stages of increasing virtual users (no waiting between requests: each user is a
// worst-case busy phone) and prints latency per kind of request and the throughput reached.
//
// Setup: a database seeded with `npm run db:seed:perf` (1,200 children, 24 classes), the API started with
// NODE_ENV=production and API_RATE_LIMIT / LOGIN_RATE_LIMIT raised. Then:
//   LOAD_URL=http://localhost:3000 node scripts/loadtest.js [seconds per stage] [users,users,...]
const BASE = (process.env.LOAD_URL || 'http://localhost:3000') + '/api/v1';
const SECONDS = Number(process.argv[2] || 15);
const STAGES = (process.argv[3] || '10,25,50,100').split(',').map(Number);
const PASSWORD = 'password123';

const stats = new Map();
let failures = 0;
const record = (name, ms, ok) => {
  if (!stats.has(name)) stats.set(name, []);
  stats.get(name).push(ms);
  if (!ok) failures += 1;
};

async function call(name, method, path, token, body) {
  const t = performance.now();
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'content-type': 'application/json', 'accept-encoding': 'gzip', ...(token && { authorization: `Bearer ${token}` }) },
      body: body && JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    record(name, performance.now() - t, res.ok);
    if (!res.ok && process.env.LOAD_VERBOSE) console.error(name, res.status, data?.error?.code);
    return data?.data;
  } catch (err) {
    record(name, performance.now() - t, false);
    if (process.env.LOAD_VERBOSE) console.error(name, err.message);
    return null;
  }
}

const login = async (identifier) => (await call('login', 'POST', '/auth/login', null, { identifier, password: PASSWORD }))?.accessToken;

// The latest school day (Mon–Sat) on or before today, so attendance can be saved whatever day the test runs.
function schoolDay() {
  const d = new Date();
  while (d.getDay() === 0) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function teacherRound(ctx, i) {
  const { token, sections, date } = ctx;
  const section = sections[i % sections.length];
  await call('teacher home', 'GET', '/today', token);
  const sheet = await call('attendance sheet', 'GET', `/attendance/sections/${section.id}/${date}`, token);
  if (sheet?.rows?.length) {
    const rows = sheet.rows.map((r, n) => ({ studentId: r.studentId, status: (n + i) % 9 === 0 ? 'A' : 'P' }));
    await call('save attendance', 'PUT', `/attendance/sections/${section.id}/${date}`, token, { rows, clientMarkedAt: new Date().toISOString() });
  }
  await call('class list', 'GET', `/students?sectionId=${section.id}&pageSize=50`, token);
  await call('syllabus progress', 'GET', '/syllabus/progress', token);
}

async function officeRound(ctx, i) {
  const { token, sections, students, month } = ctx;
  const student = students[i % students.length];
  await call('dashboard', 'GET', '/dashboard', token);
  await call('attendance today', 'GET', '/attendance/today', token);
  await call('student search', 'GET', `/students?q=${encodeURIComponent(student.name.split(' ')[0])}&pageSize=50`, token);
  await call('student profile', 'GET', `/students/${student.id}`, token);
  await call('student history', 'GET', `/students/${student.id}/history`, token);
  if (i % 4 === 0) await call('monthly register', 'GET', `/attendance/register?sectionId=${sections[i % sections.length].id}&month=${month}`, token);
}

async function stage(users, ctx) {
  stats.clear();
  failures = 0;
  const end = Date.now() + SECONDS * 1000;
  const started = performance.now();
  let rounds = 0;
  // 70% of users are teachers taking attendance, the rest office/principal.
  await Promise.all(
    Array.from({ length: users }, async (_, u) => {
      let i = u;
      while (Date.now() < end) {
        if (u % 10 < 7) await teacherRound(ctx, i);
        else await officeRound(ctx, i);
        i += users;
        rounds += 1;
      }
    }),
  );
  const seconds = (performance.now() - started) / 1000;
  const pct = (list, p) => list[Math.min(list.length - 1, Math.floor((p / 100) * list.length))];
  const rows = [...stats].map(([name, list]) => {
    list.sort((a, b) => a - b);
    return { request: name, count: list.length, 'p50 ms': Math.round(pct(list, 50)), 'p95 ms': Math.round(pct(list, 95)), 'p99 ms': Math.round(pct(list, 99)) };
  });
  const total = rows.reduce((n, r) => n + r.count, 0);
  console.log(`\n${users} users for ${seconds.toFixed(0)} s: ${Math.round(total / seconds)} requests/s, ${rounds} rounds, ${failures} failed`);
  console.table(rows);
  return { users, rps: Math.round(total / seconds), failures, rows };
}

async function main() {
  const owner = process.env.LOAD_USER || 'owner@perf.test';
  // Login burst: the whole staff opening the app at 9 a.m.
  stats.clear();
  const t = performance.now();
  const tokens = await Promise.all(Array.from({ length: 40 }, () => login(owner)));
  const list = stats.get('login').sort((a, b) => a - b);
  console.log(`40 logins at once: all done in ${Math.round(performance.now() - t)} ms (p50 ${Math.round(list[20])} ms, slowest ${Math.round(list.at(-1))} ms)`);
  const token = tokens.find(Boolean);
  if (!token) throw new Error(`login failed for ${owner}`);

  const sections = await call('setup', 'GET', '/sections', token);
  const students = await call('setup', 'GET', '/students?pageSize=200', token);
  const ctx = { token, sections, students, date: schoolDay(), month: new Date().toISOString().slice(0, 7) };
  const summary = [];
  for (const users of STAGES) summary.push(await stage(users, ctx));
  console.log('\nSummary');
  console.table(
    summary.map((s) => ({
      users: s.users,
      'requests/s': s.rps,
      failed: s.failures,
      'save attendance p95 ms': s.rows.find((r) => r.request === 'save attendance')?.['p95 ms'],
      'dashboard p95 ms': s.rows.find((r) => r.request === 'dashboard')?.['p95 ms'],
      'worst p95 ms': Math.max(...s.rows.map((r) => r['p95 ms'])),
    })),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
