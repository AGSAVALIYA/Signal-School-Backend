const Teacher = require("../models/Teacher");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const School = require("../models/School");
const { uploadFacultyAvatar } = require("../utils/s3Upload");
const { createLog } = require("../utils/createLogs");
const Logs = require("../models/Logs");

//Teacher Login
const teacherLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        //Teacher.belongsToMany(School, { through: 'TeacherSchool' });
        
        const teacher = await Teacher.findOne({ where: { email: email }, include: { model: School} });
        //update teacher password by bycrypting
        if (teacher && await bcrypt.compare(password, teacher.password)) {
            const accessToken = jwt.sign({ email: teacher.email, id: teacher.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE_TIME });
            // res.status(200).json({ accessToken });
            //creent school data is school data from teacher.school where teacher.currentSchool = teacher.school.id
            const currentSchoolData = teacher.Schools.filter(school => school.id === teacher.currentSchool);
            const data = {
                id: teacher.id,
                name: teacher.name,
                email: teacher.email,
                currentSchool: teacher.currentSchool,
                currentSchoolData: currentSchoolData[0],
                schools: teacher.Schools
            }
            createLog('teacher', 'Login', `${teacher.name} logged in`, teacher.id);
            res.status(200).json({message: 'Login successful', data: data, accessToken});
        } else {
            res.status(401).json({ error: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}


//Create a teacher
const createTeacher = async (req, res) => {
    try {
        if (!req.admin) {
            throw new Error('You are not authorized to access this route');
        }
        if (!req.admin.OrganizationId || req.admin.OrganizationId === null) {
            throw new Error('Create an organization first');
        }
        const name = req.body.name;
        const email = req.body.email;
        let password = req.body.password;
        if (!name || !email) {
            throw new Error('All fields are required');
        }
        if(!password){
            // use email as password
            password = email;
        }

        //hash password
        const salt = await bcrypt.genSalt(10);
        password = await bcrypt.hash(password, salt);



        const teacher = await Teacher.create({
            name: name,
            email: email,
            password: password,
            currentSchool: req.admin.currentSchool,
        });
        //create entry in teacherschool table
        await teacher.addSchool(req.admin.currentSchool);
        return res.status(201).json({ message: 'Teacher created successfully', teacher });

    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
}

//Retrieve list of all teachers
const getAllTeachers = async (req, res) => {
    try {
        if (!req.admin) {
            throw new Error('You are not authorized to access this route');
        }

        if (!req.admin.currentSchool) {
            throw new Error('Admin does not have a current school');
        }

        // Find all teachers associated with the current school
        const teachers = await Teacher.findAll({
            include: [{
                model: School,
                through: 'TeacherSchool',
                where: {
                    id: req.admin.currentSchool,
                },
            }],
        });

        const teacherData = teachers.map(teacher => {
            return {
                id: teacher.id,
                name: teacher.name,
                email: teacher.email,
                imageLink: teacher.imageLink,
                contactNumber: teacher.contactNumber,
                currentSchool: teacher.currentSchool,
            }
        });


        return res.status(200).json({ teachers: teacherData });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};


//Retrieve a single teacher by ID
const getTeacherById = async (req, res) => {
    try {
        if (!req.admin) {
            throw new Error('You are not authorized to access this route');
        }
        let teacher;
        if (req.admin) {
            teacher = await Teacher.findOne({ where: { id: req.params.id } });
        }
        //get teacher school from teacherschool table

        return res.status(200).json({ teacher });
    }
    catch (error) {
        return res.status(500).json({ error: error.message })
    }
}

//Update a teacher
const updateTeacher = async (req, res) => {
    try {
        if (!req.admin) {
            throw new Error('You are not authorized to access this route');
        }
        const id = req.params.id;
        const name = req.body.name;
        const email = req.body.email;
        const contactNumber = req.body.contactNumber;
        if (!name || !email) {
            throw new Error('All fields are required');
        }
        const teacher = await Teacher.update({
            name: name,
            email: email,
            contactNumber: contactNumber
        }, { where: { id: id } });
        return res.status(201).json({ message: 'Teacher updated successfully', teacher });

    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
}

const updateTeacherPassword = async (req, res) => {
    try {
        if (!req.admin) {
            throw new Error('You are not authorized to access this route');
        }
        const id = req.params.id;
        let password = req.body.password;
        let confirmPassword = req.body.confirmPassword;
        if (!password || !confirmPassword) {
            throw new Error('All fields are required');
        }
        if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }
        //hash password
        const salt = await bcrypt.genSalt(10);
        password = await bcrypt.hash(password, salt);

        const teacher = await Teacher.update({
            password: password
        }, { where: { id: id } });

        return res.status(201).json({ message: 'Teacher password updated successfully', teacher });

    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
}

const getTeacherLogs = async (req, res) => {
    try {
        if (!req.admin) {
            throw new Error('You are not authorized to access this route');
        }
        const teacherId = req.params.id;
        // const logs = await Logs.findAll({ where: { teacherId: teacherId } });
        //order by created at desc
        const logs = await Logs.findAll({ where: { teacherId: teacherId }, order: [['createdAt', 'DESC']] });
        return res.status(200).json({ logs });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

const addTeacherAvatar = async (req, res) => {
    try {
        const teacherId = req.params.id;
        const file = req.file;
        const teacher = await Teacher.findOne({ where: { id: teacherId } });
        if (!teacher) {
            throw new Error('Teacher not found');
        }
        
        const data = await uploadFacultyAvatar(req, res, file, { facultyId: teacherId });

        await Teacher.update(
            {
                imageLink: data.Location,
            },
            { where: { id: teacherId } }
        );

        if (req.teacher) {
            createLog('teacher', 'Add Avatar', `Added photo of teacher ${teacher.name}`, req.teacher.id);
        }
        if (req.admin) {
            createLog('admin', 'Add Avatar', `Added avatar of teacher ${teacher.name}`, req.admin.id);
        }
        res.json({ message: 'Image uploaded successfully', imageLink: data.Location });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ error: error.message });
    }
};


//Delete a teacher
const deleteTeacher = async (req, res) => {
    try {
        if (!req.admin) {
            throw new Error('You are not authorized to access this route');
        }
        const id = req.params.id;
        const teacher = await Teacher.destroy({ where: { id: id, currentSchool: req.admin.currentSchool } });
        return res.status(201).json({ message: 'Teacher deleted successfully', teacher });

    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
}

module.exports = {
    teacherLogin,
    createTeacher,
    getAllTeachers,
    getTeacherById,
    updateTeacher,
    addTeacherAvatar,
    updateTeacherPassword,
    getTeacherLogs,
    deleteTeacher
}
