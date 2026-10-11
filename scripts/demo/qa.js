// Fixed people for manual testing (`npm run db:seed:qa`). The web app's manual-qa/ test cases and guide name these
// children and logins, so keep them in step when changing anything here.
const { addDays } = require('../../src/utils/dates');

// Children of Signal Shala, Thane, each set up for some test cases. gradeIndex: 0 = Balwadi, 1 = Std 1, …
function kids(years, today) {
  const cur = years.length - 1;
  const prev = cur - 1;
  const start = years[cur].startDate;
  const kid = (name, gender, gradeIndex, row, extra = {}) => ({
    name,
    gender,
    lang: 'mr',
    ability: 0.7,
    absentRate: 4,
    dob: `${Number(start.slice(0, 4)) - 5 - gradeIndex}-03-12`,
    approxDob: false,
    admissionDate: start,
    enrollments: [{ yearIndex: cur, gradeIndex, enrolledOn: start, status: 'active' }],
    status: 'active',
    ...extra,
    qa: { photo: true, ...extra.qa, row: { guardianRelation: 'Father', guardianLanguage: 'mr', ...row } },
  });
  // In school since last year: Balwadi then Std 1 (shows "Past years").
  const riya = kid('Riya Kale', 'F', 1, { guardianName: 'Sunil Kale', guardianPhone: '9123400001', address: 'Teen Hath Naka, Thane' });
  const before = { yearIndex: prev, gradeIndex: 0, enrolledOn: years[prev].startDate, exitedOn: years[prev].endDate, status: 'promoted' };
  Object.assign(riya, { admissionDate: years[prev].startDate, enrollments: [before, { ...riya.enrollments[0], previous: before }] });

  // Born on today's date (birthday on the dashboard); a valid year for 29 February too.
  const valid = (d) => !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
  let y = Number(today.slice(0, 4)) - 7;
  while (!valid(`${y}${today.slice(4)}`)) y -= 1;

  const lataStart = years[prev].startDate;
  const lataLeft = addDays(lataStart, 120);
  return [
    riya,
    kid(
      'Aryan Mhatre',
      'M',
      1,
      { guardianName: 'Kavita Mhatre', guardianRelation: 'Mother', guardianPhone: '9123400002', consentPhoto: true },
      { qa: { photo: false } },
    ),
    kid('Ishaan Jagtap', 'M', 2, { guardianName: 'Ramesh Jagtap', guardianPhone: '9123400003' }, { dob: `${y}${today.slice(4)}` }),
    kid(
      'Swati Gholap',
      'F',
      2,
      { guardianName: 'Anil Gholap', guardianPhone: '9123400005' },
      { qa: { followUp: 'Eyes: cannot read the board. Needs an eye test.' } },
    ),
    kid('Nikhil Sonawane', 'M', 3, { guardianName: 'Manda Sonawane', guardianRelation: 'Mother', guardianPhone: '9123400006' }),
    // Often absent, and absent for the last school days (both dashboard lists).
    kid(
      'Kiran Thakur',
      'F',
      4,
      { guardianName: 'Sangita Thakur', guardianRelation: 'Mother', guardianPhone: '9123400004' },
      { absentRate: 30, qa: { streak: true } },
    ),
    // Left last year: found with "Search all years", can be re-admitted.
    kid(
      'Lata Bhalerao',
      'F',
      2,
      { guardianName: 'Vimal Bhalerao', guardianRelation: 'Mother', guardianPhone: '9123400007' },
      {
        admissionDate: lataStart,
        enrollments: [{ yearIndex: prev, gradeIndex: 2, enrolledOn: lataStart, exitedOn: lataLeft, status: 'left' }],
        status: 'left',
        leftOn: lataLeft,
        leftReason: 'migrated',
        leftNote: 'Family went back to the village (Solapur).',
        qa: { photo: true },
      },
    ),
  ];
}

// Extra logins: a new teacher who must choose a password at first login (no class yet) and an inactive one.
const USERS = [
  { name: 'Neha Joshi', email: 'newteacher@demo.test', phone: '9820000011', password: 'Welcome@123', mustChangePassword: true, status: 'active' },
  { name: 'Deepak Rane', email: 'inactive@demo.test', phone: '9820000012', password: 'password123', mustChangePassword: false, status: 'inactive' },
];

module.exports = { kids, USERS };
