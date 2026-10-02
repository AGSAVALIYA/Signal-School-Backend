// Demo data for development and manual testing. DESTROYS all existing data in the target database.
// Usage: npm run db:seed
const m = require('../src/db/models');
const { hashPassword } = require('../src/modules/auth/auth.service');
const { todayIn, addDays } = require('../src/utils/dates');

const FIRST = [
  'Aarav',
  'Bhakti',
  'Chetan',
  'Diya',
  'Esha',
  'Farhan',
  'Gauri',
  'Harsh',
  'Isha',
  'Jay',
  'Kavya',
  'Lakshmi',
  'Manoj',
  'Neha',
  'Om',
  'Pooja',
  'Rahul',
  'Sneha',
  'Tanvi',
  'Umesh',
];
const LAST = ['Pawar', 'Shinde', 'More', 'Jadhav', 'Patil', 'Kamble', 'Gaikwad', 'Sawant'];
const NATIVE = ['सुनील पवार', 'आरती शिंदे', 'ગીતા પટેલ', 'रवि कुमार'];

async function seed() {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force'))
    throw new Error('Refusing to wipe a production database (pass --force if you really mean it)');
  await m.sequelize.query(`TRUNCATE organizations RESTART IDENTITY CASCADE`);
  const pw = await hashPassword('password123');
  const org = await m.Organization.create({ name: 'Signal Trust' });
  const school = await m.School.create({ organizationId: org.id, name: 'Thane Signal School', location: 'Thane', grPrefix: 'TSS-', defaultLanguage: 'mr' });
  const mk = (name, email, role) =>
    m.User.create({ organizationId: org.id, name, email, passwordHash: pw, mustChangePassword: false }).then(async (u) => {
      await m.UserSchool.create({ userId: u.id, schoolId: school.id, role, isDefault: true });
      return u;
    });
  const owner = await mk('Meera Kulkarni', 'owner@demo.test', 'owner');
  await mk('Office Clerk', 'clerk@demo.test', 'clerk');
  const sunita = await mk('Sunita Patil', 'sunita@demo.test', 'teacher');
  const rahul = await mk('Rahul Verma', 'rahul@demo.test', 'teacher');

  const gradeNames = ['Balwadi', 'Std 1', 'Std 2', 'Std 3', 'Std 4'];
  const grades = [];
  for (const [i, name] of gradeNames.entries())
    grades.push(await m.Grade.create({ schoolId: school.id, name, sortOrder: i, isFinal: i === gradeNames.length - 1 }));
  for (let i = 0; i < grades.length - 1; i += 1) await grades[i].update({ nextGradeId: grades[i + 1].id });

  const today = todayIn(school.timezone);
  const y = Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 6 ? 1 : 0);
  const prev = await m.AcademicYear.create({
    schoolId: school.id,
    name: `${y - 1}-${String(y).slice(2)}`,
    startDate: `${y - 1}-06-01`,
    endDate: `${y}-04-30`,
    status: 'closed',
  });
  const year = await m.AcademicYear.create({
    schoolId: school.id,
    name: `${y}-${String(y + 1).slice(2)}`,
    startDate: `${y}-06-01`,
    endDate: `${y + 1}-04-30`,
    status: 'active',
  });

  let gr = 1;
  const subjectNames = ['Marathi', 'English', 'Maths'];
  for (const ay of [prev, year]) {
    for (const g of grades) {
      const section = await m.ClassSection.create({ schoolId: school.id, academicYearId: ay.id, gradeId: g.id, name: `${g.name} A`, sortOrder: 0 });
      for (const [si, sn] of subjectNames.entries()) {
        const subject = await m.Subject.create({ schoolId: school.id, academicYearId: ay.id, classSectionId: section.id, name: sn, sortOrder: si });
        for (let c = 1; c <= 3; c += 1) {
          const ch = await m.Chapter.create({ schoolId: school.id, subjectId: subject.id, name: `${sn} chapter ${c}`, sortOrder: c });
          for (let t = 1; t <= 4; t += 1) {
            const topic = await m.Topic.create({ schoolId: school.id, chapterId: ch.id, content: `Topic ${c}.${t}`, sortOrder: t });
            if (ay === prev || (c === 1 && t <= 2))
              await m.TopicCompletion.create({ schoolId: school.id, topicId: topic.id, completedBy: sunita.id, completedOn: ay === prev ? ay.endDate : today });
          }
        }
        if (ay === year && g.name === 'Std 1')
          await m.TeacherAssignment.create({
            schoolId: school.id,
            academicYearId: ay.id,
            userId: rahul.id,
            classSectionId: section.id,
            subjectId: subject.id,
            role: 'subject_teacher',
          });
      }
      if (ay === year && g.name === 'Std 1')
        await m.TeacherAssignment.create({ schoolId: school.id, academicYearId: ay.id, userId: sunita.id, classSectionId: section.id, role: 'class_teacher' });
      if (ay !== year) continue;
      for (let n = 0; n < 12; n += 1) {
        const name = n < NATIVE.length && g.name === 'Std 1' ? NATIVE[n] : `${FIRST[(n + g.id * 3) % FIRST.length]} ${LAST[(n + g.id) % LAST.length]}`;
        const st = await m.Student.create({
          schoolId: school.id,
          grNumber: `TSS-${gr++}`,
          name,
          gender: n % 2 ? 'M' : 'F',
          dob: `${y - 6 - g.sortOrder}-0${(n % 9) + 1}-1${n % 9}`,
          guardianName: `Parent of ${name}`,
          guardianPhone: `98765${String(43210 + n + g.id * 100).padStart(5, '0')}`,
          admissionDate: year.startDate,
        });
        await m.Enrollment.create({
          schoolId: school.id,
          academicYearId: year.id,
          studentId: st.id,
          classSectionId: section.id,
          rollNumber: n + 1,
          enrolledOn: year.startDate,
        });
        for (let d = 1; d <= 10; d += 1) {
          const date = addDays(today, -d);
          if (date < year.startDate || new Date(`${date}T00:00:00Z`).getUTCDay() === 0) continue;
          const enrollment = await m.Enrollment.findOne({ where: { studentId: st.id, academicYearId: year.id } });
          await m.Attendance.create({
            schoolId: school.id,
            academicYearId: year.id,
            enrollmentId: enrollment.id,
            studentId: st.id,
            classSectionId: section.id,
            date,
            status: (n + d) % 7 === 0 ? 'A' : 'P',
            markedBy: sunita.id,
            markedAt: new Date(),
          });
        }
      }
    }
  }
  await m.sequelize.query(`
    INSERT INTO attendance_sessions (school_id, academic_year_id, class_section_id, date, submitted_by, present_count, absent_count)
    SELECT school_id, academic_year_id, class_section_id, date, max(marked_by), count(*) FILTER (WHERE status = 'P'), count(*) FILTER (WHERE status = 'A')
    FROM attendance GROUP BY 1, 2, 3, 4`);
  await school.update({ nextGrNumber: gr });
  console.log(
    `Seeded. Logins (password "password123"): owner@demo.test, clerk@demo.test, sunita@demo.test (class teacher Std 1 A), rahul@demo.test. Owner id ${owner.id}`,
  );
}

seed()
  .then(() => m.sequelize.close())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
