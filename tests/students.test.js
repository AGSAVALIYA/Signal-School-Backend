const ExcelJS = require('exceljs');
const { api, as, reset, close, makeSchool, today, m } = require('./helpers');

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

describe('student list', () => {
  const names = (res) => res.body.data.map((s) => s.name.split(' ')[0]);

  test('is ordered like the register: class level, class, roll number', async () => {
    await A.s1.update({ name: 'Zeta' }); // Std 1 still comes before Std 2 whatever the class is called
    await A.students[3].enrollment.update({ rollNumber: 1 });
    await A.students[4].enrollment.update({ rollNumber: 2 });
    expect(names(await as(A.admin).get('/students'))).toEqual(['Asha', 'Bala', 'Chitra', 'Dev', 'Esha']);
  });

  test('status filter applies within the year too', async () => {
    await as(A.admin).post(`/students/${A.students[0].student.id}/leave`).send({ date: today(), reason: 'migrated' });
    const left = await as(A.admin).get('/students?status=left');
    expect(left.body.meta.total).toBe(1);
    expect(left.body.data[0]).toMatchObject({ status: 'left', enrollment: { sectionName: 'Std 1 A' } });
    expect((await as(A.admin).get('/students?status=all')).body.meta.total).toBe(5);
  });

  test('search treats % and _ literally and pages report the full total', async () => {
    expect((await as(A.admin).get('/students?q=%25')).body.meta.total).toBe(0);
    expect(names(await as(A.admin).get('/students?q=sha'))).toEqual(['Asha', 'Esha']);
    const first = await as(A.admin).get('/students?pageSize=2');
    expect(first.body).toMatchObject({ meta: { total: 5 } });
    expect(first.body.data).toHaveLength(2);
    expect((await as(A.admin).get('/students?pageSize=2&page=9')).body).toMatchObject({ data: [], meta: { total: 5 } });
  });

  test("shows today's mark and the latest class across years", async () => {
    const rows = A.students.slice(0, 3).map((s) => ({ studentId: s.student.id, status: 'A' }));
    expect((await as(A.teacher).put(`/attendance/sections/${A.s1.id}/${today()}`).send({ rows })).status).toBe(200);
    const res = await as(A.admin).get(`/students?sectionId=${A.s1.id}`);
    expect(res.body.data.map((s) => s.todayStatus)).toEqual(['A', 'A', 'A']);
    const all = await as(A.admin).get('/students?allYears=true');
    expect(all.body.data[0]).toMatchObject({ todayStatus: null, enrollment: { sectionName: 'Std 1 A' } });
  });
});

test('a student photo gets a small square thumbnail for lists', async () => {
  const sharp = require('sharp');
  const png = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#3a7' } })
    .png()
    .toBuffer();
  const id = A.students[0].student.id;
  const up = await as(A.admin).post(`/students/${id}/photo`).attach('photo', png, { filename: 'p.png', contentType: 'image/png' });
  expect(up.status).toBe(200);
  const [row] = (await as(A.admin).get(`/students?sectionId=${A.s1.id}`)).body.data;
  expect(row.thumbUrl).toMatch(/\.thumb\.jpg\?/);
  expect(row.photoUrl).toBeUndefined();
  const thumb = await api().get(row.thumbUrl).buffer(true);
  expect(thumb.status).toBe(200);
  expect(await sharp(thumb.body).metadata()).toMatchObject({ format: 'jpeg', width: 160, height: 160 });
  const full = (await as(A.admin).get(`/students/${id}`)).body.data;
  expect(await sharp((await api().get(full.photoUrl).buffer(true)).body).metadata()).toMatchObject({ width: 1024 });
  // Replacing the photo removes the old photo and its thumbnail.
  await as(A.admin).post(`/students/${id}/photo`).attach('photo', png, { filename: 'p.png', contentType: 'image/png' });
  expect((await api().get(row.thumbUrl)).status).toBe(404);
  expect((await api().get(full.photoUrl)).status).toBe(404);
});
