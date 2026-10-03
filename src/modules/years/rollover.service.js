const { Op, QueryTypes, UniqueConstraintError } = require('sequelize');
const m = require('../../db/models');
const { conflict, badRequest, notFound } = require('../../utils/errors');

const suffixOf = (section, grade) => (section.name.startsWith(grade.name) ? section.name.slice(grade.name.length).trim() : section.name);

// Next-year section for a promoted student: same suffix ("A") in the next grade, or the only section of that grade.
function mapTarget(section, grades, targets) {
  const grade = grades.get(section.gradeId);
  if (!grade || grade.isFinal || !grade.nextGradeId) return null;
  const candidates = targets.filter((t) => t.gradeId === grade.nextGradeId);
  const suffix = suffixOf(section, grade);
  const nextGrade = grades.get(grade.nextGradeId);
  return (candidates.find((t) => nextGrade && suffixOf(t, nextGrade) === suffix) || (candidates.length === 1 ? candidates[0] : null))?.key ?? null;
}

// Pure planning step: no writes. The admin edits the returned plan in the wizard and sends it back to applyPlan.
async function buildPlan(schoolId, sourceYearId, { name, startDate, endDate }) {
  const source = await m.AcademicYear.findOne({ where: { id: sourceYearId, schoolId } });
  if (!source) throw notFound();
  const grades = new Map((await m.Grade.findAll({ where: { schoolId } })).map((g) => [g.id, g]));
  const sections = await m.ClassSection.findAll({
    where: { academicYearId: source.id },
    include: [{ model: m.Grade, attributes: [] }],
    order: m.SECTION_ORDER,
  });
  const enrollments = await m.Enrollment.findAll({
    where: { academicYearId: source.id, status: 'active' },
    include: [{ model: m.Student, attributes: ['id', 'name', 'grNumber'] }],
    order: [[m.Student, 'name', 'ASC']],
  });

  const targets = sections.map((s) => ({ key: `src-${s.id}`, sourceId: s.id, gradeId: s.gradeId, name: s.name, include: true }));
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const position = new Map(sections.map((s, i) => [s.id, i]));
  enrollments.sort((a, b) => position.get(a.classSectionId) - position.get(b.classSectionId)); // stable: names stay sorted within a class
  const promotions = enrollments.map((e) => {
    const from = sectionById.get(e.classSectionId);
    const grade = grades.get(from.gradeId);
    const graduate = !grade || grade.isFinal || !grade.nextGradeId;
    return {
      enrollmentId: e.id,
      studentId: e.studentId,
      studentName: e.Student.name,
      grNumber: e.Student.grNumber,
      fromSectionId: from.id,
      fromSectionName: from.name,
      action: graduate ? 'graduate' : 'promote',
      targetKey: graduate ? null : mapTarget(from, grades, targets),
    };
  });

  return {
    sourceYearId: source.id,
    name,
    startDate,
    endDate,
    activate: false,
    copy: { subjects: true, syllabus: true, assignments: true },
    sections: targets,
    promotions,
  };
}

const EXIT_STATUS = { promote: 'promoted', detain: 'detained', leave: 'left', graduate: 'graduated' };
const STUDENT_STATUS = { promote: 'active', detain: 'active', leave: 'left', graduate: 'graduated' };
const CHUNK = 1000;
const chunks = (list) => Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK));

