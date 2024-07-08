const { Op } = require("sequelize");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");

const getClassWiseAttendance = async (req, res) => {
    try {
        const { classId } = req.params;
        const {startDate, endDate} = req.query;
        // const attendance = await Attendance.findAll({
        //     where: { classId },
        //     include: [{ model: sequelize.models.Student, attributes: ['id', 'name']}],
        
        // }); 
        // //group by date
        // const groupedAttendance = attendance.reduce((acc, obj) => {
        //     const key = obj.date;
        //     if (!acc[key]) {
        //         acc[key] = [];
        //     }
        //     acc[key].push(obj);
        //     return acc;
        // }, {});

        const attendance = await Attendance.findAll({
            where: { classId, date: { [Op.between]: [startDate, endDate] } },
            include: [{ model: Student, attributes: ['id', 'name']}],
        
        });

        //group by date
        const groupedAttendance = attendance.reduce((acc, obj) => {
            const key = obj.date;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(obj);
            return acc;
        }, {});


        //sort by name
        for (const key in groupedAttendance) {
            groupedAttendance[key].sort((a, b) => {
                if (a.Student.name < b.Student.name) {
                    return -1;
                }
                if (a.Student.name > b.Student.name) {
                    return 1;
                }
                return 0;
            });
        }



        res.status(200).json({ data: groupedAttendance });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getClassWiseAttendance
};
