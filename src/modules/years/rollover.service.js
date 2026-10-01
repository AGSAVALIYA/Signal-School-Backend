const { Op, UniqueConstraintError } = require('sequelize');
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
    order: [
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
  });
  const enrollments = await m.Enrollment.findAll({
    where: { academicYearId: source.id, status: 'active' },
    include: [{ model: m.Student, attributes: ['id', 'name', 'grNumber'] }],
    order: [[m.Student, 'name', 'ASC']],
  });

  const targets = sections.map((s) => ({ key: `src-${s.id}`, sourceId: s.id, gradeId: s.gradeId, name: s.name, include: true }));
  const sectionById = new Map(sections.map((s) => [s.id, s]));
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

// Applies one promotion decision to a student. Shared by the wizard and the later per-class promotion screen.
async function applyPromotion(item, { targetYear, targetSectionId, transaction }) {
  const old = await m.Enrollment.findOne({ where: { id: item.enrollmentId }, transaction, lock: transaction.LOCK.UPDATE });
  if (!old || old.schoolId !== targetYear.schoolId) throw notFound();
  if (old.academicYearId === targetYear.id) throw badRequest('ROLLOVER_INVALID');
  const sourceYear = await m.AcademicYear.findByPk(old.academicYearId, { transaction });
  const exitedOn = sourceYear.endDate;

  if (item.action === 'promote' || item.action === 'detain') {
    if (!targetSectionId) throw badRequest('ROLLOVER_INVALID', { params: { enrollmentId: old.id } });
    await old.update({ status: item.action === 'promote' ? 'promoted' : 'detained', exitedOn }, { transaction });
    const [enrollment] = await m.Enrollment.findOrCreate({
      where: { studentId: old.studentId, academicYearId: targetYear.id },
      defaults: { schoolId: old.schoolId, classSectionId: targetSectionId, status: 'active', enrolledOn: targetYear.startDate, previousEnrollmentId: old.id },
      transaction,
    });
    await enrollment.update({ classSectionId: targetSectionId, status: 'active' }, { transaction });
    await m.Student.update({ status: 'active' }, { where: { id: old.studentId }, transaction });
  } else if (item.action === 'leave') {
    await old.update({ status: 'left', exitedOn }, { transaction });
    await m.Student.update({ status: 'left', leftOn: exitedOn, leftReason: item.reason || 'other' }, { where: { id: old.studentId }, transaction });
  } else if (item.action === 'graduate') {
    await old.update({ status: 'graduated', exitedOn }, { transaction });
    await m.Student.update({ status: 'graduated', leftOn: exitedOn }, { where: { id: old.studentId }, transaction });
  } else {
    throw badRequest('ROLLOVER_INVALID');
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
  if (done) return done.summary;
  try {
    return await createFromPlan(schoolId, userId, plan, idempotencyKey);
  } catch (err) {
    // A concurrent retry with the same key loses the race on a unique index: return the winner's result.
    const winner = err instanceof UniqueConstraintError && (await m.RolloverRun.findOne({ where: { idempotencyKey } }));
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
    for (const p of plan.promotions || []) {
      const targetSectionId = p.targetKey ? keyToId[p.targetKey] : null;
      await applyPromotion(p, { targetYear: year, targetSectionId, transaction });
      counts[p.action] += 1;
    }

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

module.exports = { buildPlan, applyPlan, applyPromotion, activateYear, assertNoOverlap, mapTarget };
