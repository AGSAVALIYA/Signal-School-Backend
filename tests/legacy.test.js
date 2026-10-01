const bcrypt = require('bcryptjs');
const { reset, close, m } = require('./helpers');
const { migrateLegacy, gradeOrder } = require('../scripts/migrate-legacy');

const ts = `"createdAt" timestamptz default now(), "updatedAt" timestamptz default now()`;
const DDL = `
DROP TABLE IF EXISTS "Organizations","Schools","Admins","Teachers","TeacherSchool","AcademicYears","Classes","Subjects","Students","Attendances","StudentTimelines","SubjectStudentTimeline","Chapters","Topics","Reports","CommonSubjects","StudentCommonSubject" CASCADE;
CREATE TABLE "Organizations"(id serial primary key, name text, "headOffice" text, "contactNumber" text, ${ts});
CREATE TABLE "Schools"(id serial primary key, name text, address text, "contactNumber" text, location text, "currentAcademicYear" int, "OrganizationId" int, ${ts});
CREATE TABLE "Admins"(id serial primary key, name text, email text, password text, "currentSchool" int, "OrganizationId" int, ${ts});
CREATE TABLE "Teachers"(id serial primary key, name text, email text, password text, "imageLink" text, "contactNumber" text, "currentSchool" int, status text, ${ts});
CREATE TABLE "TeacherSchool"("TeacherId" int, "SchoolId" int, ${ts});
CREATE TABLE "AcademicYears"(id serial primary key, name text, "startDate" timestamptz, "endDate" timestamptz, "SchoolId" int, ${ts});
CREATE TABLE "Classes"(id serial primary key, name text, "SchoolId" int, "AcademicYearId" int, ${ts});
CREATE TABLE "Subjects"(id serial primary key, name text, "ClassId" int, "AcademicYearId" int, "SchoolId" int, ${ts});
CREATE TABLE "Students"(id serial primary key, name text, age int, dob date, address text, "GRNumber" text, "imageLink" text, "aadharNumber" text, "panCardNumber" text, "fatherName" text, "motherName" text, "contactNumber_1" text, "contactNumber_2" text, gender text, "bloodGroup" text, "AcademicYearId" int, "ClassId" int, "SchoolId" int, ${ts});
CREATE TABLE "Attendances"(id serial primary key, date date, "studentId" int, "classId" int, "schoolId" int, status text, ${ts});
CREATE TABLE "StudentTimelines"(id serial primary key, date date, progress text, "attendanceStatus" text, image text, "StudentId" int, ${ts});
CREATE TABLE "SubjectStudentTimeline"("SubjectId" int, "StudentTimelineId" int, ${ts});
CREATE TABLE "Chapters"(id serial primary key, name text, "SubjectId" int, ${ts});
CREATE TABLE "Topics"(id serial primary key, content text, "completedDate" date, "ChapterId" int, "completedBy" int, ${ts});
CREATE TABLE "Reports"(id serial primary key, "reportType" text, content text, grade text, "GRNumber" text, "StudentId" int, "SubjectId" int, "ClassId" int, "AcademicYearId" int, ${ts});
CREATE TABLE "CommonSubjects"(id serial primary key, name text, "AcademicYearId" int, "SchoolId" int, ${ts});
CREATE TABLE "StudentCommonSubject"("StudentId" int, "CommonSubjectId" int, ${ts});
`;

