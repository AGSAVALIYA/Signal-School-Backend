// Benchmarks the busiest read endpoints against a running API (use with `npm run db:seed:perf`).
// Usage: BENCH_URL=http://localhost:3100 node scripts/bench.js [seconds]
const autocannon = require('autocannon');

const BASE = process.env.BENCH_URL || 'http://localhost:3000';
const SECONDS = Number(process.argv[2] || 6);

async function main() {
  const login = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: process.env.BENCH_USER || 'owner@perf.test', password: 'password123' }),
  }).then((r) => r.json());
  const token = login.data.accessToken;
  const get = (p) => fetch(`${BASE}/api/v1${p}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  const sections = (await get('/sections')).data;
  const student = (await get('/students?pageSize=1')).data[0];
  const subject = sections[0].Subjects[0];
  const month = new Date().toISOString().slice(0, 7);
  const paths = {
    'students list (50)': '/students?pageSize=50',
    'student search': '/students?q=Pawar&pageSize=50',
    'student profile': `/students/${student.id}`,
    'student history': `/students/${student.id}/history`,
    'student month': `/students/${student.id}/attendance?month=${month}`,
    'attendance sheet': `/attendance/sections/${sections[0].id}/${new Date().toISOString().slice(0, 10)}`,
    'attendance today': '/attendance/today',
    'register (month)': `/attendance/register?sectionId=${sections[0].id}&month=${month}`,
    dashboard: '/dashboard',
    'teacher home': '/today',
    'syllabus progress': '/syllabus/progress',
    'marks grid': `/marks?subjectId=${subject.id}&term=S1`,
    'report card': `/report-cards/${student.id}?term=S1`,
    'diary (student)': `/diary/students/${student.id}`,
    sections: '/sections',
  };
  const rows = [];
  for (const [name, path] of Object.entries(paths)) {
    const r = await autocannon({
      url: `${BASE}/api/v1${path}`,
      connections: 10,
      duration: SECONDS,
      headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'gzip' },
    });
    const res = await fetch(`${BASE}/api/v1${path}`, { headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'gzip' } });
    const bytes = Number(res.headers.get('content-length')) || (await res.arrayBuffer()).byteLength;
    rows.push({
      endpoint: name,
      'req/s': Math.round(r.requests.average),
      'p50 ms': r.latency.p50,
      'p99 ms': r.latency.p99,
      errors: r.non2xx + r.errors,
      'bytes on wire': bytes,
      gzip: res.headers.get('content-encoding') || '-',
    });
  }
  console.table(rows);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
