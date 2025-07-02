/**
 * Student Controller
 * Handles all student-related operations including CRUD operations, enrollment, and data management
 * Supports both individual and bulk operations for student management
 */

// Import required models and dependencies
const Student = require('../models/Student');
const AcademicYear = require('../models/AcademicYear');
const Class = require('../models/Class');
const School = require('../models/School');
const { Op } = require('sequelize');
const { uploadImageToAvatar } = require('../utils/s3Upload');
const Subject = require('../models/Subject');
const StudentTimeline = require('../models/StudentTimeline');
const Sequelize = require('sequelize');
const sequelize = require('../config/db');
const moment = require('moment');
const Attendance = require('../models/Attendance');
const csv = require('csvtojson'); // For CSV file processing
const CommonSubject = require('../models/CommonSubject');
const { createLog } = require('../utils/createLogs');

/**
 * NOTE: The following commented code shows an alternative implementation
 * for student creation. The current implementation includes additional features
 * like GR Number generation and enhanced validation.
 */
// const createStudent = async (req, res) => {
//     try {
//         if (!req.user) {
//             throw new Error('You are not authorized to access this route');
//         }

//         if (!req.admin && req.teacher) {
//             if (!req.teacher.currentSchool || req.teacher.currentSchool === null) {
//                 throw new Error('Create a school first');
//             }
//         }

//         if (!req.teacher && req.admin) {
//             if (!req.admin.currentSchool || req.admin.currentSchool === null) {
//                 throw new Error('Create a school first');
//             }
//         }

//         const name = req.body.name;
//         const age = req.body.age;
//         const dob = req.body.dob;
//         const ClassId = req.body.ClassId;
//         let schoolId;
//         if (req.admin) {
//             schoolId = req.admin.currentSchool;
//         }
//         if (req.teacher) {
//             schoolId = req.teacher.currentSchool;
//         }
//         const address = req.body.address;
//         if (!name || !age || !ClassId) {
//             throw new Error('All fields are required');
//         }
//         //get latest student from student table
//         const classDetails = await Class.findOne({ where: { id: ClassId } });
//         const AcademicYearId = classDetails.AcademicYearId;
//         if (req.body.GRNumber) {
//             //create student with GRNumber
//             const student = await Student.create({
//                 name: name,
//                 age: age,
//                 AcademicYearId: AcademicYearId,
//                 ClassId: ClassId,
//                 SchoolId: schoolId,
//                 address: address,
//                 dob: dob,
//                 GRNumber: req.body.GRNumber
//             });
//             return res.status(201).json({ message: 'Student created successfully', student });

//         }


//         //find student with biggest GRNumber
//         const lastStudent = await Student.findOne({ where: { SchoolId: schoolId }, order: [['GRNumber', 'DESC']] });
//         let GRNumber;
//         //GRNumber is LIKE GR1
//         if (lastStudent) {
//             GRNumber = 'GRN' + (parseInt(lastStudent.GRNumber.slice(3)) + 1);
//         }
//         else {
//             GRNumber = 'GRN1';
//         }

//         const student = await Student.create({
//             name: name,
//             age: age,
//             AcademicYearId: AcademicYearId,
//             ClassId: ClassId,
//             SchoolId: schoolId,
//             address: address,
//             dob: dob,
//             GRNumber: GRNumber
//         });
//         return res.status(201).json({ message: 'Student created successfully', student });