beforeAll(async () => {
  await reset();
  await m.sequelize.query(DDL);
  const pw = await bcrypt.hash('secret', 4);
  const weak = await bcrypt.hash('t1@x.test', 4);
  await m.sequelize.query(`
    INSERT INTO "Organizations"(name) VALUES ('Trust');
    INSERT INTO "Schools"(name, location, "currentAcademicYear", "OrganizationId") VALUES ('Old School', 'Thane', 2, 1);
    INSERT INTO "Admins"(name, email, password, "OrganizationId") VALUES ('Admin', 'admin@x.test', '${pw}', 1);
    INSERT INTO "Teachers"(name, email, password, "currentSchool", status) VALUES ('T1', 't1@x.test', '${weak}', 1, 'active');
    INSERT INTO "TeacherSchool" VALUES (1, 1);
    INSERT INTO "AcademicYears"(name, "startDate", "endDate", "SchoolId") VALUES ('2024-25', '2024-06-01', '2025-04-30', 1), ('2025-26', '2025-06-01', '2026-04-30', 1);
    INSERT INTO "Classes"(name, "SchoolId", "AcademicYearId") VALUES ('Std 1', 1, 1), ('Std 2', 1, 2), ('Std 10', 1, 2), ('Balwadi', 1, 2), ('Orphan', 1, NULL);
    INSERT INTO "Subjects"(name, "ClassId", "AcademicYearId", "SchoolId") VALUES ('Maths', 1, 1, 1), ('Maths', 2, 2, 1);
    -- Ravi studied 2 years (promoted copy); Sita and Gita share a GR but have different DOBs.
    INSERT INTO "Students"(name, age, dob, "GRNumber", "AcademicYearId", "ClassId", "SchoolId", "fatherName", "aadharNumber", gender) VALUES
      ('Ravi', 6, '2018-01-01', 'SCH1-1', 1, 1, 1, 'Father R', '123412341234', 'Male'),
      ('Ravi', 7, '2018-01-01', 'SCH1-1', 2, 2, 1, NULL, NULL, 'Male'),
      ('Sita', 8, '2017-02-02', 'SCH1-2', 2, 3, 1, NULL, NULL, 'Female'),
      ('Gita', 8, '2016-03-03', 'SCH1-2', 2, 3, 1, NULL, NULL, 'Female');
    INSERT INTO "Attendances"(date, "studentId", "classId", "schoolId", status) VALUES ('2025-07-01', 2, 2, 1, 'present'), ('2025-07-02', 2, 2, 1, 'absent'), ('2024-07-01', 1, 1, 1, 'present');
    INSERT INTO "StudentTimelines"(date, progress, "attendanceStatus", "StudentId") VALUES ('2025-07-01', 'Read', 'present', 2), ('2025-07-01', 'Wrote', 'present', 2);
    INSERT INTO "Chapters"(name, "SubjectId") VALUES ('Numbers', 2);
    INSERT INTO "Topics"(content, "completedDate", "ChapterId", "completedBy") VALUES ('Counting', '2025-07-01', 1, 1), ('Adding', NULL, 1, NULL);
    INSERT INTO "Reports"("reportType", content, grade, "StudentId", "SubjectId", "AcademicYearId") VALUES ('s1', 'ok', 'B', 2, 2, 2), ('s1', 'better', 'A', 2, 2, 2);
    INSERT INTO "CommonSubjects"(name, "AcademicYearId", "SchoolId") VALUES ('Dance', 2, 1);
    INSERT INTO "StudentCommonSubject" VALUES (2, 1);
  `);
});
afterAll(close);

test('grade order puts unnumbered grades first and numbers numerically', () => {
  expect(gradeOrder(['Std 10', 'Std 2', 'Balwadi', 'Std 1'])).toEqual(['Balwadi', 'Std 1', 'Std 2', 'Std 10']);
});

test('dry run changes nothing', async () => {
  const r = await migrateLegacy({ apply: false });
  expect(r.counts.students).toBe(3);
  expect(await m.Organization.count()).toBe(0);
});

test('apply merges yearly copies, keeps different children apart and preserves history', async () => {
  const r = await migrateLegacy({ apply: true });
  expect(r.counts).toMatchObject({ legacyStudentRows: 4, students: 3, enrollments: 4, completions: 1, studentsNeedingReview: 1 });
  const ravi = await m.Student.findOne({ where: { name: 'Ravi' } });
  expect(ravi).toMatchObject({ fatherName: 'Father R', aadhaarLast4: '1234', gender: 'M' });
  const enr = await m.Enrollment.findAll({ where: { studentId: ravi.id }, order: [['id', 'ASC']] });
  expect(enr.map((e) => e.status)).toEqual(['promoted', 'active']);
  expect(await m.Attendance.count({ where: { studentId: ravi.id } })).toBe(3);
  expect((await m.DailyLog.findOne({ where: { studentId: ravi.id } })).note).toBe('Read\nWrote');
  expect((await m.Student.findAll({ where: { name: ['Sita', 'Gita'] } })).map((s) => s.grNumber).sort()).toEqual(['SCH1-2', 'SCH1-2-2']);
  expect((await m.ReportEntry.findOne()).grade).toBe('A');
  expect((await m.User.findOne({ where: { email: 't1@x.test' } })).mustChangePassword).toBe(true);
  expect(await m.ActivityMember.count()).toBe(1);
  expect(r.warnings.some((w) => w.includes('Orphan'))).toBe(true);
  const grades = await m.Grade.findAll({ order: [['sortOrder', 'ASC']] });
  expect(grades.map((g) => g.name)).toEqual(['Balwadi', 'Std 1', 'Std 2', 'Std 10']);
});
