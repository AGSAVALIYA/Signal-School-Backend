const ExcelJS = require('exceljs');
const { Readable } = require('stream');

// Column keys accepted in uploaded sheets (header row, case/space-insensitive).
const COLUMNS = [
  'name',
  'class',
  'gender',
  'date_of_birth',
  'approx_age',
  'guardian_name',
  'guardian_phone',
  'father_name',
  'mother_name',
  'address',
  'gr_number',
  'admission_date',
];
const REQUIRED = ['name', 'class'];
const GENDER = { f: 'F', female: 'F', girl: 'F', m: 'M', male: 'M', boy: 'M', o: 'O', other: 'O' };

const norm = (h) =>
  String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/[\s-]+/g, '_');

function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') return String(v.text ?? v.result ?? v.richText?.map((r) => r.text).join('') ?? '');
  return String(v).trim();
}

// Accepts DD/MM/YYYY, DD-MM-YYYY or YYYY-MM-DD; returns ISO or null.
function parseDate(text) {
  if (!text) return null;
  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return validDay(Number(m[1]), Number(m[2]), Number(m[3]));
  m = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return undefined;
  return validDay(Number(m[3]), Number(m[2]), Number(m[1]));
}

// Rejects impossible days such as 31/02/2020 (Date would silently roll them into March).
function validDay(y, mo, d) {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return undefined;
  return dt.toISOString().slice(0, 10);
}

async function readSheet(file) {
  const wb = new ExcelJS.Workbook();
  const isCsv = /csv|text\/plain/.test(file.mimetype) || /\.csv$/i.test(file.originalname);
  const ws = isCsv
    ? await wb.csv.read(Readable.from(file.buffer.toString('utf8').replace(/^\uFEFF/, '')))
    : (await wb.xlsx.load(file.buffer), wb.worksheets[0]);
  const rows = [];
  let headers = null;
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values.slice(1).map(cellText);
    if (!headers) {
      headers = values.map(norm);
      return;
    }
    if (values.every((v) => !v)) return;
    rows.push(Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
  });
  return rows;
}

// Turns raw sheet rows into validated student payloads with per-row error codes.
function validateRows(rawRows, sections, currentYear = new Date().getUTCFullYear()) {
  const byName = new Map(sections.map((s) => [s.name.trim().toLowerCase(), s]));
  const seenGr = new Set();
  return rawRows.map((r, index) => {
    const errors = {};
    for (const key of REQUIRED) if (!r[key]) errors[key] = 'REQUIRED';
    const section = r.class ? byName.get(r.class.trim().toLowerCase()) : null;
    if (r.class && !section) errors.class = 'UNKNOWN_CLASS';
    const gender = r.gender ? GENDER[r.gender.trim().toLowerCase()] : null;
    if (r.gender && !gender) errors.gender = 'INVALID';
    const dob = parseDate(r.date_of_birth);
    if (dob === undefined) errors.date_of_birth = 'INVALID_DATE';
    const admissionDate = parseDate(r.admission_date);
    if (admissionDate === undefined) errors.admission_date = 'INVALID_DATE';
    const age = r.approx_age ? Number(r.approx_age) : null;
    if (r.approx_age && !(age > 0 && age < 30)) errors.approx_age = 'INVALID';
    const phone = r.guardian_phone ? r.guardian_phone.replace(/[^\d+]/g, '') : null;
    if (phone && !/^\+?\d{8,15}$/.test(phone)) errors.guardian_phone = 'INVALID';
    const gr = r.gr_number || null;
    if (gr && seenGr.has(gr)) errors.gr_number = 'DUPLICATE';
    if (gr) seenGr.add(gr);
    return {
      row: index + 2,
      errors,
      data: {
        name: r.name,
        classSectionId: section?.id,
        className: section?.name || r.class,
        gender,
        dob: dob || null,
        dobIsApproximate: !dob && Boolean(age),
        estimatedBirthYear: !dob && age ? currentYear - age : null,
        guardianName: r.guardian_name || null,
        guardianPhone: phone,
        fatherName: r.father_name || null,
        motherName: r.mother_name || null,
        address: r.address || null,
        grNumber: gr,
        admissionDate: admissionDate || null,
      },
    };
  });
}

async function template(sectionNames, labels = {}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Students');
  ws.addRow(COLUMNS.map((c) => (REQUIRED.includes(c) ? `${c}*` : c)));
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((c) => {
    c.width = 18;
  });
  // The example lives on the help sheet only, so it can never be imported by mistake.
  const help = wb.addWorksheet(labels.help || 'Help');
  help.addRow(['Example row (copy the layout, not the data):']);
  help.addRow(['Asha Pawar', sectionNames[0] || 'Std 1 A', 'F', '15/06/2018', '', 'Sunita Pawar', '9876543210', '', '', 'Thane', '', '']);
  help.addRow([]);
  help.addRow(['Classes you can use:']);
  sectionNames.forEach((n) => help.addRow([n]));
  help.addRow([]);
  help.addRow(['gender: F / M / O. Dates: DD/MM/YYYY. If date of birth is unknown, fill approx_age. Leave gr_number empty to number automatically.']);
  return wb.xlsx.writeBuffer();
}

module.exports = { readSheet, validateRows, template, COLUMNS, parseDate };
