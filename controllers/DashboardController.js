const Class = require("../models/Class");
const School = require("../models/School");
const Student = require("../models/Student");
const Subject = require("../models/Subject");
const Teacher = require("../models/Teacher");



const getDashboardData = async (req, res) => {
    try {
        let schoolId;
    if(req.user =="admin"){
        schoolId = req.admin.currentSchoolId;
    }

    if(req.user =="teacher"){
        schoolId = req.teacher.currentSchoolId;
    }

    if (!req.admin) {
        throw new Error('You are not authorized to access this route');
    }
    // if (req.admin) {
    //     students = await Student.findAll({ where: { SchoolId: req.admin.currentSchool }, include: [{ model: Class, attributes: ['name'] }] });
    // }
    //get curent academic year
    const school = await School.findOne({ where: { id: schoolId } });
    const currentAcademicYear = school.currentAcademicYear;
    const totalStudents = await Student.count({ where: { SchoolId: schoolId , currentAcademicYear: currentAcademicYear } });

    // const totalTeachers = await TeacherSchool.count({ where: { SchoolId: schoolId } });
    const totalTeachers = await School.findByPk(schoolId, {
        include: [{
          model: Teacher,
          through: TeacherSchool, // make sure to include the association model
          attributes: [] // specify the attributes you need, or omit this line to get all attributes
        }],
      }).then(school => school.Teachers.length);


    const totalClasses = await Class.count({ where: { SchoolId: schoolId, AcademicYearId: currentAcademicYear } });

    const classes = await Class.findAll({ where: { SchoolId: schoolId } });
    const classIds = classes.map(cls => cls.id);

    const subjects = await Subject.findAll({ where: { classId: classIds } });
    const totalSubjects = subjects.length;

    const data = {
        totalStudents,
        totalTeachers,
        totalClasses,
        totalSubjects,
    }


    return res.status(200).json({ data: data });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: error.message });
    }


}

module.exports = {
    getDashboardData,
}