const CommonSubject = require('../models/CommonSubject');
const AcademicYear = require('../models/AcademicYear');
const School = require('../models/School');


//Create a common subject
const createCommonSubject = async (req, res) => {
    try {
        if (!req.admin) {
            throw new Error('You are not authorized to access this route');
        }
        if (!req.admin.currentSchool || req.admin.currentSchool === null) {
            throw new Error('Create a school first');
        }
        const name = req.body.name;
        if (!name) {
            throw new Error('All fields are required');
        }
        const newCommonSubject = await CommonSubject.create({
            name: name,
            SchoolId: req.admin.currentSchool,
            AcademicYearId: req.body.AcademicYearId
        });
        return res.status(201).json({ message: 'Common subject created successfully', newCommonSubject });

    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
}

//Retrieve list of all common subjects
const getAllCommonSubjects = async (req, res) => {
    try {
        if (!req.admin) {
            throw new Error('You are not authorized to access this route');
        }
        if (!req.admin.currentSchool || req.admin.currentSchool === null) {
            throw new Error('Create a school first');
        }
        let academicYearId = req.params.academicYearId;
        if (!academicYearId) {
            const school = await School.findOne({ where: { id: req.admin.currentSchool } , attributes: ['currentAcademicYear']});
            academicYearId = school.currentAcademicYear;
        }
        
        const commonSubjects = await CommonSubject.findAll({ where: { AcademicYearId: academicYearId } , attributes: ['id', 'name']});
        return res.status(200).json({ commonSubjects });
    }
    catch (error) {
        return res.status(500).json({ error: error.message })
    }
}

//add Students to common subject
const addStudentsToCommonSubject = async (req, res) => {
    try {
        if (!req.admin) {
            throw new Error('You are not authorized to access this route');
        }
        if (!req.admin.currentSchool || req.admin.currentSchool === null) {
            throw new Error('Create a school first');
        }''
        const commonSubjectId = req.params.commonSubjectId;
        const students = req.body.students;
        const school = await School.findOne({ where: { id: req.admin.currentSchool } , attributes: ['currentAcademicYear']});
        const academicYearId = school.currentAcademicYear;
        if (!commonSubjectId || !students) {
            throw new Error('All fields are required');
        }
        const commonSubject = await CommonSubject.findOne({ where: { id: commonSubjectId } });
        if (!commonSubject) {
            throw new Error('Common subject not found');
        }
        await commonSubject.addStudents(students, { through: { AcademicYearId: academicYearId } });
        return res.status(200).json({ message: 'Students added to common subject successfully' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message })
    }
}


//add single student to common subject
const addSingleStudentToCommonSubject = async (req, res) => {
    try {
        if (!req.admin) {
            throw new Error('You are not authorized to access this route');
        }
        if (!req.currentSchool || req.currentSchool === null) {
            throw new Error('Create a school first');
        }
        const commonSubjectId = req.params.commonSubjectId;
        const studentId = req.params.studentId;
        const school = await School.findOne({ where: { id: req.admin.currentSchool } , attributes: ['currentAcademicYear']});
        const academicYearId = school.currentAcademicYear;
        if (!commonSubjectId || !studentId) {
            throw new Error('All fields are required');
        }
        const commonSubject = await CommonSubject.findOne({ where: { id: commonSubjectId } });
        if (!commonSubject) {
            throw new Error('Common subject not found');
        }
        await commonSubject.addStudent(studentId, { through: { AcademicYearId: academicYearId } });
        return res.status(200).json({ message: 'Student added to common subject successfully' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message })
    }
}

module.exports = {
    createCommonSubject,
    getAllCommonSubjects,
    addStudentsToCommonSubject,
    addSingleStudentToCommonSubject
};
