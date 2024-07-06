const StudentTimeline = require('../models/StudentTimeline');
const dotenv = require('dotenv');
const AWS = require("aws-sdk");
const Student = require('../models/Student');
const { uploadImageToTimeline } = require('../utils/s3Upload');
const moment = require('moment');
const Attendance = require('../models/Attendance');
const Subject = require('../models/Subject');

//CONFIG FOR THE UPLOAD
dotenv.config();



const createStudentTimeline = async (req, res) => {
    try {
        let attendenceDate = req.body.attendenceDate;
        let progress = req.body.progress;
        let attendanceStatus = req.body.attendanceStatus;
        let studentId = req.body.studentId;
        let subjects = req.body.subjects;
        //parse subject string to array
        //convert to json and int
        subjects = JSON.parse(subjects);
        subjects = subjects.map((subject) => parseInt(subject));


        // attendenceDate = new Date(attendenceDate);
        attendenceDate = moment(attendenceDate).format('YYYY-MM-DD');

        if (!attendenceDate || !attendanceStatus || !studentId) {
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
                    date: attendenceDate,
                    progress,
                    attendanceStatus,
                    image: req.files ? req.files.timelineImg ? req.files.timelineImg[0].location : null : null,
                    StudentId: studentId
                });
            } else {
                studentTimeline = await StudentTimeline.create({
                    date: attendenceDate,
                    progress,
                    attendanceStatus,
                    StudentId: studentId
                });
            }
            studentTimeline.setSubjects(subjects);
            if(attendanceStatus === 'present'){
                const attendance = await Attendance.findOne({ where: { studentId, date: attendenceDate } });

                if(!attendance){
                    await Attendance.create({
                        studentId,
                        classId: student.ClassId,
                        date: attendenceDate,
                        schoolId: student.SchoolId,
                        status: 'present'
                    });
                }else{
                    if(attendance.status === 'absent'){
                        attendance.status = 'present';
                        console.log('attendance status is absent');
                        await attendance.save();
                    }
                }

            }
            else if(attendanceStatus === 'absent'){
                const attendance = await Attendance.findOne({ where: { studentId, date: attendenceDate } });

                if(!attendance){
                    await Attendance.create({
                        studentId,
                        classId: student.ClassId,
                        date: attendenceDate,
                        schoolId: student.SchoolId,
                        status: 'absent'
                    });
                }else{
                    if(attendance.status === 'present'){
                        attendance.status = 'absent';
                        console.log('attendance status is present');
                        await attendance.save();
                    }
                }
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
                include: [
                    {
                        model: Subject,
                        through: { attributes: [] },
                    },
                ],
                order: [['createdAt', 'DESC']],
            });

            studentTimelines.forEach((timeline) => {
                timeline.Subjects = timeline.Subjects.map((subject) => subject.name);
            }
            );


            return res.status(200).json({ studentTimelines });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    };



    // Update Student Timeline by ID
    const updateStudentTimeline = async (req, res) => {
        try {
            const timelineId = req.params.id;
            const { attendenceDate, progress, attendanceStatus } = req.body;

            if (!attendenceDate || !progress || !attendanceStatus) {
                return res.status(400).json({ error: 'Please provide date, progress, and attendance status' });
            }

            const studentTimeline = await StudentTimeline.findByPk(timelineId);

            if (!studentTimeline) {
                return res.status(404).json({ error: 'Student timeline not found' });
            }

            studentTimeline.date = attendenceDate;
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


    const bulkCreateStudentTimeline = async (req, res) => {
        try {
            const classId = req.params.classId;
            const studentIds = req.body.studentIds;
            const attendenceDate = req.body.attendenceDate;
            const progress = req.body.progress;
            const subjects = req.body.subjects;

            if (!classId || !studentIds || !attendenceDate || !progress || !subjects) {
                return res.status(400).json({ error: 'Please provide all required fields' });
            }

            //parse subject string to array
            //convert to json and int
            subjects = JSON.parse(subjects);
            subjects = subjects.map((subject) => parseInt(subject));

            // attendenceDate = new Date(attendenceDate);
            attendenceDate = moment(attendenceDate).format('YYYY-MM-DD');

            const students = await Student.findAll({ where: { id: studentIds } });

            if (!students) {
                return res.status(404).json({ error: 'Students not found' });
            }

            const studentTimelines = await StudentTimeline.bulkCreate(
                students.map((student) => ({
                    date: attendenceDate,
                    progress,
                    StudentId: student.id,
                }))
            );

            studentTimelines.forEach((timeline) => {
                timeline.setSubjects(subjects);
            });

            if (req.files) {
                //keep same image for all students
                const image = req.files.timelineImg ? req.files.timelineImg[0].location : null;
                studentTimelines.forEach((timeline) => {
                    timeline.image = image;
                    timeline.save();
                });
                
            }


            //mark present in attendance
            students.forEach(async (student) => {
                const attendance = await Attendance.findOne({ where: { studentId: student.id, date: attendenceDate } });

                if (!attendance) {
                    await Attendance.create({
                        studentId: student.id,
                        classId,
                        date: attendenceDate,
                        schoolId: student.SchoolId,
                        status: 'present',
                    });
                } else {
                    if (attendance.status === 'absent') {
                        attendance.status = 'present';
                        await attendance.save();
                    }
                }
            });

            return res.status(201).json({ message: 'Student timelines created successfully', studentTimelines });
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }



    module.exports = {
        createStudentTimeline,
        getStudentTimelinesByStudentId,
        updateStudentTimeline,
        deleteStudentTimeline,
        bulkCreateStudentTimeline
    };
