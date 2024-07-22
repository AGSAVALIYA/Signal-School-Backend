const Chapter = require("../models/Chapter");
const Class = require("../models/Class");
const School = require("../models/School");
const Subject = require("../models/Subject");
const Topic = require("../models/Topic");
const Teacher = require("../models/Teacher");
const { createLog } = require("../utils/createLogs");



const getSyllabus = async (req, res) => {
    try{ 
        const subjectId = req.params.subjectId;
        const chapters = await Chapter.findAll({
            where: { SubjectId: subjectId },
            include: {
                model: Topic,
                include: {
                    model: Teacher,
                    attributes: ['id', 'name']
                }
            }
        });
        
        return res.status(200).json({ chapters });
    }
    catch (error) {
        return res.status(500).json({ error: error.message })
    }
}

const addSyllabus = async (req, res) => {
    try {
        const subjectId = req.params.subjectId;
        const chapterName = req.body.chapterName;
        const Topics = req.body.topics;

        if (!chapterName) {
            throw new Error('Chapter name is required');
        }
        if (!Topics) {
            throw new Error('At least one topic is required');
        }

        const chapter = await Chapter.create({
            name: chapterName,
            SubjectId: subjectId
        });

        Topics.forEach(async (topic) => {
            await Topic.create({
                content: topic,
                ChapterId: chapter.id
            });
        });

        return res.status(201).json({ message: 'Syllabus created successfully', chapter });
    }
    catch (error) {
        return res.status(500).json({ error: error.message })
    }

}


const editChapter = async (req, res) => {
    try{ 
        const chapterId = req.params.chapterId;
        const chapterName = req.body.chapterName;
        const Topics = req.body.topics;

        if (!chapterName) {
            throw new Error('Chapter name is required');
        }
        if (!Topics) {
            throw new Error('At least one topic is required');
        }

        const chapter = await Chapter.findByPk(chapterId);
        chapter.name = chapterName;
        await chapter.save();
        //delete all topics
        await Topic.destroy({ where: { ChapterId: chapterId } });
        //add new topics
        Topics.forEach(async (topic) => {
            await Topic.create({
                content: topic,
                ChapterId: chapter.id
            });
        });


        return res.status(200).json({ message: 'Syllabus updated successfully', chapter });
    
    }

    catch (error) {
        return res.status(500).json({ error: error.message })
    }

}


const getFullForSchool = async (req, res) => {
    try {
        if(!req.user || (req.user !== "admin" && req.user !== "teacher")){
            throw new Error('You are not authorized to access this route');
        }
        let schoolId = req.currentSchool;
        let school = await School.findOne({ where: { id: schoolId }, attributes: ['currentAcademicYear'] });
        const academicYearId = school.currentAcademicYear;
        const classes = await Class.findAll({
            where: { AcademicYearId: academicYearId },
            include: {
                model: Subject,
                include: {
                    model: Chapter,
                    include: {
                        model: Topic,
                        include: {
                            model: Teacher,
                            attributes: ['id', 'name']
                        }
                    }
                }
            }
        });
        //SORT cHAPTER IN ASCENDING ORDER OF ID AND TOPICS IN ASCENDING ORDER OF ID
        classes.forEach((classItem) => {
            classItem.Subjects.forEach((subject) => {
                subject.Chapters = subject.Chapters.sort((a, b) => a.id - b.id);
                subject.Chapters.forEach((chapter) => {
                    chapter.Topics = chapter.Topics.sort((a, b) => a.id - b.id);
                });
            });
        }
        );
        return res.status(200).json({ classes });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ error: error.message })
        
    }
}

const deleteChapter = async (req, res) => {
    try {
        const chapterId = req.params.chapterId;
        await Chapter.destroy({ where: { id: chapterId } });
        //delete all topics
        await Topic.destroy({ where: { ChapterId: chapterId } });
        return res.status(201).json({ message: 'Chapter deleted successfully' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message })
    }
}

const markTopicAsCompleted = async (req, res) => {
    try {
        const topicId = req.params.topicId;
        let teacherId = req.body.teacherId;
        let completedDate = req.body.completedDate;
        completedDate = new Date(completedDate);
        if (!teacherId) {
            throw new Error('Teacher ID is required');
        }
        if (!completedDate) {
            throw new Error('Completed date is required');
        }
        const topic = await Topic.findByPk(topicId);
        //completedBy as Teacher Id
        topic.completedBy = teacherId;
        topic.completedDate = completedDate;
        await topic.save();
        if (req.user === 'teacher') {
            createLog('teacher', 'Update', `Marked topic ${topic.content} as completed`, req.teacher.id );
        }
        if (req.user === 'admin') {
            createLog('admin', `Marked topic ${topic.content} as completed`, req.admin.id );
        }

        return res.status(200).json({ message: 'Topic marked as completed successfully', topic });
    }
    catch (error) {
        return res.status(500).json({ error: error.message })
    }
}

const unMarkTopicAsCompleted = async (req, res) => {
    try {
        const topicId = req.params.topicId;
        const topic = await Topic.findByPk(topicId);
        topic.completedBy = null;
        topic.completedDate = null;
        await topic.save();
        if (req.user === 'teacher') {
            createLog('teacher', 'Update', `Marked topic ${topic.content} as incomplete`, req.teacher.id );
        }
        if (req.user === 'admin') {
            createLog('admin', `Marked topic ${topic.content} as incomplete`, req.admin.id );
        }
        return res.status(200).json({ message: 'Topic marked as incomplete successfully', topic });
    }
    catch (error) {
        return res.status(500).json({ error: error.message })
    }
}


module.exports = {
    getSyllabus,
    addSyllabus,
    editChapter,
    getFullForSchool,
    deleteChapter,
    markTopicAsCompleted,
    unMarkTopicAsCompleted
}