//     } catch (error) {
//         return res.status(500).json({ error: error.message })
//     }
// }
const createStudent = async (req, res) => {
    try {
        if (!req.user) {
            throw new Error('You are not authorized to access this route');
        }

        const isAdmin = req.admin ? true : false;
        const isTeacher = req.teacher ? true : false;

        if ((isAdmin || isTeacher) && !req.currentSchool) {
            throw new Error('Create a school first');
        }

        const { name, age, dob, ClassId, address, GRNumber , aadharNumber, panCardNumber, fatherName, motherName, contactNumber_1, contactNumber_2, bloodGroup, gender } = req.body;

        if (!name || !age || !ClassId) {
            throw new Error('All fields are required');
        }

        const classDetails = await Class.findOne({ where: { id: ClassId } });
        const AcademicYearId = classDetails.AcademicYearId;
        const schoolId = req.currentSchool;

        if (GRNumber) {
            // Create student with provided GRNumber
            const student = await Student.create({
                name, 
                age, 
                AcademicYearId, 
                ClassId, 
                SchoolId: schoolId, 
                address, 
                dob, 
                GRNumber,
                aadharNumber,
                panCardNumber,
                fatherName,
                motherName,
                contactNumber_1,
                contactNumber_2,
                bloodGroup,
                gender
            });

            if (isTeacher) {
                createLog('teacher', 'Create Student', `Created student ${name}`, req.teacher.id);
            }
            if (isAdmin) {
                createLog('admin', 'Create Student', `Created student ${name}`, req.admin.id);
            }
            return res.status(201).json({ message: 'Student created successfully', student });
        }

    
          
        const schoolPrefix = 'SCH'; // Adjust as needed
        const separator = '-'; // Adjust as needed
        // SELECT "GRNumber"
        // FROM public."Students"
        // ORDER BY SUBSTRING("GRNumber" FROM '(\d+)$')::integer DESC;
        const lastStudent = await Student.findOne({
            where: { SchoolId: schoolId },
            order: [sequelize.literal('CAST(SUBSTRING("GRNumber" FROM \'\\d+$\') AS INTEGER) DESC')],
          });
          
          
        const newNumericPart = lastStudent ? parseInt(lastStudent.GRNumber.split(separator)[1]) + 1 : 1;
        const newGRNumber = `${schoolPrefix}${schoolId}${separator}${newNumericPart}`;
        const student = await Student.create({
            name, 
            age, 
            AcademicYearId, 
            ClassId, 
            SchoolId: schoolId, 
            address, 
            dob, 
            GRNumber: newGRNumber,
            aadharNumber,
            panCardNumber,
            fatherName,
            motherName,
            contactNumber_1,
            contactNumber_2,
            bloodGroup,
            gender
        });

        if (isTeacher) {
            createLog('teacher', 'Create Student', `Created student ${name}`, req.teacher.id);
        }
        if (isAdmin) {
            createLog('admin', 'Create Student', `Created student ${name}`, req.admin.id);
        }
        
        return res.status(201).json({ message: 'Student created successfully', student });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};


const getAllStudents = async (req, res) => {
    try {
        if (!req.admin) {
            throw new Error('You are not authorized to access this route');
        }
        let students;
        // if (req.admin) {
        //     students = await Student.findAll({ where: { SchoolId: req.admin.currentSchool }, include: [{ model: Class, attributes: ['name'] }] });
        // }
        //get curent academic year
        let today = moment().format('YYYY-MM-DD');
        const school = await School.findOne({ where: { id: req.admin.currentSchool } });
        const currentAcademicYear = school.currentAcademicYear;
        students = await Student.findAll({ 
            where: { SchoolId: req.admin.currentSchool }, 
            include: [
                { model: Class, attributes: ['name'], where: { AcademicYearId: currentAcademicYear } },
                {model: Attendance, required: false, where: { date: today }}
            ] });

        students.sort((a, b) => {
            return a.name.localeCompare(b.name);
        }
        );
        students.forEach((student) => {
            if (student.Attendances.length > 0) {
                student.dataValues.todayStatus = student.Attendances[0].status;
            }
            else {
                student.dataValues.todayStatus = 'absent';
            }
        }
        );

        return res.status(200).json({ students });
    }
    catch (error) {
        return res.status(500).json({ error: error.message })
    }
}



//Retrieve list of all students
const getAllStudentsByClassId = async (req, res) => {
    try {
        const classId = req.params.classId;
        if (!req.admin && !req.teacher) {
            throw new Error('You are not authorized to access this route');
        }
        let students;
        let classDetails;
        let schoolId;
        if (req.admin) {
            schoolId = req.admin.currentSchool;
        }
        if (req.teacher) {
            schoolId = req.teacher.currentSchool;
        }


        const today = moment().format('YYYY-MM-DD');

        students = await Student.findAll({
          where: { SchoolId: schoolId, ClassId: classId },
          attributes: ['id', 'name', 'imageLink'],
          include: [
            // {
            //   model: StudentTimeline,
            //   required: false,
            //   where: { date: today },
            // },
            {
                model: Attendance,
                required: false,
                where: { date: today },
            }
          ],
        });
        

        classDetails = await Class.findOne({ where: { id: classId }, attributes: ['name'] });

        students.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

     
        students.forEach((student) => {
            if (student.Attendances.length > 0) {
                if(student.Attendances[0].status === 'present'){
                    student.dataValues.todayStatus = 'present';
                }
                else{
                    student.dataValues.todayStatus = 'absent';
                }
               
            }
            else {
                student.dataValues.todayStatus = null;
            }
        }
        );
        return res.status(200).json({ students, classDetails });
    }
    catch (error) {
        return res.status(500).json({ error: error.message })
    }
}

//Retrieve a single student by ID
const getStudentById = async (req, res) => {
    try {
        let schoolId;
        if (req.admin) {
            schoolId = req.admin.currentSchool;
        }
        if (req.teacher) {
            schoolId = req.teacher.currentSchool;
        }

        const studentId = req.params.id;


        const student = await Student.findOne({
            where: { id: studentId, SchoolId: schoolId },
            include: [
                { model: Class, attributes: ['name', 'id'], include: [{ model: Subject, attributes: ['name', 'id'] }] },
                { model: CommonSubject, attributes: ['name', 'id'] }
            ]
        });


        const Subjects = await student.getSubjects();
        student.dataValues.Subjects = Subjects;


        if (!student) {
            throw new Error('Student not found');
        }
        //from imageLink get SIGNED URL
        return res.status(200).json({ student });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

//Update a student
const updateStudent = async (req, res) => {
    try {
        if (!req.admin && !req.teacher) {
            throw new Error('You are not authorized to access this route');
        }
        const studentId = req.params.id;
        const name = req.body.name;
        const age = req.body.age;
        const dob = req.body.dob;
        const ClassId = req.body.ClassId;
        const address = req.body.address;
        const aadharNumber = req.body.aadharNumber;
        const panCardNumber = req.body.panCardNumber;
        const fatherName = req.body.fatherName;
        const motherName = req.body.motherName;
        const contactNumber_1= req.body.contactNumber_1;
        const contactNumber_2 = req.body.contactNumber_2;
        const bloodGroup = req.body.bloodGroup;
        const gender = req.body.gender;

        let CommonSubjects = req.body.CommonSubjects;
        if(CommonSubjects){
            //keep id
            CommonSubjects = CommonSubjects.map((subject) => subject.id);
        }

        if (!name || !age || !ClassId) {
            throw new Error('Something went wrong');
        }
        const student = await Student.update({
            name: name,
            age: age,
            ClassId: ClassId,
            address: address,
            dob: dob,
            aadharNumber: aadharNumber,
            panCardNumber: panCardNumber,
            fatherName: fatherName,
            motherName: motherName,
            contactNumber_1: contactNumber_1,
            contactNumber_2: contactNumber_2,
            bloodGroup: bloodGroup,
            gender: gender  
        }, { where: { id: studentId } });


        if (CommonSubjects) {
            const student = await Student.findOne({ where: { id: studentId } });
            await student.setCommonSubjects(CommonSubjects);
        }

        if (req.teacher) {
            createLog('teacher', 'Update Student', `Updated student ${name}`, req.teacher.id);
        }
        if (req.admin) {
            createLog('admin', 'Update Student', `Updated student ${name}`, req.admin.id);
        }

        return res.status(201).json({ message: 'Student updated successfully', student });

    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
}

//add avatar to student
const addAvatar = async (req, res) => {
    try {
        const studentId = req.params.id;
        const file = req.file;
        const student = await Student.findOne({ where: { id: studentId } });
        if (!student) {
            throw new Error('Student not found');
        }

        const data = await uploadImageToAvatar(req, res, file, { academicYearId: student.AcademicYearId, studentId: studentId });

        await Student.update(
            {
                imageLink: data.Location,
            },
            { where: { id: studentId } }
        );

        if (req.teacher) {
            createLog('teacher', 'Add Avatar', `Added photo of student ${student.name}`, req.teacher.id);
        }
        if (req.admin) {
            createLog('admin', 'Add Avatar', `Added avatar of student ${student.name}`, req.admin.id);
        }
        res.json({ message: 'Image uploaded successfully', imageLink: data.Location });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ error: error.message });
    }
};






//Delete a student
const deleteStudent = async (req, res) => {
    try {
        if (!req.admin) {
            throw new Error('You are not authorized to access this route');
        }

        const studentId = req.params.id;
        const student = await Student.destroy({ where: { id: studentId } });

        
        return res.status(201).json({ message: 'Student deleted successfully', student });

    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
}

const searchStudentNames = async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) {
            throw new Error('Name parameter is missing');
        }
        let schoolId;
        if (req.user === "admin") {
            schoolId = req.admin.currentSchool;
        }
        if (req.user === "teacher") {
            schoolId = req.teacher.currentSchool;
        }

        const school = await School.findOne({ where: { id: schoolId } });
        // Perform a case-insensitive search for student names
        const students = await Student.findAll({
            where: {
                name: {
                    [Op.iLike]: `%${name}%`,
                },
                //exclude current academic yEar students
                AcademicYearId: {
                    [Op.not]: school.currentAcademicYear,
                },
                SchoolId: schoolId,

            },
            include: [{ model: AcademicYear, attributes: ['name'] }],
            limit: 20,
        });

        //make name as name + academic year name
        // const studentNames = students.map((student) => {
        //     return {
        //         name: `${student.name} (${student.AcademicYear.name})`,
        //         id: student.id,
        //         classId: student.ClassId,
        //         imageLink: student.imageLink,
        //         GRNumber: student.GRNumber

        //     };
        // });


        //   const studentNames = students.map((student) => student.name);

        return res.status(200).json({ names: students });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

//get sample csv for add students   
const getSampleCsv = async (req, res) => {
    try {
        //sample csv for students TEST sTUDENT, 10, 15/05/2014, mUMBAI
        const csv = `name,age,dob,address\nTest Student,10,15/05/2014,Mumbai`;
        let classId = req.params.classId;
        if (!classId) {
            throw new Error('Class ID is required');
        }
        const classDetails = await Class.findOne({ where: { id: classId } });
        if (!classDetails) {
            throw new Error('Class not found');
        }
        //if class name contains spaces replace with underscore
        const className = classDetails.name.replace(/\s/g, '_');
        res.setHeader('Content-disposition', 'attachment; filename=`Students_of_${className}.csv`');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csv);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};


const getStudentsFromCsv = async (req, res) => {
    try {
        if (!req.admin && !req.teacher) {
            throw new Error('You are not authorized to access this route');
        }
        const file = req.file;
        const classId = req.params.classId;
        if (!classId) {
            throw new Error('Class ID is required');
        }
        const classDetails = await Class.findOne({ where: { id: classId } });
        if (!classDetails) {
            throw new Error('Class not found');
        }
        const schoolId = req.currentSchool;
        if (!schoolId) {
            throw new Error('Create a school first');
        }
        const academicYearId = classDetails.AcademicYearId;
        const data = await csv().fromFile(file.path);
        let students = [];
        for (let i = 0; i < data.length; i++) {
            let student = data[i];
            //date is in format dd/mm/yyyy
            let dob = student.dob;
            let newDob = moment(dob, 'DD/MM/YYYY').format('YYYY-MM-DD');
            // const studentData = {
            //     name: student.name,
            //     age: student.age,
            //     dob: newDob,
            //     address: student.address,
            //     ClassId: classId,
            //     SchoolId: schoolId,
            //     AcademicYearId: academicYearId
            // };
            // students.push(studentData);

            //GR NUMBER LOGIC
            const schoolPrefix = 'SCH'; // Adjust as needed
            const separator = '-'; // Adjust as needed

            const lastStudent = await Student.findOne({
                where: { SchoolId: schoolId },
                order: [sequelize.literal('CAST(SUBSTRING("GRNumber" FROM \'\\d+$\') AS INTEGER) DESC')],
            });
            const newNumericPart = lastStudent ? parseInt(lastStudent.GRNumber.split(separator)[1]) + 1 : 1;
            const newGRNumber = `${schoolPrefix}${schoolId}${separator}${newNumericPart}`;
            const studentData = {
                name: student.name,
                age: student.age,
                dob: newDob,
                address: student.address,
                ClassId: classId,
                SchoolId: schoolId,
                AcademicYearId: academicYearId,
                GRNumber: newGRNumber
            };
            students.push(studentData);
        }
        const createdStudents = await Student.bulkCreate(students);
        return res.status(201).json({ message: 'Students created successfully', createdStudents });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}


module.exports = {
    createStudent,
    getAllStudents,
    getStudentById,
    updateStudent,
    deleteStudent,
    getAllStudentsByClassId,
    searchStudentNames,
    addAvatar,
    getSampleCsv,
    getStudentsFromCsv
}