// Applies promotion decisions ({ enrollmentId, action, targetSectionId, reason }) in a few set-based statements per
// 1,000 children, instead of ~7 queries per child. Shared by the wizard and the later per-class promotion screen.
// promote/detain: old enrollment closed, enrollment in targetSectionId (created or moved), child active again.
// leave/graduate: old enrollment closed, child marked left/graduated on the source year's last day.
async function applyPromotions(items, { targetYear, sourceYearId, transaction }) {
  const byId = new Map(items.map((i) => [i.enrollmentId, i])); // the last decision for a child wins
  if (!byId.size) return;
  const q = (sql, replacements, type) => m.sequelize.query(sql, { replacements, transaction, ...(type ? { type } : {}) });
  const olds = [];
  for (const ids of chunks([...byId.keys()])) {
    olds.push(
      ...(await q(
        `SELECT e.id, e.school_id AS "schoolId", e.student_id AS "studentId", e.academic_year_id AS "yearId", y.end_date AS "endDate"
         FROM enrollments e JOIN academic_years y ON y.id = e.academic_year_id WHERE e.id IN (:ids) FOR UPDATE OF e`,
        { ids },
        QueryTypes.SELECT,
      )),
    );
  }
  if (olds.length !== byId.size || olds.some((o) => o.schoolId !== targetYear.schoolId)) throw notFound();
  for (const o of olds) {
    if (sourceYearId && o.yearId !== sourceYearId) throw badRequest('ROLLOVER_INVALID', { params: { enrollmentId: o.id } });
    if (o.yearId === targetYear.id) throw badRequest('ROLLOVER_INVALID');
    const item = byId.get(o.id);
    if (!EXIT_STATUS[item.action]) throw badRequest('ROLLOVER_INVALID');
    if ((item.action === 'promote' || item.action === 'detain') && !item.targetSectionId)
      throw badRequest('ROLLOVER_INVALID', { params: { enrollmentId: o.id } });
  }

  for (const part of chunks(olds)) {
    const rows = part.map((o) => ({ ...o, ...byId.get(o.id) }));
    await q(
      `UPDATE enrollments e SET status = v.status, exited_on = v.exited_on, updated_at = now()
       FROM unnest(ARRAY[:ids]::int[], ARRAY[:statuses]::text[], ARRAY[:dates]::date[]) AS v(id, status, exited_on) WHERE e.id = v.id`,
      { ids: rows.map((r) => r.id), statuses: rows.map((r) => EXIT_STATUS[r.action]), dates: rows.map((r) => r.endDate) },
    );
    // One new enrollment per child (a child can appear once per target year).
    const moving = [...new Map(rows.filter((r) => r.targetSectionId).map((r) => [r.studentId, r])).values()];
    if (moving.length) {
      await q(
        `INSERT INTO enrollments (school_id, academic_year_id, student_id, class_section_id, status, enrolled_on, previous_enrollment_id, created_at, updated_at)
         SELECT :school, :year, v.student_id, v.section_id, 'active', :start, v.prev_id, now(), now()
         FROM unnest(ARRAY[:students]::int[], ARRAY[:sections]::int[], ARRAY[:prev]::int[]) AS v(student_id, section_id, prev_id)
         ON CONFLICT (student_id, academic_year_id) DO UPDATE SET class_section_id = EXCLUDED.class_section_id, status = 'active', updated_at = now()`,
        {
          school: targetYear.schoolId,
          year: targetYear.id,
          start: targetYear.startDate,
          students: moving.map((r) => r.studentId),
          sections: moving.map((r) => r.targetSectionId),
          prev: moving.map((r) => r.id),
        },
      );
    }
    await q(
      `UPDATE students s SET status = v.status,
         left_on = CASE WHEN v.status = 'active' THEN s.left_on ELSE v.left_on END,
         left_reason = CASE WHEN v.status = 'left' THEN v.reason ELSE s.left_reason END,
         updated_at = now()
       FROM unnest(ARRAY[:students]::int[], ARRAY[:statuses]::text[], ARRAY[:dates]::date[], ARRAY[:reasons]::text[]) AS v(id, status, left_on, reason)
       WHERE s.id = v.id`,
      {
        students: rows.map((r) => r.studentId),
        statuses: rows.map((r) => STUDENT_STATUS[r.action]),
        dates: rows.map((r) => r.endDate),
        reasons: rows.map((r) => (r.action === 'leave' ? r.reason || 'other' : null)),
      },
    );
  }
}

async function assertNoOverlap(schoolId, startDate, endDate, transaction, exceptId) {
  const overlap = await m.AcademicYear.count({
    where: { schoolId, startDate: { [Op.lte]: endDate }, endDate: { [Op.gte]: startDate }, ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}) },
    transaction,
  });
  if (overlap) throw conflict('YEAR_OVERLAP');
}

async function activateYear(year, transaction) {
  await m.AcademicYear.update(
    { status: 'closed', closedAt: new Date() },
    { where: { schoolId: year.schoolId, status: 'active', id: { [Op.ne]: year.id } }, transaction },
  );
  await year.update({ status: 'active' }, { transaction });
}

// Creates the whole next year in one transaction. Idempotent per key: retries return the first result.
async function applyPlan(schoolId, userId, plan, idempotencyKey) {
  const done = await m.RolloverRun.findOne({ where: { idempotencyKey } });
  if (done) {
    if (done.schoolId !== schoolId) throw badRequest('ROLLOVER_INVALID');
    return done.summary;
  }
  try {
    return await createFromPlan(schoolId, userId, plan, idempotencyKey);
  } catch (err) {
    // A concurrent retry with the same key loses the race on a unique index: return the winner's result.
    const winner = err instanceof UniqueConstraintError && (await m.RolloverRun.findOne({ where: { idempotencyKey, schoolId } }));
    if (winner) return winner.summary;
    throw err;
  }
}

