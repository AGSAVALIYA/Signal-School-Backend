/**
 * Syllabus Routes
 * Defines all API endpoints for syllabus management operations
 * All routes require authentication via tokenVerify middleware
 */

const express = require('express');
const router = express.Router();
const SyllabusController = require('../controllers/SyllabusController');
const tokenVerify = require('../middlewares/tokenVerify');

// GET /syllabus/get/:subjectId - Retrieve syllabus (chapters and topics) for a specific subject
router.get('/syllabus/get/:subjectId', tokenVerify, SyllabusController.getSyllabus);

// POST /syllabus/add/:subjectId - Add new syllabus content (chapter with topics) to a subject
router.post('/syllabus/add/:subjectId', tokenVerify, SyllabusController.addSyllabus);

// PUT /syllabus/update/:chapterId - Update existing chapter information
router.put('/syllabus/update/:chapterId', tokenVerify, SyllabusController.editChapter);

// DELETE /syllabus/delete/:chapterId - Delete a chapter and all its topics
router.delete('/syllabus/delete/:chapterId', tokenVerify, SyllabusController.deleteChapter);

// GET /syllabus/getFull - Retrieve complete syllabus for the current school
router.get('/syllabus/getFull', tokenVerify, SyllabusController.getFullForSchool);

// POST /syllabus/markTopicAsCompleted/:topicId - Mark a specific topic as completed by a teacher
router.post('/syllabus/markTopicAsCompleted/:topicId', tokenVerify, SyllabusController.markTopicAsCompleted);

// POST /syllabus/unMarkTopicAsCompleted/:topicId - Remove completion status from a topic
router.post('/syllabus/unMarkTopicAsCompleted/:topicId', tokenVerify, SyllabusController.unMarkTopicAsCompleted);

module.exports = router;
