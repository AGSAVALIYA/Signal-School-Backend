// One-time migration from the v1 schema (PascalCase tables created by sequelize.sync) to v2.
// Dry run by default: everything runs inside a transaction that is rolled back, and a report is written.
//   npm run migrate-legacy                 → dry run, writes legacy-migration-<time>/report.json + review CSVs
//   npm run migrate-legacy -- --apply      → same, but commits
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { QueryTypes } = require('sequelize');
const m = require('../src/db/models');

const norm = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
const numberIn = (s) => (String(s).match(/\d+/) ? Number(String(s).match(/\d+/)[0]) : -1);
const last4 = (a) => (a && /\d{4}$/.test(String(a).replace(/\s/g, '')) ? String(a).replace(/\s/g, '').slice(-4) : null);
const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

// Grade order: names without numbers (Balwadi, Nursery) first, then by the number in the name.
const gradeOrder = (names) => [...names].sort((a, b) => numberIn(a) - numberIn(b) || a.localeCompare(b));

async function migrateLegacy({ apply = false, outDir } = {}) {
  const q = (sql, replacements, transaction) => m.sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction });
  const report = { counts: {}, warnings: [] };
  const review = [['legacy_student_id', 'school_id', 'gr_number', 'name', 'reason', 'resolution']];
  const warn = (w) => report.warnings.push(w);
  const gradeCsv = [['school_id', 'legacy_class_name', 'grade', 'sort_order']];
  const transaction = await m.sequelize.transaction();
  try {
    if ((await m.Organization.count({ transaction })) > 0) throw new Error('v2 tables already contain data; migrate into an empty v2 schema');
    const L = async (table) => q(`SELECT * FROM "${table}"`, {}, transaction).catch(() => []);
    const create = (Model, values) => Model.create(values, { transaction });

    // Organizations and schools
    const orgMap = {};
    for (const o of await L('Organizations'))
      orgMap[o.id] = (await create(m.Organization, { name: o.name, headOffice: o.headOffice, contactNumber: o.contactNumber })).id;
    const schoolMap = {};
    const legacySchools = await L('Schools');
    for (const s of legacySchools) {
      if (!orgMap[s.OrganizationId]) {
        warn(`school ${s.id} has no organization, skipped`);
        continue;
      }
      schoolMap[s.id] = (
        await create(m.School, {
          organizationId: orgMap[s.OrganizationId],
          name: s.name,
          address: s.address,
          contactNumber: s.contactNumber,
          location: s.location,
          grPrefix: `SCH${s.id}-`,
        })
      ).id;
    }

    // Users: admins become owners of all schools in their organization; teachers keep their school links.
    const userByEmail = {};
    const teacherMap = {};
    const addMembership = (userId, schoolId, role) =>
      m.UserSchool.findOrCreate({ where: { userId, schoolId }, defaults: { role, isDefault: false }, transaction });
    for (const a of await L('Admins')) {
      if (!orgMap[a.OrganizationId]) continue;
      const u = await create(m.User, {
        organizationId: orgMap[a.OrganizationId],
        name: a.name,
        email: a.email,
        passwordHash: a.password,
        mustChangePassword: false,
      });
      userByEmail[norm(a.email)] = u;
      for (const s of legacySchools.filter((x) => x.OrganizationId === a.OrganizationId && schoolMap[x.id]))
        await addMembership(u.id, schoolMap[s.id], 'owner');
    }
    const teacherSchools = await L('TeacherSchool');
    for (const t of await L('Teachers')) {
      const legacySchool = legacySchools.find((s) => s.id === t.currentSchool);
      const orgId = legacySchool && orgMap[legacySchool.OrganizationId];
      if (!orgId) {
        warn(`teacher ${t.id} has no valid school, skipped`);
        continue;
      }
      let u = userByEmail[norm(t.email)];
      if (!u) {
        // Teachers created with the old "password = email" default must choose a new password.
        const weak = await bcrypt.compare(String(t.email), t.password).catch(() => false);
        u = await create(m.User, {
          organizationId: orgId,
          name: t.name,
          email: t.email,
          phone: t.contactNumber || null,
          passwordHash: t.password,
          photoKey: t.imageLink,
          status: t.status || 'active',
          mustChangePassword: weak,
        });
        userByEmail[norm(t.email)] = u;
      }
      teacherMap[t.id] = u.id;
      const links = teacherSchools.filter((x) => x.TeacherId === t.id).map((x) => x.SchoolId);
      for (const sid of new Set([...links, t.currentSchool])) if (schoolMap[sid]) await addMembership(u.id, schoolMap[sid], 'teacher');
    }
    await m.sequelize.query(
      `UPDATE user_schools us SET is_default = true FROM (SELECT DISTINCT ON (user_id) id FROM user_schools ORDER BY user_id, id) f WHERE us.id = f.id`,
      { transaction },
    );

    // Academic years
    const yearMap = {};
    const legacyYears = await L('AcademicYears');
    for (const y of legacyYears) {
      const school = legacySchools.find((s) => s.id === y.SchoolId);
      if (!schoolMap[y.SchoolId]) continue;
      const current = legacyYears.find((x) => x.id === school.currentAcademicYear);
      const status = y.id === school.currentAcademicYear ? 'active' : current && new Date(y.endDate) <= new Date(current.startDate) ? 'closed' : 'planned';
      let name = y.name;
      if (await m.AcademicYear.count({ where: { schoolId: schoolMap[y.SchoolId], name }, transaction })) name = `${y.name} (${y.id})`;
      let [start, end] = [isoDate(y.startDate), isoDate(y.endDate)];
      if (start >= end) {
        warn(`academic year ${y.id} had end before start; end set to start + 1 day`);
        end = isoDate(new Date(new Date(start).getTime() + 86400000));
      }
      yearMap[y.id] = await create(m.AcademicYear, { schoolId: schoolMap[y.SchoolId], name, startDate: start, endDate: end, status });
    }

    // Grades from distinct class names, then sections
    const legacyClasses = await L('Classes');
    const gradeMap = {};
    for (const [legacySchoolId, schoolId] of Object.entries(schoolMap)) {
      const names = [...new Set(legacyClasses.filter((c) => String(c.SchoolId) === legacySchoolId && yearMap[c.AcademicYearId]).map((c) => c.name.trim()))];
      const byNorm = new Map();
      names.forEach((n) => byNorm.has(norm(n)) || byNorm.set(norm(n), n));
      const ordered = gradeOrder([...byNorm.values()]);
      const created = [];
      for (const [i, n] of ordered.entries()) created.push(await create(m.Grade, { schoolId, name: n, sortOrder: i, isFinal: i === ordered.length - 1 }));
      for (let i = 0; i < created.length - 1; i += 1) await created[i].update({ nextGradeId: created[i + 1].id }, { transaction });
      created.forEach((g) => {
        gradeMap[`${legacySchoolId}|${norm(g.name)}`] = g.id;
        gradeCsv.push([schoolId, g.name, g.name, g.sortOrder]);
      });
    }
    const sectionMap = {};
    for (const c of legacyClasses) {
      const year = yearMap[c.AcademicYearId];
      if (!year) {
        warn(`class ${c.id} "${c.name}" has no academic year, skipped`);
        continue;
      }
      sectionMap[c.id] = await create(m.ClassSection, {
        schoolId: year.schoolId,
        academicYearId: year.id,
        gradeId: gradeMap[`${c.SchoolId}|${norm(c.name)}`],
        name: c.name.trim(),
      });
    }

    const subjectMap = {};
    for (const s of await L('Subjects')) {
      const section = sectionMap[s.ClassId];
      if (!section) continue;
      const [row] = await m.Subject.findOrCreate({
        where: { classSectionId: section.id, name: s.name.trim() },
        defaults: { schoolId: section.schoolId, academicYearId: section.academicYearId },
        transaction,
      });
      subjectMap[s.id] = row.id;
    }

    // Students: one identity per (school, GR); one enrollment per legacy yearly row.
    const legacyStudents = (await L('Students')).filter((s) => schoolMap[s.SchoolId] && sectionMap[s.ClassId]);
    const groups = new Map();
    for (const s of legacyStudents) {
      const key = `${s.SchoolId}|${String(s.GRNumber).trim()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }
    const enrollmentMap = {};
    const studentMap = {};
    const grNumbers = {};
    for (const rows of groups.values()) {
      rows.sort((a, b) => yearMap[a.AcademicYearId].startDate.localeCompare(yearMap[b.AcademicYearId].startDate));
      // Split rows that clearly belong to different children (same GR, different DOB, or two rows in one year).
      const people = [];
      for (const r of rows) {
        const same = people.find(
          (p) => !p.some((x) => x.AcademicYearId === r.AcademicYearId) && p.every((x) => !x.dob || !r.dob || isoDate(x.dob) === isoDate(r.dob)),
        );
        if (same) same.push(r);
        else people.push([r]);
      }
      for (const [pi, person] of people.entries()) {
        const latest = person[person.length - 1];
        const pickField = (f) =>
          [...person]
            .reverse()
            .map((x) => x[f])
            .find((v) => v !== null && v !== undefined && String(v).trim() !== '') ?? null;
        let gr = String(latest.GRNumber).trim();
        if (pi > 0) {
          gr = `${gr}-${pi + 1}`;
          person.forEach((x) => review.push([x.id, schoolMap[x.SchoolId], latest.GRNumber, x.name, 'same GR as another child', `kept separate with GR ${gr}`]));
        }
        const dob = isoDate(pickField('dob'));
        const age = pickField('age');
        const firstYear = yearMap[person[0].AcademicYearId];
        const student = await create(m.Student, {
          schoolId: schoolMap[latest.SchoolId],
          grNumber: gr,
          name: latest.name.trim(),
          gender: { male: 'M', female: 'F', other: 'O' }[norm(pickField('gender'))] || null,
          dob,
          dobIsApproximate: !dob && Boolean(age),
          estimatedBirthYear: !dob && age ? Number(firstYear.startDate.slice(0, 4)) - Number(age) : null,
          bloodGroup: pickField('bloodGroup'),
          address: pickField('address'),
          fatherName: pickField('fatherName'),
          motherName: pickField('motherName'),
          guardianPhone: pickField('contactNumber_1'),
          guardianPhone2: pickField('contactNumber_2'),
          aadhaarLast4: last4(pickField('aadharNumber')),
          photoKey: pickField('imageLink'),
          admissionDate: isoDate(person[0].createdAt),
        });
        grNumbers[student.schoolId] = Math.max(grNumbers[student.schoolId] || 0, numberIn(gr.split('-').pop()));
        let previous = null;
        for (const [i, r] of person.entries()) {
          const section = sectionMap[r.ClassId];
          const year = yearMap[r.AcademicYearId];
          const nextRow = person[i + 1];
          let status = 'active';
          if (nextRow) status = sectionMap[nextRow.ClassId].gradeId === section.gradeId ? 'detained' : 'promoted';
          else if (year.status === 'closed') status = 'left';
          const e = await create(m.Enrollment, {
            schoolId: student.schoolId,
            academicYearId: year.id,
            studentId: student.id,
            classSectionId: section.id,
            status,
            enrolledOn: year.startDate,
            exitedOn: status === 'active' ? null : year.endDate,
            previousEnrollmentId: previous,
          });
          previous = e.id;
          enrollmentMap[r.id] = e;
          studentMap[r.id] = student.id;
        }
        if (enrollmentMap[latest.id].status === 'left')
          await student.update({ status: 'left', leftOn: yearMap[latest.AcademicYearId].endDate, leftReason: 'other' }, { transaction });
      }
    }
    for (const [schoolId, n] of Object.entries(grNumbers)) await m.School.update({ nextGrNumber: n + 1 }, { where: { id: schoolId }, transaction });

    // Attendance (+ sessions recomputed below)
    let attendance = 0;
    for (const a of await L('Attendances')) {
      const e = enrollmentMap[a.studentId];
      if (!e) continue;
      await m.sequelize.query(
        `INSERT INTO attendance (school_id, academic_year_id, enrollment_id, student_id, class_section_id, date, status, marked_at)
         VALUES (:s, :y, :e, :st, :c, :d, :status, now()) ON CONFLICT (student_id, date) DO NOTHING`,
        {
          replacements: {
            s: e.schoolId,
            y: e.academicYearId,
            e: e.id,
            st: e.studentId,
            c: e.classSectionId,
            d: isoDate(a.date),
            status: a.status === 'present' ? 'P' : 'A',
          },
          transaction,
        },
      );
      attendance += 1;
    }
    await m.sequelize.query(
      `INSERT INTO attendance_sessions (school_id, academic_year_id, class_section_id, date, present_count, absent_count)
       SELECT school_id, academic_year_id, class_section_id, date, count(*) FILTER (WHERE status = 'P'), count(*) FILTER (WHERE status = 'A')
       FROM attendance GROUP BY 1, 2, 3, 4 ON CONFLICT (class_section_id, date) DO NOTHING`,
      { transaction },
    );

    // Timelines → diary (one entry per student per day; notes of duplicates are merged)
    const tlSubjects = await L('SubjectStudentTimeline');
    const diary = new Map();
    for (const t of await L('StudentTimelines')) {
      const e = enrollmentMap[t.StudentId];
      if (!e) continue;
      const key = `${e.studentId}|${isoDate(t.date)}`;
      const subjects = tlSubjects
        .filter((x) => x.StudentTimelineId === t.id)
        .map((x) => subjectMap[x.SubjectId])
        .filter(Boolean);
      const d = diary.get(key) || { e, date: isoDate(t.date), notes: [], photo: null, subjects: new Set() };
      if (t.progress) d.notes.push(t.progress);
      d.photo = d.photo || t.image || null;
      subjects.forEach((s) => d.subjects.add(s));
      diary.set(key, d);
    }
    for (const d of diary.values()) {
      await create(m.DailyLog, {
        schoolId: d.e.schoolId,
        academicYearId: d.e.academicYearId,
        enrollmentId: d.e.id,
        studentId: d.e.studentId,
        date: d.date,
        note: [...new Set(d.notes)].join('\n') || null,
        photoKey: d.photo,
        subjectIds: [...d.subjects],
      });
    }

    // Syllabus with completion
    const chapterMap = {};
    for (const c of await L('Chapters')) {
      if (!subjectMap[c.SubjectId]) continue;
      const subject = await m.Subject.findByPk(subjectMap[c.SubjectId], { transaction });
      chapterMap[c.id] = await create(m.Chapter, { schoolId: subject.schoolId, subjectId: subject.id, name: c.name, sortOrder: c.id });
    }
    let completions = 0;
    for (const t of await L('Topics')) {
      const chapter = chapterMap[t.ChapterId];
      if (!chapter || !t.content) continue;
      const topic = await create(m.Topic, { schoolId: chapter.schoolId, chapterId: chapter.id, content: t.content, sortOrder: t.id });
      if (t.completedDate) {
        await create(m.TopicCompletion, {
          schoolId: chapter.schoolId,
          topicId: topic.id,
          completedBy: teacherMap[t.completedBy] || null,
          completedOn: isoDate(t.completedDate),
        });
        completions += 1;
      }
    }

    // Reports (latest wins per enrollment, subject, term)
    const reports = (await L('Reports')).sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
    for (const r of reports) {
      const e = enrollmentMap[r.StudentId];
      const term = { s1: 'S1', s2: 'S2', annual: 'ANNUAL' }[r.reportType];
      if (!e || !subjectMap[r.SubjectId] || !term) continue;
      await m.ReportEntry.upsert(
        {
          schoolId: e.schoolId,
          academicYearId: e.academicYearId,
          enrollmentId: e.id,
          subjectId: subjectMap[r.SubjectId],
          term,
          grade: r.grade,
          remarks: r.content,
        },
        { transaction, conflictFields: ['enrollment_id', 'subject_id', 'term'] },
      );
    }

    // Common subjects → activities
    const activityMap = {};
    for (const c of await L('CommonSubjects')) {
      const year = yearMap[c.AcademicYearId];
      if (!year) continue;
      const [g] = await m.ActivityGroup.findOrCreate({
        where: { academicYearId: year.id, name: c.name.trim() },
        defaults: { schoolId: year.schoolId },
        transaction,
      });
      activityMap[c.id] = g;
    }
    for (const link of await L('StudentCommonSubject')) {
      const g = activityMap[link.CommonSubjectId];
      const e = enrollmentMap[link.StudentId];
      if (g && e && e.academicYearId === g.academicYearId)
        await m.ActivityMember.findOrCreate({ where: { activityGroupId: g.id, enrollmentId: e.id }, transaction });
    }

    report.counts = {
      organizations: Object.keys(orgMap).length,
      schools: Object.keys(schoolMap).length,
      users: await m.User.count({ transaction }),
      academicYears: Object.keys(yearMap).length,
      grades: await m.Grade.count({ transaction }),
      sections: Object.keys(sectionMap).length,
      subjects: await m.Subject.count({ transaction }),
      legacyStudentRows: legacyStudents.length,
      students: await m.Student.count({ transaction }),
      enrollments: await m.Enrollment.count({ transaction }),
      attendanceRows: attendance,
      diaryEntries: diary.size,
      topics: await m.Topic.count({ transaction }),
      completions,
      reportEntries: await m.ReportEntry.count({ transaction }),
      studentsNeedingReview: review.length - 1,
    };
    if (apply) await transaction.commit();
    else await transaction.rollback();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ applied: apply, ...report }, null, 2));
    fs.writeFileSync(path.join(outDir, 'review-students.csv'), csv(review));
    fs.writeFileSync(path.join(outDir, 'grade-mapping.csv'), csv(gradeCsv));
  }
  return { applied: apply, ...report, review };
}

if (require.main === module) {
  const apply = process.argv.includes('--apply');
  const outDir = `legacy-migration-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  migrateLegacy({ apply, outDir })
    .then((r) => {
      console.log(JSON.stringify({ applied: r.applied, counts: r.counts, warnings: r.warnings.length }, null, 2));
      console.log(`Report: ${outDir}/ ${apply ? '(committed)' : '(dry run, nothing saved — re-run with --apply)'}`);
      return m.sequelize.close();
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}

module.exports = { migrateLegacy, gradeOrder };
