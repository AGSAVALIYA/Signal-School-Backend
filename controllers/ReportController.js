const Report = require("../models/Report");
const Student = require("../models/Student");


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



    
    
    
module.exports = {
    createReport,
}