const ExcelJS = require('exceljs');
const { as, reset, close, makeSchool, today, m } = require('./helpers');

let A;
beforeEach(async () => {
  await reset();
  A = await makeSchool('A');
});
afterAll(close);

test('creates a student with essentials only and an automatic GR number', async () => {
  const res = await as(A.teacher).post('/students').send({ name: 'Kavya', classSectionId: A.s1.id, guardianPhone: '9876543210' });
  expect(res.status).toBe(201);
  expect(res.body.data).toMatchObject({ grNumber: 'A-6', enrollment: { classSectionId: A.s1.id } });
});

test('parallel admissions never share a GR number', async () => {
  const results = await Promise.all(
    [1, 2, 3, 4, 5].map((i) =>
      as(A.admin)
        .post('/students')
        .send({ name: `Kid ${i}`, classSectionId: A.s1.id }),
    ),
  );
  const grs = results.map((r) => r.body.data.grNumber);
  expect(new Set(grs).size).toBe(5);
});

test('duplicate manual GR is refused with the owner name', async () => {
  const res = await as(A.admin).post('/students').send({ name: 'X', classSectionId: A.s1.id, grNumber: 'A-1' });
  expect(res.status).toBe(409);
  expect(res.body.error).toMatchObject({ code: 'GR_DUPLICATE', params: { gr: 'A-1' } });
});

test('unknown DOB with approximate age is accepted and age is derived', async () => {
  const year = new Date().getUTCFullYear();
  const res = await as(A.admin)
    .post('/students')
    .send({ name: 'Y', classSectionId: A.s1.id, dobIsApproximate: true, estimatedBirthYear: year - 8 });
  expect(res.body.data.age).toBe(8);
});

test('teacher cannot add to an unassigned section', async () => {
  expect((await as(A.teacher).post('/students').send({ name: 'Z', classSectionId: A.s2.id })).status).toBe(403);
});

test('list shows not-marked today status and filters by exact section', async () => {
  const res = await as(A.admin).get(`/students?sectionId=${A.s1.id}`);
  expect(res.body.meta.total).toBe(3);
  expect(res.body.data.every((s) => s.todayStatus === null)).toBe(true);
});

test('leave and re-admit keep history instead of deleting', async () => {
  const id = A.students[0].student.id;
  expect((await as(A.admin).post(`/students/${id}/leave`).send({ date: today(), reason: 'migrated' })).status).toBe(200);
  expect((await as(A.admin).get('/students')).body.meta.total).toBe(4);
  expect((await as(A.admin).get('/students?status=left&allYears=true')).body.meta.total).toBe(1);
  expect((await as(A.admin).post(`/students/${id}/readmit`).send({ classSectionId: A.s2.id })).status).toBe(200);
  const hist = await as(A.admin).get(`/students/${id}/history`);
  expect(hist.body.data[0]).toMatchObject({ sectionName: 'Std 2 A', status: 'active' });
});

test('teacher edits a student of own class; profile update is audited', async () => {
  const id = A.students[0].student.id;
  const res = await as(A.teacher).patch(`/students/${id}`).send({ guardianName: 'Mother', rollNumber: 9 });
  expect(res.status).toBe(200);
  expect(res.body.data).toMatchObject({ guardianName: 'Mother', enrollment: { rollNumber: 9 } });
  expect(await m.AuditLog.count({ where: { action: 'student.update' } })).toBe(1);
});

test('import preview flags bad rows and import assigns unique GR numbers', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('S');
  ws.addRow(['name*', 'class*', 'gender', 'date_of_birth', 'approx_age', 'gr_number']);
  ws.addRow(['Row One', 'Std 1 A', 'Girl', '15/06/2018', '', '']);
  ws.addRow(['Row Two', 'std 1 a', 'M', '', '7', '']);
  ws.addRow(['', 'Std 9', 'X', '31/31/2020', '', 'A-1']);
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const prev = await as(A.admin)
    .post('/students-import/preview')
    .attach('file', buf, { filename: 's.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  expect(prev.status).toBe(200);
  expect(prev.body.data).toMatchObject({ total: 3, valid: 2 });
  expect(prev.body.data.rows[2].errors).toMatchObject({
    name: 'REQUIRED',
    class: 'UNKNOWN_CLASS',
    gender: 'INVALID',
    date_of_birth: 'INVALID_DATE',
    gr_number: 'DUPLICATE',
  });
  const rows = prev.body.data.rows.filter((r) => !Object.keys(r.errors).length).map(({ data: { className: _c, ...d } }) => d);
  const res = await as(A.admin).post('/students-import').send({ rows });
  expect(res.body.data.created).toBe(2);
  const grs = (await m.Student.findAll({ where: { name: ['Row One', 'Row Two'] } })).map((s) => s.grNumber);
  expect(new Set(grs).size).toBe(2);
});

test('exports an Excel file', async () => {
  const res = await as(A.admin)
    .get('/students-export')
    .buffer(true)
    .parse((r, cb) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/spreadsheet/);
});
