const School = require("../models/School");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Class = require("../models/Class");
const CommonSubject = require("../models/CommonSubject");
const Topic = require("../models/Topic");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const Attendance = require("../models/Attendance");
const { Sequelize } = require("sequelize");

const getDashboardData = async (req, res) => {
    try {
        let schoolId;
        
        if (req.user === "admin") {
            schoolId = req.admin.currentSchool;
        } else if (req.user === "teacher") {
            schoolId = req.teacher.currentSchoolId;
        } else {
            throw new Error('You are not authorized to access this route');
        }
        
        const school = await School.findOne({ where: { id: schoolId }, attributes: ['currentAcademicYear'] });
        const currentAcademicYear = school.currentAcademicYear;

        const totalStudents = await Student.count({ where: { SchoolId: schoolId, AcademicYearId: currentAcademicYear } });
        const totalTeachers = await Teacher.count({ include: [{ model: School, through: 'TeacherSchool', where: { id: schoolId } }] });
        const totalClasses = await Class.count({ where: { SchoolId: schoolId, AcademicYearId: currentAcademicYear } });
        const totalCommonSubjects = await CommonSubject.count({ where: { SchoolId: schoolId, AcademicYearId: currentAcademicYear } });

        // Calculate dates for the last `lastDays` days
        const lastDays = 7; // Change this to the number of days you want to consider
        const endDate = new Date(); // Today's date
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - lastDays + 1);

        const topicsCompleted = await Topic.findAll({
            attributes: [
                [Sequelize.fn('DATE', Sequelize.col('completedDate')), 'date'],
                [Sequelize.fn('COUNT', '*'), 'count']
            ],
            include: [{
                model: Chapter,
                attributes: [],  // Exclude Chapter.id from selection
                include: [{
                    model: Subject,
                    attributes: [],  // Exclude Subject.id from selection
                    include: [{
                        model: Class,
                        attributes: [],  // Exclude Class.id from selection
                        where: { SchoolId: schoolId, AcademicYearId: currentAcademicYear }
                    }]
                }]
            }],
            where: {
                completedDate: { [Sequelize.Op.between]: [startDate, endDate] }
            },
            group: [Sequelize.fn('DATE', Sequelize.col('completedDate'))],
            raw: true
        });
        

        const attendanceData = await Attendance.findAll({
            attributes: [
                'date',
                [Sequelize.fn('COUNT', '*'), 'count']
            ],
            include: [{
                model: Class,
                attributes: [],  // Exclude Class.id from selection
                where: { SchoolId: schoolId }
            }],
            where: {
                date: { [Sequelize.Op.between]: [startDate, endDate] },
                status: 'present'
            },
            group: ['date'],
            raw: true
        });

        // Prepare bar chart data
        const barChartData = {
            xAxis: [{ scaleType: 'band', data: [] }],
            series: [
                { data: [], name: 'Topics Completed' },
                { data: [], name: 'Students Present' }
            ]
        };

        // Generate labels and counts for topics completed
        const dateLabels = [];
        const topicsCompletedCounts = Array(lastDays).fill(0);
        const attendanceCounts = Array(lastDays).fill(0);

        // Populate date labels and initial counts
        for (let i = 0; i < lastDays; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            dateLabels.unshift(date.toLocaleDateString()); // Add date label in reverse order
        }

        // Populate topicsCompletedCounts
        topicsCompleted.forEach(item => {
            const dateIndex = dateLabels.indexOf(new Date(item.date).toLocaleDateString());
            if (dateIndex !== -1) {
                topicsCompletedCounts[dateIndex] = item.count;
            }
        });

        // Populate attendanceCounts
        attendanceData.forEach(item => {
            const dateIndex = dateLabels.indexOf(new Date(item.date).toLocaleDateString());
            if (dateIndex !== -1) {
                attendanceCounts[dateIndex] = item.count;
            }
        });

        // Assign data to barChartData object
        barChartData.xAxis[0].data = dateLabels.map(date => date); // Ensure date labels are in the correct format
        barChartData.series[0].data = topicsCompletedCounts;
        barChartData.series[1].data = attendanceCounts;

        return res.status(200).json({ 
            totalStudents, 
            totalTeachers, 
            totalClasses, 
            totalCommonSubjects, 
            barChartData 
        });

    } catch (error) {
        console.error('Error in getDashboardData:', error);
        return res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
}

module.exports = {
    getDashboardData,
}
