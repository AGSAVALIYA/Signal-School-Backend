const Report = require("../models/Report");
const School = require("../models/School");
const Student = require("../models/Student");
const Subject = require("../models/Subject");


const createReport = async (req, res) => {
    if (!req.user) {
        throw new Error('You are not authorized to access this route');
    }

    const { reportType, content, grade, studentId, subjectId} = req.body;

    if ( !studentId || !subjectId) {
        throw new Error('Please provide all required fields');
    }

    const student = await Student.findOne({where: {id: studentId}});
    if (!student) {
        throw new Error('Student not found');
    }
    const classId = student.ClassId;
    const report = await Report.create({
        reportType,
        content,
        grade,
        GRNumber: student.GRNumber,
        StudentId: studentId,
        SubjectId: subjectId,
        ClassId : classId,
        AcademicYearId: student.AcademicYearId,
    });

    return res.status(201).json({message: 'Report created successfully', data: report});
}


const getCurrentAYReports = async (req, res) => {
    if (!req.user) {
        throw new Error('You are not authorized to access this route');
    }
    let schoolId;
    if (req.user === 'admin') {
        schoolId = req.currentSchool;
    } else if (req.user === 'teacher') {
        schoolId = req.teacher.currentSchool;
    }
    const studentId = req.params.studentId;
    const school = await School.findOne({where: {id: schoolId}});
    const reports = await Report.findAll(
        {
            where: {
                AcademicYearId: school.currentAcademicYear,
                StudentId: studentId
            },
            include: [
                {
                    model: Subject,
                    attributes: ['name']
                }
            ]
        }
        
        );
    // const reports = await Report.findAll({where: {AcademicYearId: school.currentAcademicYear}});
    return res.status(200).json({message: 'Reports fetched successfully', data: reports});
}



    
    
    
module.exports = {
    createReport,
    getCurrentAYReports
}