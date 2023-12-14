const StudentTimeline = require('../models/StudentTimeline');
const dotenv = require('dotenv');
const AWS = require("aws-sdk");
const Student = require('../models/Student');
const { uploadImageToTimeline } = require('../utils/s3Upload');

//CONFIG FOR THE UPLOAD
dotenv.config();



const createStudentTimeline = async (req, res) => {
    try {
        let date = req.body.date;
        let progress = req.body.progress;
        let attendanceStatus = req.body.attendanceStatus;
        let studentId = req.body.studentId;
        let subjects = req.body.subjects;

        date = new Date(date);

        if (!date || !attendanceStatus || !studentId) {
            return res.status(400).json({ error: 'Please provide all required fields' });
        }
    
        const student = await Student.findOne({ where: { id: studentId } });
        if (!student) {
            throw new Error('Student not found');
        }

        let studentTimeline;

        try {
            if (req.files) {
                studentTimeline = await StudentTimeline.create({
                    date,
                    progress,
                    attendanceStatus,
                    image: req.files ? req.files.timelineImg ? req.files.timelineImg[0].location : null : null,
                    StudentId: studentId,
                    subjects,
                });
            } else {
                studentTimeline = await StudentTimeline.create({
                    date,
                    progress,
                    attendanceStatus,
                    StudentId: studentId,
                    subjects,
                });
            }

            if(attendanceStatus === 'present' && student.todayStatus === 'absent'){
                student.todayStatus = 'present';
                await student.save();
            }

            if(attendanceStatus === 'absent' && student.todayStatus === 'present'){
                student.todayStatus = 'absent';
                await student.save();
            }



            return res.status(201).json({ message: 'Student timeline created successfully', studentTimeline });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};


    // Retrieve Student Timelines by Student ID
const getStudentTimelinesByStudentId = async (req, res) => {
        try {
            const studentId = req.params.studentId;

            if (!studentId) {
                return res.status(400).json({ error: 'Student ID is required' });
            }

            const studentTimelines = await StudentTimeline.findAll({
                where: { StudentId: studentId },
                order: [['createdAt', 'DESC']],
            });

            return res.status(200).json({ studentTimelines });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    };

    // Update Student Timeline by ID
    const updateStudentTimeline = async (req, res) => {
        try {
            const timelineId = req.params.id;
            const { date, progress, attendanceStatus } = req.body;

            if (!date || !progress || !attendanceStatus) {
                return res.status(400).json({ error: 'Please provide date, progress, and attendance status' });
            }

            const studentTimeline = await StudentTimeline.findByPk(timelineId);

            if (!studentTimeline) {
                return res.status(404).json({ error: 'Student timeline not found' });
            }

            studentTimeline.date = date;
            studentTimeline.progress = progress;
            studentTimeline.attendanceStatus = attendanceStatus;

            await studentTimeline.save();

            return res.status(200).json({ message: 'Student timeline updated successfully' });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    };

    // Delete Student Timeline by ID
    const deleteStudentTimeline = async (req, res) => {
        try {
            const timelineId = req.params.id;
            const studentTimeline = await StudentTimeline.findByPk(timelineId);

            if (!studentTimeline) {
                return res.status(404).json({ error: 'Student timeline not found' });
            }

            await studentTimeline.destroy();

            return res.status(200).json({ message: 'Student timeline deleted successfully' });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    };

    module.exports = {
        createStudentTimeline,
        getStudentTimelinesByStudentId,
        updateStudentTimeline,
        deleteStudentTimeline,
    };
