const router = require('express').Router();
const { z } = require('zod');
const { QueryTypes } = require('sequelize');
const validate = require('../../middlewares/validate');
const { requirePerm, yearScope } = require('../../middlewares/auth');
const m = require('../../db/models');
const audit = require('../../utils/audit');
const { findInSchool, assertSectionWrite, assertYearWritable, isStaff } = require('../../utils/scope');
const { conflict, forbidden, badRequest } = require('../../utils/errors');
const { ISO, todayIn } = require('../../utils/dates');

async function loadTree(subjectId) {
  return m.Chapter.findAll({
    where: { subjectId },
    include: [
      { model: m.Topic, include: [{ model: m.TopicCompletion, as: 'completion', include: [{ model: m.User, as: 'teacher', attributes: ['id', 'name'] }] }] },
    ],
    order: [
      ['sortOrder', 'ASC'],
      ['id', 'ASC'],
      [m.Topic, 'sortOrder', 'ASC'],
      [m.Topic, 'id', 'ASC'],
    ],
  });
}

const progressOf = (chapters) => {
  const topics = chapters.flatMap((c) => c.Topics);
  const done = topics.filter((t) => t.completion).length;
  return { total: topics.length, done, percent: topics.length ? Math.round((100 * done) / topics.length) : 0 };
};

router.get('/syllabus/subjects/:id', async (req, res) => {
  const subject = await findInSchool(m.Subject, req.params.id, req, { include: [{ model: m.ClassSection, attributes: ['id', 'name'] }] });
  const chapters = await loadTree(subject.id);
  res.json({ data: { subject, chapters, progress: progressOf(chapters) } });
});

// Saves the whole chapter/topic tree, updating rows in place by id so completion ticks survive edits.
router.put(
  '/syllabus/subjects/:id',
  requirePerm('syllabus.edit'),
  validate({
    body: z.object({
      chapters: z
        .array(
          z.object({
            id: z.number().int().optional(),
            name: z.string().trim().min(1).max(200),
            topics: z.array(z.object({ id: z.number().int().optional(), content: z.string().trim().min(1).max(500) })).max(200),
          }),
        )
        .max(200),
    }),
  }),
  async (req, res) => {
    const subject = await findInSchool(m.Subject, req.params.id, req);
    assertYearWritable(await m.AcademicYear.findByPk(subject.academicYearId));
    await m.sequelize.transaction(async (transaction) => {
      const existing = await m.Chapter.findAll({
        where: { subjectId: subject.id },
        include: [{ model: m.Topic, include: [{ model: m.TopicCompletion, as: 'completion' }] }],
        transaction,
      });
      const chapterById = new Map(existing.map((c) => [c.id, c]));
      const keptTopicIds = new Set(req.v.body.chapters.flatMap((c) => c.topics.map((t) => t.id).filter(Boolean)));
      const keptChapterIds = new Set(req.v.body.chapters.map((c) => c.id).filter(Boolean));

      const removedTopics = existing.flatMap((c) => c.Topics).filter((t) => !keptTopicIds.has(t.id));
      if (removedTopics.some((t) => t.completion)) throw conflict('TOPIC_HAS_COMPLETION');
      const topicById = new Map(existing.flatMap((c) => c.Topics).map((t) => [t.id, t]));

      for (const [ci, input] of req.v.body.chapters.entries()) {
        let chapter = input.id && chapterById.get(input.id);
        if (input.id && !chapter) throw badRequest('VALIDATION');
        if (chapter) await chapter.update({ name: input.name, sortOrder: ci }, { transaction });
        else chapter = await m.Chapter.create({ schoolId: req.school.id, subjectId: subject.id, name: input.name, sortOrder: ci }, { transaction });
        for (const [ti, t] of input.topics.entries()) {
          const row = t.id && topicById.get(t.id);
          if (t.id && !row) throw badRequest('VALIDATION');
          if (row) await row.update({ content: t.content, sortOrder: ti, chapterId: chapter.id }, { transaction });
          else await m.Topic.create({ schoolId: req.school.id, chapterId: chapter.id, content: t.content, sortOrder: ti }, { transaction });
        }
      }
      if (removedTopics.length) await m.Topic.destroy({ where: { id: removedTopics.map((t) => t.id) }, transaction });
      const removedChapters = existing.filter((c) => !keptChapterIds.has(c.id)).map((c) => c.id);
      if (removedChapters.length) await m.Chapter.destroy({ where: { id: removedChapters }, transaction });
    });
    await audit(req, 'syllabus.save', { entityType: 'subject', entityId: subject.id, summary: subject.name });
    const chapters = await loadTree(subject.id);
    res.json({ data: { subject, chapters, progress: progressOf(chapters) } });
  },
);