function createFromPlan(schoolId, userId, plan, idempotencyKey) {
  return m.sequelize.transaction(async (transaction) => {
    const source = await m.AcademicYear.findOne({ where: { id: plan.sourceYearId, schoolId }, transaction });
    if (!source) throw notFound();
    await assertNoOverlap(schoolId, plan.startDate, plan.endDate, transaction);

    const year = await m.AcademicYear.create(
      { schoolId, name: plan.name, startDate: plan.startDate, endDate: plan.endDate, status: 'planned' },
      { transaction },
    );
    const grades = await m.Grade.findAll({ where: { schoolId }, transaction });
    const gradeIds = new Set(grades.map((g) => g.id));

    // Sections
    const keyToId = {};
    const sourceToNew = {};
    const included = plan.sections.filter((s) => s.include);
    for (const [i, s] of included.entries()) {
      if (!gradeIds.has(s.gradeId)) throw badRequest('ROLLOVER_INVALID');
      const row = await m.ClassSection.create(
        { schoolId, academicYearId: year.id, gradeId: s.gradeId, name: s.name, sortOrder: i, copiedFromId: s.sourceId || null },
        { transaction },
      );
      keyToId[s.key] = row.id;
      if (s.sourceId) sourceToNew[s.sourceId] = row.id;
    }

    // Subjects + syllabus (completions are never copied)
    const subjectMap = {};
    let topicCount = 0;
    if (plan.copy.subjects) {
      const subjects = await m.Subject.findAll({ where: { classSectionId: Object.keys(sourceToNew).map(Number) }, transaction });
      for (const sub of subjects) {
        const copy = await m.Subject.create(
          {
            schoolId,
            academicYearId: year.id,
            classSectionId: sourceToNew[sub.classSectionId],
            name: sub.name,
            nameTranslations: sub.nameTranslations,
            sortOrder: sub.sortOrder,
            copiedFromId: sub.id,
          },
          { transaction },
        );
        subjectMap[sub.id] = copy.id;
      }
      if (plan.copy.syllabus && subjects.length) {
        const chapters = await m.Chapter.findAll({ where: { subjectId: subjects.map((s) => s.id) }, include: [m.Topic], transaction });
        for (const ch of chapters) {
          const c = await m.Chapter.create(
            { schoolId, subjectId: subjectMap[ch.subjectId], name: ch.name, sortOrder: ch.sortOrder, copiedFromId: ch.id },
            { transaction },
          );
          await m.Topic.bulkCreate(
            ch.Topics.map((t) => ({ schoolId, chapterId: c.id, content: t.content, sortOrder: t.sortOrder, copiedFromId: t.id })),
            { transaction },
          );
          topicCount += ch.Topics.length;
        }
      }
    }

    // Teacher assignments (active teachers only)
    let assignmentCount = 0;
    if (plan.copy.assignments) {
      const rows = await m.TeacherAssignment.findAll({
        where: { academicYearId: source.id, classSectionId: Object.keys(sourceToNew).map(Number) },
        include: [{ model: m.User, where: { status: 'active' }, attributes: [] }],
        transaction,
      });
      const copies = rows
        .filter((a) => !a.subjectId || subjectMap[a.subjectId])
        .map((a) => ({
          schoolId,
          academicYearId: year.id,
          userId: a.userId,
          classSectionId: sourceToNew[a.classSectionId],
          subjectId: a.subjectId ? subjectMap[a.subjectId] : null,
          role: a.role,
        }));
      await m.TeacherAssignment.bulkCreate(copies, { transaction });
      assignmentCount = copies.length;
    }

    // Promotions
    const counts = { promote: 0, detain: 0, leave: 0, graduate: 0 };
    const promotions = plan.promotions || [];
    promotions.forEach((p) => (counts[p.action] += 1));
    await applyPromotions(
      promotions.map((p) => ({ ...p, targetSectionId: p.targetKey ? keyToId[p.targetKey] : null })),
      { targetYear: year, sourceYearId: source.id, transaction },
    );

    if (plan.activate) await activateYear(year, transaction);

    const summary = {
      academicYearId: year.id,
      name: year.name,
      sections: included.length,
      subjects: Object.keys(subjectMap).length,
      topics: topicCount,
      assignments: assignmentCount,
      promotions: counts,
      activated: Boolean(plan.activate),
    };
    await m.RolloverRun.create({ schoolId, idempotencyKey, academicYearId: year.id, summary, createdBy: userId }, { transaction });
    return summary;
  });
}

module.exports = { buildPlan, applyPlan, applyPromotions, activateYear, assertNoOverlap, mapTarget };
