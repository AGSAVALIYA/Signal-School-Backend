const DB = require('./models/index');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const AWS = require("aws-sdk");
// const s3 = new AWS.S3()
dotenv.config();



const app = express();
app.use(cors({
    origin: '*'
}));


app.options('*', cors());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

//use multi part form data



const AuthRoute = require('./routes/auth');
const OrganizationRoute = require('./routes/organization');
const SchoolRoute = require('./routes/school');
const TeacherRoute = require('./routes/teacher');
const StudentRoute = require('./routes/student');
const SubjectRoute = require('./routes/subject');
const AcademicYearRoute = require('./routes/academicYear');
const ClassRoute = require('./routes/class');
const StudentTimelineRoute = require('./routes/studenttimeline');
const ReportRoute = require('./routes/report');
const AttendanceRoute = require('./routes/attendance');
const SyllabusRoute = require('./routes/syllabus');
const CommonSubjectRoute = require('./routes/commonsubject');
const DashboardRoute = require('./routes/dashboard');   


app.use('/', AuthRoute);
app.use('/', OrganizationRoute);
app.use('/', SchoolRoute);
app.use('/', TeacherRoute);
app.use('/', StudentRoute);
app.use('/', SubjectRoute);
app.use('/', AcademicYearRoute);
app.use('/', ClassRoute);
app.use('/', StudentTimelineRoute);
app.use('/', ReportRoute);
app.use('/', AttendanceRoute);
app.use('/', SyllabusRoute);
app.use('/', CommonSubjectRoute);
app.use('/', DashboardRoute);


app.get('/', (req, res) => {
    res.send('Signal School API D220724');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
