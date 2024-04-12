const sequelize = require("../config/db");
const Attendance = require("../models/Attendance");

const getClassWiseAttendance = async (req, res) => {
    try {
        const { classId } = req.params;

        const attendance = await Attendance.findAll({
            where: { classId },
            include: [{ model: sequelize.models.Student, attributes: ['id', 'name']}],
        
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


        res.status(200).json({ data: groupedAttendance });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getClassWiseAttendance
};