async function topicContext(req, id) {
  const topic = await findInSchool(m.Topic, id, req, { include: [m.Chapter] });
  const subject = await m.Subject.findByPk(topic.Chapter.subjectId);
  return { topic, subject };
}

router.post(
  '/syllabus/topics/:id/complete',
  requirePerm('syllabus.complete'),
  validate({ body: z.object({ date: z.string().regex(ISO).optional(), teacherId: z.number().int().optional() }) }),
  async (req, res) => {
    const { topic, subject } = await topicContext(req, req.params.id);
    assertYearWritable(await m.AcademicYear.findByPk(subject.academicYearId));
    await assertSectionWrite(req, subject.classSectionId, subject.id);
    const date = req.v.body.date || todayIn(req.school.timezone);
    if (date > todayIn(req.school.timezone)) throw badRequest('DATE_IN_FUTURE');
    let completedBy = req.user.id;
    if (req.v.body.teacherId && isStaff(req)) {
      const member = await m.UserSchool.findOne({ where: { userId: req.v.body.teacherId, schoolId: req.school.id } });
      if (!member) throw badRequest('VALIDATION', { fields: { teacherId: 'INVALID' } });
      completedBy = member.userId;
    }
    await m.TopicCompletion.upsert({ schoolId: req.school.id, topicId: topic.id, completedBy, completedOn: date }, { conflictFields: ['topic_id'] });
    await audit(req, 'syllabus.complete', { entityType: 'topic', entityId: topic.id, summary: topic.content });
    res.json({
      data: await m.TopicCompletion.findOne({ where: { topicId: topic.id }, include: [{ model: m.User, as: 'teacher', attributes: ['id', 'name'] }] }),
    });
  },
);

router.delete('/syllabus/topics/:id/complete', requirePerm('syllabus.complete'), async (req, res) => {
  const { topic, subject } = await topicContext(req, req.params.id);
  assertYearWritable(await m.AcademicYear.findByPk(subject.academicYearId));
  const completion = await m.TopicCompletion.findOne({ where: { topicId: topic.id } });
  if (completion) {
    if (!isStaff(req) && completion.completedBy !== req.user.id) throw forbidden();
    await completion.destroy();
    await audit(req, 'syllabus.uncomplete', { entityType: 'topic', entityId: topic.id, summary: topic.content });
  }
  res.status(204).end();
});

// Progress per section and subject for the selected year.
router.get('/syllabus/progress', yearScope(), async (req, res) => {
  const rows = await m.sequelize.query(
    `SELECT cs.id AS "sectionId", cs.name AS "sectionName", sb.id AS "subjectId", sb.name AS "subjectName",
            count(t.id)::int AS total, count(tc.id)::int AS done, max(tc.completed_on) AS "lastCompletedOn"
     FROM subjects sb JOIN class_sections cs ON cs.id = sb.class_section_id JOIN grades g ON g.id = cs.grade_id
     LEFT JOIN chapters c ON c.subject_id = sb.id LEFT JOIN topics t ON t.chapter_id = c.id
     LEFT JOIN topic_completions tc ON tc.topic_id = t.id
     WHERE sb.academic_year_id = :y AND sb.school_id = :s
     GROUP BY cs.id, sb.id, g.sort_order ORDER BY g.sort_order, cs.sort_order, cs.name, sb.sort_order, sb.name`,
    { replacements: { y: req.year.id, s: req.school.id }, type: QueryTypes.SELECT },
  );
  res.json({ data: rows.map((r) => ({ ...r, percent: r.total ? Math.round((100 * r.done) / r.total) : 0 })) });
});

module.exports = router;
