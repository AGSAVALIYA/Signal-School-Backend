const router = require('express').Router();
const { z } = require('zod');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const validate = require('../../middlewares/validate');
const { requirePerm, yearScope } = require('../../middlewares/auth');
const m = require('../../db/models');
const svc = require('./attendance.service');
const audit = require('../../utils/audit');
const { findInSchool, assertSectionWrite } = require('../../utils/scope');
const { ISO } = require('../../utils/dates');

const params = z.object({ sectionId: z.coerce.number().int(), date: z.string().regex(ISO) });

router.get('/attendance/sections/:sectionId/:date', validate({ params }), async (req, res) => {
  const section = await findInSchool(m.ClassSection, req.v.params.sectionId, req);
  res.json({ data: await svc.getSheet(req, section, req.v.params.date) });
});

router.put(
  '/attendance/sections/:sectionId/:date',
  requirePerm('attendance.write'),
  validate({
    params,
    body: z.object({
      rows: z.array(z.object({ studentId: z.number().int(), status: z.enum(['P', 'A', 'L', 'LATE']), remark: z.string().max(200).nullish() })).max(500),
      clientMarkedAt: z.string().datetime().optional(),
    }),
  }),
  async (req, res) => {
    const section = await findInSchool(m.ClassSection, req.v.params.sectionId, req);
    await assertSectionWrite(req, section.id);
    await svc.saveSheet(req, section, req.v.params.date, req.v.body.rows, req.v.body.clientMarkedAt);
    const absent = req.v.body.rows.filter((r) => r.status === 'A').length;
    await audit(req, 'attendance.save', {
      entityType: 'section',
      entityId: section.id,
      summary: `${section.name} ${req.v.params.date}: ${req.v.body.rows.length - absent} present/late/leave, ${absent} absent`,
    });
    res.json({ data: await svc.getSheet(req, section, req.v.params.date) });
  },
);

router.get('/attendance/today', yearScope(), async (req, res) => res.json({ data: await svc.today(req, req.year.id) }));

router.get(
  '/attendance/register',
  requirePerm('reports.view'),
  validate({
    query: z
      .object({ sectionId: z.coerce.number().int(), month: z.string().regex(/^\d{4}-\d{2}$/), format: z.enum(['json', 'xlsx']).default('json') })
      .passthrough(),
  }),
  async (req, res) => {
    const section = await findInSchool(m.ClassSection, req.v.query.sectionId, req);
    const data = await svc.register(req, section, req.v.query.month);
    if (req.v.query.format === 'json') return res.json({ data });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`${section.name} ${data.month}`.slice(0, 31));
    ws.addRow(['Roll', 'GR', 'Name', ...data.days.map((d) => Number(d.date.slice(8))), 'P', 'A', 'L', '%']);
    ws.getRow(1).font = { bold: true };
    data.students.forEach((s) =>
      ws.addRow([
        s.rollNumber,
        s.grNumber,
        s.name,
        ...data.days.map((d) => (d.off ? 'H' : s.statuses[d.date] || '')),
        s.totals.present,
        s.totals.absent,
        s.totals.leave,
        s.totals.percent,
      ]),
    );
    ws.addRow(['', '', 'Present', ...data.days.map((d) => (d.off ? '' : data.dayTotals[d.date]))]);
    ws.getColumn(3).width = 28;
    return res
      .attachment(`attendance-${section.name}-${data.month}.xlsx`)
      .type('xlsx')
      .send(Buffer.from(await wb.xlsx.writeBuffer()));
  },
);

// ---- Holidays ----
router.get('/holidays', validate({ query: z.object({ from: z.string().regex(ISO), to: z.string().regex(ISO) }) }), async (req, res) => {
  res.json({
    data: await m.Holiday.findAll({ where: { schoolId: req.school.id, date: { [Op.between]: [req.v.query.from, req.v.query.to] } }, order: [['date', 'ASC']] }),
  });
});

router.post(
  '/holidays',
  requirePerm('structure.manage'),
  validate({
    body: z.object({ date: z.string().regex(ISO), name: z.string().trim().min(1).max(100), type: z.enum(['holiday', 'exam', 'event']).default('holiday') }),
  }),
  async (req, res) => {
    const row = await m.Holiday.create({ ...req.v.body, schoolId: req.school.id });
    await audit(req, 'holiday.create', { entityType: 'holiday', entityId: row.id, summary: `${row.date} ${row.name}` });
    res.status(201).json({ data: row });
  },
);

router.delete('/holidays/:id', requirePerm('structure.manage'), async (req, res) => {
  await (await findInSchool(m.Holiday, req.params.id, req)).destroy();
  res.status(204).end();
});

module.exports = router;
