# Signal School Backend - Complete Documentation

## Table of Contents
- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Database Models](#database-models)
- [Model Relationships](#model-relationships)
- [API Routes](#api-routes)
- [Authentication & Authorization](#authentication--authorization)
- [File Upload & Storage](#file-upload--storage)
- [Environment Variables](#environment-variables)
- [Installation & Setup](#installation--setup)
- [Architecture Diagrams](#architecture-diagrams)

## Overview

Signal School Backend is a comprehensive school management system API built with Node.js, Express.js, and PostgreSQL. It provides functionality for managing organizations, schools, academic years, classes, students, teachers, subjects, attendance, reports, and more.

### Key Features
- Multi-tenant organization and school management
- Student and teacher management
- Academic year and class management
- Subject and syllabus management
- Attendance tracking
- Student timeline and progress tracking
- Report generation
- File upload to AWS S3
- JWT-based authentication
- Role-based access control (Admin/Teacher)

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Sequelize
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt
- **File Upload**: Multer with AWS S3
- **CSV Processing**: csvtojson
- **Date Handling**: Moment.js
- **CORS**: cors middleware

### Cloud Services
- **File Storage**: AWS S3
- **Database**: PostgreSQL (AWS RDS)

### Development Tools
- **Process Manager**: Nodemon (development)
- **Environment Management**: dotenv

## Project Structure

```
Signal-School-Backend/
├── config/
│   └── db.js                    # Database configuration
├── controllers/                 # Business logic controllers
│   ├── AcademicYearController.js
│   ├── AdminController.js
│   ├── AttendanceController.js
│   ├── ClassController.js
│   ├── CommonStubjectController.js
│   ├── DashboardController.js
│   ├── OrganizationController.js
│   ├── ReportController.js
│   ├── SchoolController.js
│   ├── StudentController.js
│   ├── StudentTimelineController.js
│   ├── SubjectController.js
│   ├── SyllabusController.js
│   ├── TeacherController.js
│   └── TeacherSchoolController.js
├── middlewares/                 # Authentication & authorization
│   ├── adminConstraint.js
│   ├── loginRequierd.js
│   └── tokenVerify.js
├── models/                      # Sequelize models
│   ├── AcademicYear.js
│   ├── Admin.js
│   ├── Attendance.js
│   ├── Chapter.js
│   ├── Class.js
│   ├── CommonSubject.js
│   ├── index.js                 # Model associations
│   ├── Logs.js
│   ├── Organization.js
│   ├── Report.js
│   ├── School.js
│   ├── Student.js
│   ├── StudentTimeline.js
│   ├── Subject.js
│   ├── Teacher.js
│   └── Topic.js
├── routes/                      # API route definitions
│   ├── academicYear.js
│   ├── attendance.js
│   ├── auth.js
│   ├── class.js
│   ├── commonsubject.js
│   ├── dashboard.js
│   ├── organization.js
│   ├── report.js
│   ├── school.js
│   ├── student.js
│   ├── studenttimeline.js
│   ├── subject.js
│   ├── syllabus.js
│   └── teacher.js
├── tmp/csv/                     # Temporary CSV storage
├── utils/                       # Utility functions
│   ├── adminDetails.js
│   ├── createLogs.js
│   └── s3Upload.js
├── package.json                 # Dependencies and scripts
└── server.js                    # Application entry point
```

## Database Models

### Organization
The top-level entity representing an educational organization.
```javascript
{
  id: INTEGER (Primary Key),
  name: STRING (Required),
  headOffice: STRING,
  contactNumber: STRING,
  createdAt: DATE,
  updatedAt: DATE
}
```

### Admin
Administrative users who manage organizations and schools.
```javascript
{
  id: INTEGER (Primary Key),
  name: STRING (Required),
  email: STRING (Required, Unique),
  password: STRING (Required, Hashed),
  currentSchool: INTEGER,
  userType: STRING (Default: 'admin'),
  OrganizationId: INTEGER (Foreign Key),
  createdAt: DATE,
  updatedAt: DATE
}
```

### School
Individual schools within an organization.
```javascript
{
  id: INTEGER (Primary Key),
  name: STRING (Required),
  address: STRING,
  contactNumber: STRING,
  location: STRING (Required),
  currentAcademicYear: INTEGER,
  OrganizationId: INTEGER (Foreign Key),
  createdAt: DATE,
  updatedAt: DATE
}
```

### Teacher
Teachers who can be associated with multiple schools.
```javascript
{
  id: INTEGER (Primary Key),
  name: STRING (Required),
  email: STRING (Required, Unique),
  password: STRING (Required, Hashed),
  imageLink: STRING,
  contactNumber: STRING,
  currentSchool: INTEGER (Required),
  createdAt: DATE,
  updatedAt: DATE
}
```

### AcademicYear
Academic year periods for schools.
```javascript
{
  id: INTEGER (Primary Key),
  name: STRING (Required),
  startDate: DATE (Required),
  endDate: DATE (Required),
  SchoolId: INTEGER (Foreign Key),
  createdAt: DATE,
  updatedAt: DATE
}
```

### Class
Classes within a school for a specific academic year.
```javascript
{
  id: INTEGER (Primary Key),
  name: STRING (Required),
  SchoolId: INTEGER (Foreign Key),
  AcademicYearId: INTEGER (Foreign Key),
  createdAt: DATE,
  updatedAt: DATE
}
```

### Student
Students enrolled in classes.
```javascript
{
  id: INTEGER (Primary Key),
  name: STRING (Required),
  age: INTEGER (Required),
  dob: DATE,
  address: STRING,
  GRNumber: STRING (Required, Auto-generated),
  imageLink: STRING,
  aadharNumber: STRING,
  panCardNumber: STRING,
  fatherName: STRING,
  motherName: STRING,
  contactNumber_1: STRING,
  contactNumber_2: STRING,
  gender: STRING,
  bloodGroup: STRING,
  ClassId: INTEGER (Foreign Key),
  SchoolId: INTEGER (Foreign Key),
  AcademicYearId: INTEGER (Foreign Key),
  createdAt: DATE,
  updatedAt: DATE
}
```

### Subject
Subjects taught in classes.
```javascript
{
  id: INTEGER (Primary Key),
  name: STRING (Required),
  SchoolId: INTEGER (Foreign Key),
  ClassId: INTEGER (Foreign Key),
  AcademicYearId: INTEGER (Foreign Key),
  createdAt: DATE,
  updatedAt: DATE
}
```

### CommonSubject
Subjects that are common across multiple classes/students.
```javascript
{
  id: INTEGER (Primary Key),
  name: STRING (Required),
  SchoolId: INTEGER (Foreign Key),
  AcademicYearId: INTEGER (Foreign Key),
  createdAt: DATE,
  updatedAt: DATE
}
```

### Chapter
Chapters within subjects for syllabus organization.
```javascript
{
  id: INTEGER (Primary Key),
  name: STRING (Required),
  SubjectId: INTEGER (Foreign Key),
  createdAt: DATE,
  updatedAt: DATE
}
```

### Topic
Individual topics within chapters.
```javascript
{
  id: INTEGER (Primary Key),
  content: TEXT,
  completedDate: DATE,
  ChapterId: INTEGER (Foreign Key),
  completedBy: INTEGER (Foreign Key to Teacher),
  createdAt: DATE,
  updatedAt: DATE
}
```

### StudentTimeline
Daily timeline entries for students.
```javascript
{
  id: INTEGER (Primary Key),
  date: DATE (Required),
  progress: STRING,
  attendanceStatus: STRING (Required),
  image: STRING,
  StudentId: INTEGER (Foreign Key),
  createdAt: DATE,
  updatedAt: DATE
}
```

### Attendance
Daily attendance records for students.
```javascript
{
  id: INTEGER (Primary Key),
  date: DATE (Required),
  studentId: INTEGER (Required, Foreign Key),
  classId: INTEGER (Required, Foreign Key),
  schoolId: INTEGER (Required, Foreign Key),
  status: ENUM('present', 'absent') (Required),
  createdAt: DATE,
  updatedAt: DATE,
  UNIQUE(studentId, date)
}
```

### Report
Academic reports for students.
```javascript
{
  id: INTEGER (Primary Key),
  reportType: ENUM('s1', 's2', 'annual') (Required),
  content: TEXT (Required),
  grade: STRING (Required),
  GRNumber: STRING (Required),
  StudentId: INTEGER (Foreign Key),
  SubjectId: INTEGER (Foreign Key),
  ClassId: INTEGER (Foreign Key),
  AcademicYearId: INTEGER (Foreign Key),
  createdAt: DATE,
  updatedAt: DATE
}
```

### Logs
System logs for admin and teacher actions.
```javascript
{
  id: INTEGER (Primary Key),
  userType: STRING (Required),
  action: STRING (Required),
  description: STRING (Required),
  teacherId: INTEGER (Foreign Key),
  adminId: INTEGER (Foreign Key),
  createdAt: DATE,
  updatedAt: DATE
}
```

## Model Relationships

```mermaid
erDiagram
    Organization ||--o{ School : "has many"
    Organization ||--o{ Admin : "has many"
    
    School ||--o{ AcademicYear : "has many"
    School ||--o{ SchoolClass : "has many"
    School ||--o{ Subject : "has many"
    School ||--o{ Student : "has many"
    School ||--o{ CommonSubject : "has many"
    School ||--o{ Attendance : "has many"
    School }o--o{ Teacher : "many-to-many (TeacherSchool)"
    
    AcademicYear ||--o{ SchoolClass : "has many"
    AcademicYear ||--o{ Report : "has many"
    AcademicYear ||--o{ CommonSubject : "has many"
    
    SchoolClass ||--o{ Student : "has many"
    SchoolClass ||--o{ Subject : "has many"
    SchoolClass ||--o{ Report : "has many"
    SchoolClass ||--o{ Attendance : "has many"
    
    Student ||--o{ StudentTimeline : "has many"
    Student ||--o{ Report : "has many"
    Student ||--o{ Attendance : "has many"
    Student }o--o{ Subject : "many-to-many (StudentSubject)"
    Student }o--o{ CommonSubject : "many-to-many (StudentCommonSubject)"
    
    Subject ||--o{ Chapter : "has many"
    Subject ||--o{ Report : "has many"
    Subject }o--o{ StudentTimeline : "many-to-many (SubjectStudentTimeline)"
    
    Chapter ||--o{ Topic : "has many"
    
    Teacher ||--o{ Topic : "completes topics"
    Teacher ||--o{ Logs : "has many"
    
    Admin ||--o{ Logs : "has many"
```

### Association Details

#### One-to-Many Relationships
- **Organization** → School, Admin
- **School** → AcademicYear, SchoolClass, Subject, Student, CommonSubject, Attendance
- **AcademicYear** → SchoolClass, Report, CommonSubject
- **SchoolClass** → Student, Subject, Report, Attendance
- **Student** → StudentTimeline, Report, Attendance
- **Subject** → Chapter, Report
- **Chapter** → Topic
- **Teacher** → Topic (completedBy), Logs
- **Admin** → Logs

#### Many-to-Many Relationships
- **Teacher** ↔ **School** (through TeacherSchool)
- **Student** ↔ **Subject** (through StudentSubject)
- **Student** ↔ **CommonSubject** (through StudentCommonSubject)
- **Subject** ↔ **StudentTimeline** (through SubjectStudentTimeline)

#### Foreign Key Relationships
- Student.ClassId → Class.id
- Student.SchoolId → School.id
- Student.AcademicYearId → AcademicYear.id
- Attendance.studentId → Student.id
- Attendance.classId → Class.id
- Attendance.schoolId → School.id

## API Routes

### Authentication Routes (`/`)

#### Admin Authentication
- `POST /admin/register` - Register new admin
- `POST /admin/login` - Admin login
- `GET /admin/getAll` - Get all admins
- `GET /admin/get/:id` - Get admin by ID
- `PUT /admin/update/:id` - Update admin (requires admin auth)
- `DELETE /admin/delete/:id` - Delete admin (requires admin auth)

#### Teacher Authentication
- `POST /teacher/login` - Teacher login

### Organization Routes (`/`)
- `POST /organization/create` - Create organization (admin only)
- `GET /organization/getAll` - Get all organizations
- `GET /organization/get/:id` - Get organization by ID
- `PUT /organization/update/:id` - Update organization (admin only)
- `DELETE /organization/delete/:id` - Delete organization (admin only)

### School Routes (`/`)
- `POST /school/create` - Create school (admin only)
- `GET /school/getAll` - Get all schools (authenticated)
- `GET /school/get/:id` - Get school by ID (authenticated)
- `PUT /school/update/:id` - Update school (admin only)
- `DELETE /school/delete/:id` - Delete school (admin only)
- `POST /school/switchByAdmin/:id` - Switch current school (admin only)

### Academic Year Routes (`/`)
- `POST /academicYear/create` - Create academic year (admin only)
- `POST /academicYear/setCurrentAcademicYear` - Set current academic year (admin only)
- `GET /academicYear/getAll` - Get all academic years (admin only)
- `GET /academicYear/get/:id` - Get academic year by ID (admin only)
- `PUT /academicYear/update/:id` - Update academic year (admin only)
- `DELETE /academicYear/delete/:id` - Delete academic year (admin only)

### Class Routes (`/`)
- `POST /class/create` - Create class (admin only)
- `GET /class/getAll` - Get all classes for current academic year (authenticated)
- `GET /class/getAll/:id` - Get classes by academic year ID (authenticated)
- `GET /class/get/:id` - Get class by ID (authenticated)
- `PUT /class/update/:id` - Update class (admin only)
- `DELETE /class/delete/:id` - Delete class (admin only)

### Student Routes (`/`)
- `POST /student/create` - Create student (authenticated)
- `GET /student/getAll` - Get all students (authenticated)
- `GET /student/getAll/:classId` - Get students by class ID (authenticated)
- `GET /student/get/:id` - Get student by ID (authenticated)
- `PUT /student/update/:id` - Update student (authenticated)
- `DELETE /student/delete/:id` - Delete student (authenticated)
- `GET /student/searchName` - Search students by name (authenticated)
- `POST /student/addAvatar/:id` - Add student avatar (authenticated)
- `GET /student/getSampleCsv/:classId` - Get sample CSV format (authenticated)
- `POST /student/uploadCsv/:classId` - Bulk upload students via CSV (authenticated)

### Teacher Routes (`/`)
- `POST /teacher/create` - Create teacher (admin only)
- `GET /teacher/getAll` - Get all teachers (admin only)
- `GET /teacher/get/:id` - Get teacher by ID (admin only)
- `PUT /teacher/update/:id` - Update teacher (authenticated)
- `PUT /teacher/updatePassword/:id` - Update teacher password (admin only)
- `POST /teacher/addAvatar/:id` - Add teacher avatar (authenticated)
- `GET /teacher/getLogs/:id` - Get teacher logs (admin only)
- `DELETE /teacher/delete/:id` - Delete teacher (admin only)

### Subject Routes (`/`)
- `POST /subject/create` - Create subject (admin only)
- `GET /subject/getAll/:classId` - Get subjects by class ID (authenticated)
- `GET /subject/get/:id` - Get subject by ID (admin only)
- `PUT /subject/update/:id` - Update subject (admin only)
- `DELETE /subject/delete/:id` - Delete subject (admin only)

### Common Subject Routes (`/`)
- `POST /commonsubject/create` - Create common subject (admin only)
- `GET /commonsubject/getAll/:academicYearId` - Get common subjects by academic year (admin only)
- `GET /commonsubject/getAll` - Get all common subjects (admin only)

### Syllabus Routes (`/`)
- `GET /syllabus/get/:subjectId` - Get syllabus by subject ID (authenticated)
- `POST /syllabus/add/:subjectId` - Add syllabus content (authenticated)
- `PUT /syllabus/update/:chapterId` - Update chapter (authenticated)
- `DELETE /syllabus/delete/:chapterId` - Delete chapter (authenticated)
- `GET /syllabus/getFull` - Get full syllabus for school (authenticated)
- `POST /syllabus/markTopicAsCompleted/:topicId` - Mark topic as completed (authenticated)
- `POST /syllabus/unMarkTopicAsCompleted/:topicId` - Unmark topic as completed (authenticated)

### Student Timeline Routes (`/`)
- Student timeline routes with image upload functionality

### Attendance Routes (`/`)
- `GET /attendance/:classId` - Get class-wise attendance

### Report Routes (`/`)
- `POST /report/create` - Create student report (authenticated)
- `GET /report/getForCurrAY/:studentId` - Get reports for current academic year (authenticated)

### Dashboard Routes (`/`)
- `GET /dashboard` - Get dashboard data (admin only)

## Authentication & Authorization

### Middleware Types

#### 1. adminConstraint
- Validates JWT token
- Ensures user is an admin
- Sets `req.admin` and `req.user = "admin"`

#### 2. tokenVerify
- Validates JWT token for both admin and teacher
- Supports multi-school teacher access
- Sets appropriate user context (`req.admin` or `req.teacher`)
- Sets `req.user` to "admin" or "teacher"

#### 3. loginRequired
- Basic JWT validation for both admin and teacher
- Less strict than other middleware

### JWT Token Structure
```javascript
{
  email: "user@example.com",
  id: 123,
  iat: 1234567890,
  exp: 1234567890
}
```

### User Types
- **Admin**: Full system access, can manage organizations, schools, teachers
- **Teacher**: Limited access, can manage students, subjects, attendance for their assigned schools

## File Upload & Storage

### AWS S3 Integration
- **Avatar uploads**: Student and teacher profile images
- **Timeline images**: Daily timeline photos
- **CSV uploads**: Bulk student data import

### Upload Configurations
```javascript
// Student/Teacher Avatars
bucket: process.env.AWS_AVATAR_BUCKET

// Timeline Images
bucket: process.env.AWS_TIMELINE_BUCKET

// CSV Processing
destination: 'tmp/csv/'
```

## Environment Variables

Required environment variables:

```env
# Database
POSTGRES_URL=postgresql://username:password@host:port/database

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE_TIME=24h

# AWS S3
AWS_IAM_ACCESS_KEY_ID=your_access_key
AWS_IAM_SECRET_ACCESS_KEY=your_secret_key
AWS_AVATAR_BUCKET=your_avatar_bucket
AWS_TIMELINE_BUCKET=your_timeline_bucket

# Server
PORT=3000
```

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL database
- AWS S3 account and buckets

### Installation Steps

1. **Clone the repository**
```bash
git clone <repository-url>
cd Signal-School-Backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment setup**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Database setup**
```bash
# Ensure PostgreSQL is running
# Database will be automatically synced on first run
```

5. **Run the application**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### Package.json Scripts
```json
{
  "dev": "nodemon server.js",    // Development with auto-reload
  "start": "node server.js"      // Production mode
}
```

## Architecture Diagrams

### System Architecture
```mermaid
graph TB
    Client[Client Applications] --> API[Express.js API Server]
    API --> Auth[JWT Authentication]
    API --> DB[(PostgreSQL Database)]
    API --> S3[AWS S3 Storage]
    
    subgraph "Middleware Layer"
        Auth --> AdminAuth[Admin Constraint]
        Auth --> TokenVerify[Token Verify]
        Auth --> LoginReq[Login Required]
    end
    
    subgraph "Controllers"
        API --> AdminCtrl[Admin Controller]
        API --> SchoolCtrl[School Controller]
        API --> StudentCtrl[Student Controller]
        API --> TeacherCtrl[Teacher Controller]
        API --> Others[Other Controllers...]
    end
    
    subgraph "Models & ORM"
        DB --> Sequelize[Sequelize ORM]
        Sequelize --> Models[Data Models]
    end
```

### Request Flow
```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Auth
    participant Controller
    participant Model
    participant DB
    
    Client->>API: HTTP Request + JWT Token
    API->>Auth: Validate Token
    Auth->>API: User Context
    API->>Controller: Route Handler
    Controller->>Model: Business Logic
    Model->>DB: SQL Query
    DB->>Model: Result
    Model->>Controller: Data
    Controller->>API: Response Data
    API->>Client: HTTP Response
```

### Database Schema Overview
```mermaid
graph LR
    Org[Organization] --> School[School]
    Org --> Admin[Admin]
    School --> AY[Academic Year]
    School --> SchoolClass[Class]
    School --> Student[Student]
    School --> Teacher[Teacher]
    SchoolClass --> Subject[Subject]
    Subject --> Chapter[Chapter]
    Chapter --> Topic[Topic]
    Student --> Timeline[Student Timeline]
    Student --> Attendance[Attendance]
    Student --> Report[Report]
```

### Multi-Tenant Architecture
```mermaid
graph TB
    subgraph "Organization 1"
        Org1[Organization] --> School1A[School A]
        Org1 --> School1B[School B]
        School1A --> Students1A[Students]
        School1B --> Students1B[Students]
    end
    
    subgraph "Organization 2"
        Org2[Organization] --> School2A[School A]
        Org2 --> School2B[School B]
        School2A --> Students2A[Students]
        School2B --> Students2B[Students]
    end
    
    subgraph "Shared Resources"
        Teachers[Teachers] -.-> School1A
        Teachers -.-> School1B
        Teachers -.-> School2A
        Teachers -.-> School2B
    end
```

## API Response Formats

### Success Response
```json
{
  "message": "Operation successful",
  "data": { /* response data */ }
}
```

### Error Response
```json
{
  "error": "Error message description"
}
```

### Authentication Response
```json
{
  "message": "Login successful",
  "data": { /* user data */ },
  "accessToken": "jwt_token_here"
}
```

## Key Features Implementation

### 1. GR Number Generation
- Auto-generated format: `SCH{schoolId}-{incrementalNumber}`
- Ensures unique student identification per school

### 2. Multi-School Teacher Support
- Teachers can be associated with multiple schools
- Current school context maintained for operations

### 3. Academic Year Management
- Schools can have multiple academic years
- Current academic year setting affects data filtering

### 4. Attendance Tracking
- Daily attendance with unique constraint per student per date
- Integration with student timeline for progress tracking

### 5. Syllabus Management
- Hierarchical structure: Subject → Chapter → Topic
- Topic completion tracking by teachers

### 6. Report Generation
- Multiple report types: s1, s2, annual
- Associated with students, subjects, and academic years

### 7. Activity Logging
- Comprehensive logging system for admin and teacher actions
- Audit trail for system operations

This documentation provides a complete overview of the Signal School Backend system, including its architecture, database design, API endpoints, and implementation details.
