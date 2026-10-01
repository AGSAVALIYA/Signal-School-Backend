# 01 — Inventory of Signal School, with Feedback and Recommendations

Every module, data model, API endpoint, page, component, utility and dependency in **Signal-School-Backend** and **Signal-School-Frontend** is listed here. Next to each item:

- **Status**: what the code shows, based on reading every line.
- **Tester feedback**: what a non-technical teacher or admin is likely to feel, written as their notes.
- **Recommendation**: what to change.

Symbols are defined in the [README](README.md#legend): ✅ ⚠️ ❌ 🚫 💀, and severity S1 to S4. Bug IDs such as `BUG-012` point to [05-issues-register.md](05-issues-register.md).

> In this round everything comes from reading the code ("predicted"). In the next round each line gets checked through the test cases in [03-test-cases.md](03-test-cases.md).

---

## 0. System at a glance

```
 ┌─────────────── Browser (one React app, CRA 5, MUI 5) ───────────────┐
 │  App.js reads localStorage.userInfo.userType                         │
 │    ├── "admin"   → AdminMain (drawer + 12 routes, desktop layout)    │
 │    ├── "teacher" → TeacherMain (bottom nav + 7 routes, mobile)       │
 │    └── none      → Login (Teacher/Admin tabs, admin self-register)   │
 │  Google "GTranslate" widget (teacher side only) = current i18n       │
 └──────────────┬───────────────────────────────────────────────────────┘
                │ axios, Bearer JWT stored in localStorage
 ┌──────────────▼──────────── Express 4 API (server.js) ────────────────┐
 │ 14 route files mounted on "/" → 72 endpoints + "/" health            │
 │ middlewares: adminConstraint (admin only), tokenVerify (admin|teacher)│
 │ Sequelize 6 → PostgreSQL (sync({alter:true}) on every boot)          │
 │ multer-s3 → 3 S3 buckets (student avatar, timeline, faculty)         │
 └──────────────────────────────────────────────────────────────────────┘
```

Hierarchy: **Organization → School → Academic Year → Class → Student** (students are copied into a new row every year). There are no roles beyond `admin` and `teacher`, and no link between a teacher and the classes they teach.

---

## 1. Modules (business capabilities)

| ID | Module | Where (BE / FE) | Status | Tester feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| M01 | **Login & session** | `AdminController`, `TeacherController.teacherLogin`, middlewares / `Login.js` | ⚠️ | "The page opens on **Admin**, but I'm a teacher. It asks for 'Username', but my login is an email. The red message vanished before I could read it. After some days everything showed empty and nothing told me to log in again." | Open on Teacher by default (or one login that works out the role). Label the field "Email or mobile". Keep messages until dismissed. Log out on 401 and say why. Add a show-password eye, Enter-to-submit, and a forgot-password flow. | S2 |
| M02 | **Admin self-registration** | `POST /admin/register` / Login "Need to register?" | ⚠️ | "Anyone can make an admin account? Is my school data safe?" | Turn off public registration. Create admins only by invite from the org owner (or a super-admin script). | S1 |
| M03 | **Organization setup** | `OrganizationController` / `OrganizationForm.js` | ⚠️ | "I filled it once. I can't see or edit it anywhere afterwards." | Add an "Organization profile" page with edit. Block a second org create for the same admin. | S3 |
| M04 | **School management & switching** | `SchoolController` / `SchoolForm`, `SchoolInfo`, `SchoolList` | ⚠️ | "Switch works. The logo is a picture from some news website. I can't delete a school I made by mistake." | Scope everything to the admin's organization (cross-org switch is possible today, BUG-004). Add a school logo upload, archive instead of delete, and show the current academic year in the header. | S1 |
| M05 | **Academic years** | `AcademicYearController` / `AcademicYearList` (inside School page) | ❌ | "I deleted the wrong year with one click and there was no warning. I can't fix a typo in the dates. Starting a new year means re-typing every class, subject, syllabus and student." | Add the **rollover wizard** and **global year switcher** ([07-academic-year-design.md](07-academic-year-design.md)). Add an edit form, a confirm dialog, and a delete block when the year has data. Show dates as DD/MM/YYYY. | S1 |
| M06 | **Classes** | `ClassController` / `Settings → ClassForm` | ❌ | "I can add a class but can't rename or delete it. A class added without picking a year disappears." | Fix update/delete (BUG-020/021). Make the year required (default current). Add rename/delete/reorder. Use Grade + Section model. | S2 |
| M07 | **Subjects** | `SubjectController` / `Settings → SubjectForm` | ⚠️ | "No edit or delete. Each year I add Marathi, English and Maths again for every class." | Add edit/delete. Copy subjects during rollover. Allow a "subject template per grade". | S2 |
| M08 | **Common subjects (activities)** | `CommonStubjectController` / `CommonSubjectForm`, student edit | ⚠️ | "I don't understand 'Common Subject'." | Rename to "Activities / Extra subjects" in plain words. Add edit/delete and bulk assign to a whole class. | S3 |
| M09 | **Teacher management** | `TeacherController` / `TeachersList`, `TeacherDetails`, `AddTecher`, `TeacherTable`, `TeacherLogs` | ⚠️ | "The Class filter on the teacher list crashed the page. After I made a teacher inactive I can't find them again. I can't say which classes a teacher teaches." | Fix the crash (BUG-040). Add an Inactive tab and reactivate (backend exists but isn't routed). Add teacher↔class/subject assignment. Have the admin set a temporary password and force a change on first login. | S2 |
| M10 | **Teacher self-service (profile)** | `MyInfo.js` | ⚠️ | "My photo is blank. 'Switch' next to my other school does nothing. I can't change my own password." | Add a teacher self-profile API (photo, phone, password, language). Make school switch work. | S3 |
| M11 | **Student management** | `StudentController` / `StudentsList`, `StudentInfo`, `StudentDetails`, `AddStudent`; teacher: `StudentsList`, `StudentDetail`, `AddNewStudent` | ⚠️ | "To add a child I must type age **and** date of birth. There's no parents' phone in the add form. The student list says 'Absent' for children whose attendance nobody has taken yet. The Academics tab shows marks that aren't my students'." | Use one shared student form. Calculate age from DOB. Ask for guardian name + phone first. Show "Not marked" separately from Absent. Replace the dummy Academics tab. Make delete a "Left school" action with a reason. | S1 |
| M12 | **Bulk student import (CSV)** | `getSampleCsv`, `getStudentsFromCsv` / `BulkStudent.js` (commented out) | ❌ | "I can't find the upload option. (When we tested it, every student got the same GR number.)" | Build an admin "Import students from Excel" page: download template, preview rows, show errors per row, then confirm. Fix GR generation (BUG-013). | S2 |
| M13 | **Attendance (teacher)** | `StudentTimelineController.create/bulkCreate` / `AttendenceClassWise`, `StudentChip`, `BulkAttendence` | ⚠️ | "Which icon is attendance? I tap each child's name, a big form opens, and I press Present: 40 children takes ages. 'Bulk' wants me to pick subjects just to mark attendance, and can't mark anyone absent. The page reloaded and I wasn't sure it saved." | Build a dedicated **Take Attendance** screen: everyone Present by default, tap the absent ones, one Save, and a summary such as "38 present / 2 absent ✔ Saved". Keep the daily learning note separate. | S1 |
| M14 | **Attendance reports (admin)** | `AttendanceController` / `Attendance.js`, `ExportAttendanceButton` | ⚠️ | "I have to pick a class every time. Students nobody marked are missing. There's no monthly register or percentage. The PDF is English only." | Add a monthly register grid (students × days), percentages, a school-wide "today" summary, and Excel export. Embed Unicode fonts in PDF. Add auth to the endpoint (BUG-002). | S1 |
| M15 | **Daily learning timeline** | `StudentTimeline*` / teacher & admin `StudentTimeline.js` | ⚠️ | "Nice to see the history. Marking attendance twice shows the same day twice. The admin can delete but the teacher can't fix a mistake." | Separate it from attendance (one note per student per day, editable by its author). Group by month. Compress photos before upload. | S2 |
| M16 | **Academic reports / grades** | `ReportController` / `AcademicDetails.js` (teacher), dummy tab (admin) | ❌ | "I pressed Add Report, nothing appeared and nothing said it failed. The admin's Academics tab shows Maths A, Science B for every child." | Add a proper marks/remarks entry per term, a printable report card PDF, and error handling (an invalid report can crash the server, BUG-006). | S1 |
| M17 | **Syllabus & topic progress** | `SyllabusController` / `SyllabusForm`, `ChapterChip`, `MarkTopicCompleted` (admin), `Syllabus.js` (teacher) | ❌ | "Deleting a chapter does nothing. When I fixed a typo in a chapter, all the 'done' ticks disappeared. Marking a topic done shows an error even though it worked. Teachers see every class's syllabus in deep folders." | Fix BUG-030/031/032. Show each teacher their own classes first. Add progress bars (% topics done per subject). Copy the syllabus during rollover. | S1 |
| M18 | **Dashboard (admin)** | `DashboardController` / `Home.js` | ⚠️ | "'Total Courses' is actually classes. The chart is cut off on my laptop. I want to see which classes haven't taken attendance today." | Make it actionable: today's attendance %, classes not marked, absentees, syllabus % by class, birthdays. Make it responsive. | S3 |
| M19 | **Activity logs / audit** | `utils/createLogs`, `Logs` model / `TeacherLogs.js` | ⚠️ | "Useful to see what a teacher did, but admin actions aren't shown anywhere." | Add an audit log table with entity/before/after, an admin audit page, and filters. | S3 |
| M20 | **File/photo uploads** | `utils/s3Upload.js`, timeline multer / `UploadAvatar*`, chips | ⚠️ | "iPhone photos fail with 'Image only!'. Uploading on mobile data is slow." | Compress and resize client-side to about 200 KB. Accept HEIC/WebP. Set a size limit. Make buckets private with signed URLs (children's photos). | S2 |
| M21 | **Multi-language** | `public/index.html`, `GTranslateWraper.js`, `MyInfo.js` | ❌ (gimmick) | "Marathi turns my students' names into strange words. The page flickers. The option is hidden in 'My Info' and missing on the login page and the admin side." | Replace with real i18n ([06-multilingual-design.md](06-multilingual-design.md)). | S1 |
| M22 | **Offline / PWA** | `service-worker.js` (unregistered) | 🚫 | "No network in my classroom, so the app is useless there." | Add a PWA with an offline attendance queue (Phase 6). | S2 |
| M23 | **Notifications / parent communication** | — | 🚫 | "Can parents get an SMS when their child is absent?" | Phase 7 (feature gap FG-12). | S3 |
| M24 | **Teacher ↔ class assignment / timetable** | — (`/schedule` placeholder) | 🚫 | "Show me only MY classes." | Add a teacher_assignments table and a "My classes" home ([08-schema](08-schema-changes.md)). | S2 |
| M25 | **Roles & permissions** | only admin/teacher | 🚫 | "Our clerk needs to add students but must not delete teachers." | Add roles owner/admin/principal/clerk/teacher with a permission matrix. | S3 |
| M26 | **Data export / backup** | only attendance PDF | 🚫 | "I need the student list in Excel for the government." | Add Excel exports (students, attendance register, syllabus progress) and nightly DB backups. | S2 |

---

## 2. Data models (database tables)

| ID | Model / table | Key fields | Status | Feedback (technical) | Recommendation | Sev |
|---|---|---|---|---|---|---|
| DM01 | `Admins` | name, email (unique), password, currentSchool (int, no FK), userType, OrganizationId | ⚠️ | Password hash is returned to the client in every `adminDetails` response (BUG-003). `currentSchool` has no FK constraint. | Merge into a `users` table with roles. Never return `password` (use a `defaultScope` that excludes it). | S1 |
| DM02 | `Teachers` | name, email (unique), password, imageLink, contactNumber, currentSchool, status(active/inactive) | ⚠️ | Email unique across the system, so a teacher can't also be an admin with the same email. `belongsToMany(School)` is declared twice (`Teacher.js:49`, `index.js:110`). Hash leaks via `GET /teacher/get/:id`. | Same `users` table, plus `user_schools`. | S1 |
| DM03 | `Organizations` | name, headOffice, contactNumber | ✅ | No owner/plan/settings. | Add `settings JSONB` (default language, GR prefix). | S4 |
| DM04 | `Schools` | name, address, contactNumber, location (NOT NULL), currentAcademicYear (int, no FK), OrganizationId | ⚠️ | No FK on current year. No GR prefix/sequence. No timezone. | Add `current_academic_year_id` FK, `gr_prefix`, `next_gr_number`, `default_language`, `udise_code`, `logo_url`. | S3 |
| DM05 | `AcademicYears` | name, startDate, endDate, SchoolId | ⚠️ | No status, no unique name per school, no overlap/start<end checks. | Add `status (planned/active/closed)`, unique (school_id, name), check constraint. | S2 |
| DM06 | `Classes` | name, SchoolId, AcademicYearId (nullable) | ⚠️ | Year-scoped name only. No order. No grade concept, so promotion "to next class" can't be automated. | Split into `grades` (permanent, ordered, next_grade_id) and `class_sections` (per year). | S1 |
| DM07 | `Subjects` | name, ClassId, AcademicYearId, SchoolId | ⚠️ | AcademicYearId is set from the school's *current* year, not the class's year (BUG-024). | Take the year from the class section. Add `sort_order` and optional `name_translations`. | S3 |
| DM08 | `CommonSubjects` + `StudentCommonSubject` | name, AcademicYearId, SchoolId | ⚠️ | No update/delete. The join table gets an `AcademicYearId` attribute through `through:` that doesn't exist on the table. | Rename to `activity_groups` linked to enrollments. | S4 |
| DM09 | `Students` | name, age (NOT NULL), dob, address, GRNumber (NOT NULL, not unique), imageLink, aadharNumber, panCardNumber, father/mother, 2 contacts, gender, bloodGroup, AcademicYearId, ClassId, SchoolId | ❌ | **A new Student row per year**, so history is split and there's no stable identity. Age is stored and goes stale. GR number isn't unique. Aadhaar is stored in plaintext. PAN for children is unneeded. | Split into `students` (permanent identity) and `enrollments` (per year). Unique (school_id, gr_number). Drop age, encrypt/mask Aadhaar, remove PAN. | S1 |
| DM10 | `StudentSubject` (join) | — | 💀 | `Student.belongsToMany(Subject)` exists but nothing writes to it. `getStudentById` reads it, so it's always empty. | Drop. | S4 |
| DM11 | `StudentTimelines` + `SubjectStudentTimeline` | date, progress, attendanceStatus (free string), image, StudentId | ⚠️ | Mixes attendance and learning notes. Duplicates when a student is marked twice. Bulk upload gives every row the same image. | Split into `attendance` + `daily_logs` (+ `class_daily_logs` for class photos). | S2 |
| DM12 | `Attendances` | date, studentId, classId, schoolId, status(present/absent), unique(studentId,date) | ⚠️ | No `marked_by`, no late/leave, no session record to say "class submitted". No index on (classId,date). | Add `marked_by`, `status` enum + leave/late/holiday, `attendance_sessions`, indexes. | S2 |
| DM13 | `Reports` | reportType(s1/s2/annual), content, grade, GRNumber (duplicated), Student/Subject/Class/AY FKs | ⚠️ | Duplicates GRNumber. No unique (student, subject, term), so duplicates are allowed. | `report_entries` unique (enrollment_id, subject_id, term). | S3 |
| DM14 | `Chapters` / `Topics` | Chapter.name, SubjectId; Topic.content, completedDate, completedBy | ⚠️ | Completion is stored on the topic itself, so editing (delete+recreate) wipes it. No sort order. | `topic_completions` table. Edit in place. `sort_order`. | S1 |
| DM15 | `Logs` | userType, action, description (STRING 255), teacherId/adminId | ⚠️ | No school/entity reference. Long descriptions truncate or error. | `audit_logs` with school_id, entity, before/after JSONB. | S3 |
| DM16 | `TeacherSchool` (join) | TeacherId, SchoolId | ✅ | — | Replace with `user_schools(role)`. | — |
| DM17 | **Schema management** | `models/index.js:177` `sequelize.sync({ alter: true })` | ❌ | Alters production tables on every boot. Can drop/alter columns silently and slows startup. | Use versioned migrations (`sequelize-cli`/umzug). Remove `sync` in prod. | S1 |
| DM18 | **Indexes** | only PKs, unique email, unique(studentId,date) | ❌ | Postgres doesn't index FKs automatically, so lists get slower as data grows. | Indexes listed in [08-schema-changes.md §4](08-schema-changes.md). | S2 |

---

## 3. Backend API endpoints (72 + health)

Auth column: **Pub** = no auth, **Adm** = `adminConstraint`, **Tok** = `tokenVerify` (admin or active teacher). "Scope" means whether the record is checked to belong to the caller's school/org.

### 3.1 Auth / Admin (`routes/auth.js`)
| ID | Method & path | Auth | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| API-01 | `POST /admin/register` | Pub | ⚠️ | Anyone can create an admin. Validation runs *after* the email lookup. Token + profile (with password hash) returned. | Invite-only. Validate first. Exclude password. | S1 |
| API-02 | `POST /admin/login` | Pub | ⚠️ | Response `data` includes password hash. No rate-limit/lockout. Generic 500 leaks error text. | Exclude hash, add rate limit, unify login with teacher. | S1 |
| API-03 | `GET /admin/getAll` | **Pub** | ❌ | **Returns every admin of every org including password hashes, without login** (`routes/auth.js:20`). | Remove or super-admin only. | S1 |
| API-04 | `GET /admin/get/:id` | none | ❌ | No middleware, so `req.admin` is always undefined and it always errors (`AdminController.js:67`). | Remove or protect and fix. | S4 |
| API-05 | `PUT /admin/update/:id` | Adm | ⚠️ | Any admin can change any other admin's email/password (no ownership check). | Self or org-owner only. | S1 |
| API-06 | `DELETE /admin/delete/:id` | Adm | ⚠️ | Any admin can delete any admin, including other orgs. No UI. | Owner-only, soft delete. | S1 |

### 3.2 Organization (`routes/organization.js`)
| ID | Method & path | Auth | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| API-07 | `POST /organization/create` | Adm | ⚠️ | Creates a new org each call and re-links the admin (orphaning the old one). No validation of name. | Allow only if admin has no org. Validate. | S3 |
| API-08 | `GET /organization/getAll` | **Pub** | ❌ | Lists all organizations publicly. | Remove / super-admin. | S2 |
| API-09 | `GET /organization/get/:id` | **Pub** | ⚠️ | Public read of any org. | Require auth + own org. | S3 |
| API-10 | `PUT /organization/update/:id` | Adm | ⚠️ | Any admin can edit any org. | Own org only. | S1 |
| API-11 | `DELETE /organization/delete/:id` | Adm | ⚠️ | Any admin can delete any org (cascade unknown). | Super-admin only. | S1 |

### 3.3 School (`routes/school.js`)
| ID | Method & path | Auth | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| API-12 | `POST /school/create` | Adm | ✅ | Requires all 4 fields (address/contact are nullable in the model but required here). Switches admin to the new school. | OK; make contact/address optional. | S4 |
| API-13 | `GET /school/getAll` | Tok | ⚠️ | Teacher gets `{schools: undefined}`. | Teacher: their schools. | S4 |
| API-14 | `GET /school/get/:id` | Tok | ⚠️ | Any school by id, no scope. | Scope to org/teacher schools. | S2 |
| API-15 | `PUT /school/update/:id` | Adm | ❌ | `School.update(req.body)` is **mass assignment** (can change OrganizationId/currentAcademicYear), **not awaited** (always "success"), and covers any school (`SchoolController.js:92`). | Whitelist fields, await, scope. | S1 |
| API-16 | `DELETE /school/delete/:id` | Adm | ⚠️ | Hard delete of any school. No UI. | Archive; own org only. | S1 |
| API-17 | `POST /school/switchByAdmin/:id` | Adm | ❌ | Admin can switch into **another organization's school** and then read/write all its data (`SchoolController.js:119`). | Check `school.OrganizationId === admin.OrganizationId`. | S1 |

### 3.4 Teacher (`routes/teacher.js`)
| ID | Method & path | Auth | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| API-18 | `POST /teacher/login` | Pub | ⚠️ | Works. Crashes the UI later if the teacher has no school (`currentSchoolData` undefined). No rate limit. | Merge with unified login. Handle no-school. | S2 |
| API-19 | `POST /teacher/create` | Adm | ⚠️ | If password blank, **password = email** silently. Response includes hash. Duplicate email gives raw Sequelize error. Can't add an existing teacher to a 2nd school. | Generate temp password shown once + force change. "Add existing teacher" flow. Friendly errors. | S1 |
| API-20 | `GET /teacher/getAll` | Adm | ✅ | Active teachers of current school only. | Add `?status=inactive`. | S3 |
| API-21 | `GET /teacher/get/:id` | Adm | ⚠️ | Returns full row **incl. password hash**. Any teacher id (no school scope). | Exclude hash, scope. | S1 |
| API-22 | `PUT /teacher/update/:id` | Tok (admin only inside) | ⚠️ | Teachers can't update their own profile. Email change can collide (500). No scope. | Separate `/me` endpoint. Validate unique. | S3 |
| API-23 | `PUT /teacher/updatePassword/:id` | Adm | ⚠️ | No length/strength rule. Any teacher id. | Policy + scope + teacher self-change endpoint. | S2 |
| API-24 | `POST /teacher/addAvatar/:id` | Tok | ⚠️ | **Any teacher can change any teacher's photo**. No size limit. | Self or admin only. | S2 |
| API-25 | `GET /teacher/getLogs/:id` | Adm | ✅ | All logs, no pagination. | Paginate. | S4 |
| API-26 | `DELETE /teacher/delete/:id` | Adm | ✅ | Soft delete (inactive). Good. | Rename "deactivate". Add route for reactivate + list inactive (controllers exist, unrouted). | S3 |

### 3.5 Student (`routes/student.js`)
| ID | Method & path | Auth | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| API-27 | `POST /student/create` | Tok | ⚠️ | Requires age. GR given → not checked unique. GR auto → race condition & `NaN` if previous GR had no "-" (`StudentController.js:175`). | Sequence-based GR in a transaction, unique constraint, DOB→age. | S1 |
| API-28 | `GET /student/getAll` | Adm | ⚠️ | All students of current AY + today's attendance; unmarked shown as `'absent'` (`:240`). No pagination. | `todayStatus: null`, paginate, filter server-side. | S2 |
| API-29 | `GET /student/getAll/:classId` | Tok | ✅ | Class must belong to caller's school (filtered by SchoolId). | Add sorting by roll no. | S4 |
| API-30 | `GET /student/get/:id` | Tok | ❌ | Calls `student.getSubjects()` **before** the null check, so an unknown id gives a 500 with "Cannot read properties of null" (`:344`). | Null check first; return 404. | S3 |
| API-31 | `PUT /student/update/:id` | Tok | ⚠️ | No school scope (IDOR). Requires name+age+ClassId even for partial edits. Error text "Something went wrong". | Scope + PATCH semantics + field errors. | S1 |
| API-32 | `DELETE /student/delete/:id` | Adm | ⚠️ | **Hard delete**, no scope; attendance/timeline orphaned or FK error. | "Mark as left" (soft) + scope. | S1 |
| API-33 | `GET /student/searchName` | Tok | ⚠️ | Returns students from *previous* years only, duplicates per year, `iLike %x%` without index, called per keystroke. | Replaced by promotion wizard; debounce + trigram index if kept. | S3 |
| API-34 | `POST /student/addAvatar/:id` | Tok | ⚠️ | No scope, no size limit; S3 key reused per year. | Scope, limit, compress. | S2 |
| API-35 | `GET /student/getSampleCsv/:classId` | Tok | ⚠️ | `Content-disposition` filename contains literal backticks (`:547`); template lacks GR/parents/phone. | Excel template with all fields + instructions row. | S3 |
| API-36 | `POST /student/uploadCsv/:classId` | Tok | ❌ | **Every row gets the same GR number** (lookup inside loop doesn't see unsaved rows, `:597-602`); no row validation; tmp file never deleted; no size limit. | Preview/validate/confirm flow; transactional GR sequence; delete tmp. | S1 |

### 3.6 Subject (`routes/subject.js`)
| ID | Method & path | Auth | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| API-37 | `POST /subject/create` | Adm | ⚠️ | AY taken from school's current AY, not the class's (`SubjectController.js:28`). No duplicate check. | Use class AY; unique (class, name). | S3 |
| API-38 | `GET /subject/getAll/:classId` | Tok | ⚠️ | No school scope. | Scope. | S3 |
| API-39 | `GET /subject/get/:id` | Adm | ⚠️ | No scope. | Scope. | S4 |
| API-40 | `PUT /subject/update/:id` | Adm | ⚠️ | Works, but no UI. Requires classId always. | Build UI; PATCH. | S3 |
| API-41 | `DELETE /subject/delete/:id` | Adm | ⚠️ | No UI; deleting subject with chapters/reports → FK error/orphans. | Block if data exists or archive. | S3 |

### 3.7 Academic year (`routes/academicYear.js`)
| ID | Method & path | Auth | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| API-42 | `POST /academicYear/create` | Adm | ⚠️ | No date validation (end < start allowed), no overlap/duplicate check. | Validate; part of rollover wizard. | S2 |
| API-43 | `POST /academicYear/setCurrentAcademicYear` | Adm | ❌ | **No try/catch**: invalid id → thrown error → unhandled rejection → **Node process crash** (`AcademicYearController.js:113-126`); `School.update` not awaited; no check that AY belongs to this school. | asyncHandler + scope + await. | S1 |
| API-44 | `GET /academicYear/getAll` | Adm | ✅ | Unordered. | Order by startDate desc; teachers need read access for year switcher. | S4 |
| API-45 | `GET /academicYear/get/:id` | Adm | ⚠️ | No scope; null → 200 with null. | Scope; 404. | S4 |
| API-46 | `PUT /academicYear/update/:id` | Adm×2 | ❌ | Requires `ClassId` (nonsense) → **always fails** from any sane client (`:81`); middleware listed twice. | Fix fields; no UI exists — add. | S2 |
| API-47 | `DELETE /academicYear/delete/:id` | Adm | ❌ | Deletes even the current year with all its classes/students (FK SET NULL → orphans) — one click in UI, no confirm. | Block when data exists / current; archive instead. | S1 |

### 3.8 Class (`routes/class.js`)
| ID | Method & path | Auth | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| API-48 | `POST /class/create` | Adm | ⚠️ | `AcademicYearId` optional → class with null year is invisible everywhere. No duplicate name check. | Required (default current). | S2 |
| API-49 | `GET /class/getAll` | Tok | ✅ | Current AY classes with subjects; unsorted (FE sorts by id). | Sort by grade order; accept `academicYearId`. | S3 |
| API-50 | `GET /class/getAll/:id` | Tok | ⚠️ | By AY id, no scope. | Scope. | S3 |
| API-51 | `GET /class/get/:id` | Tok | ❌ | `if (!req.admin \|\| !req.teacher)` is always true → **always 500** (`ClassController.js:77`). | Fix condition + scope. | S3 |
| API-52 | `PUT /class/update/:id` | Adm | ❌ | `const Class = await Class.update(...)` shadows the model → TDZ ReferenceError → **always fails** (`:100`). | Rename variable. | S2 |
| API-53 | `DELETE /class/delete/:id` | Adm | ❌ | Same TDZ bug → **always fails** (`:115`). | Rename; block if students. | S2 |

### 3.9 Student timeline (`routes/studenttimeline.js`)
| ID | Method & path | Auth | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| API-54 | `POST /studentTimeline/create/:studentId` | Tok | ⚠️ | Uses `body.studentId`, ignores URL param; `JSON.parse(subjects)` throws if missing; `setSubjects` not awaited (FK error → unhandled → crash); `createLog(req.teacher.id)` fails for admin (500 after save); creates duplicate entries per day; S3 key uses locale time with colons. | Split into `PUT /attendance` + `PUT /daily-logs/:studentId/:date` (upsert). | S2 |
| API-55 | `POST /studentTimeline/bulkCreate/:classId` | Tok | ⚠️ | Always `present`; absent students get no record; `students.forEach(async…)` not awaited → response before writes, race on unique (student,date) → unhandled rejection → crash; N×2 queries; same image for all. | `PUT /attendance/class/:id/:date` single transaction with all statuses. | S1 |
| API-56 | `GET /studentTimeline/getAll/:studentId` | Tok | ⚠️ | No scope; no pagination; all years mixed (actually per student-row = per year). | Scope; paginate; filter by year. | S3 |
| API-57 | `PUT /studentTimeline/update/:id` | Tok | ⚠️ | Saves, then `req.admin.id` throws for teachers → 500 although saved; requires progress text. | Author or admin; fix log. | S3 |
| API-58 | `DELETE /studentTimeline/delete/:id` | Tok | ⚠️ | Same log crash for teachers; attendance not reverted. | Same. | S3 |

### 3.10 Report (`routes/report.js`)
| ID | Method & path | Auth | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| API-59 | `POST /report/create` | Tok | ❌ | **No try/catch** → any missing field / validation error → unhandled rejection → **server crash** (`ReportController.js:7-35`). | asyncHandler, validation, upsert per term. | S1 |
| API-60 | `GET /report/getForCurrAY/:studentId` | Tok | ⚠️ | No try/catch (crash if school missing); current year only. | Accept year; scope. | S2 |

### 3.11 Attendance (`routes/attendance.js`)
| ID | Method & path | Auth | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| API-61 | `GET /attendance/:classId?startDate&endDate` | **Pub** | ❌ | **No authentication at all** — anyone with a class id gets names + attendance of children (`routes/attendance.js:7`); missing dates → SQL error; only marked rows returned. | Auth + scope + register format incl. unmarked. | S1 |

### 3.12 Syllabus (`routes/syllabus.js`)
| ID | Method & path | Auth | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| API-62 | `GET /syllabus/get/:subjectId` | Tok | ⚠️ | No scope; unordered. | Scope, order. | S3 |
| API-63 | `POST /syllabus/add/:subjectId` | Tok | ⚠️ | Teachers can add (no role rule); topics created with un-awaited `forEach(async)` → response before topics exist; failure → crash. | Admin/assigned teacher; bulkCreate in transaction. | S2 |
| API-64 | `PUT /syllabus/update/:chapterId` | Tok | ❌ | **Deletes all topics and recreates them → all completion data lost** (`SyllabusController.js:107`); no null check. | Diff-update topics by id; keep completions. | S1 |
| API-65 | `DELETE /syllabus/delete/:chapterId` | Tok | ⚠️ | Any teacher can delete; deletes chapter before topics (FK may block). | Admin only; transaction; topics first/cascade. | S2 |
| API-66 | `GET /syllabus/getFull` | Tok | ⚠️ | Entire school syllabus with 5-level include on every teacher visit — slow, heavy payload. | Per class/subject endpoints + progress summary. | S2 |
| API-67 | `POST /syllabus/markTopicAsCompleted/:topicId` | Tok | ⚠️ | `teacherId` from body (teacher can mark as someone else); admin log call has wrong args (no log); no null check. | Use `req.user` for teachers; admin may pick teacher. | S2 |
| API-68 | `POST /syllabus/unMarkTopicAsCompleted/:topicId` | Tok | ⚠️ | Any teacher can unmark anyone's; no null check. | Author/admin only. | S3 |

### 3.13 Common subject (`routes/commonsubject.js`)
| ID | Method & path | Auth | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| API-69 | `POST /commonsubject/create` | Adm | ⚠️ | AY optional → invisible items. | Required. | S3 |
| API-70 | `GET /commonsubject/getAll/:academicYearId` | Adm | ⚠️ | No scope. Called from the teacher's student-edit screen with a teacher token: it either fails with 401, or (BUG-001) succeeds by treating the teacher as the admin with the same id. | Allow teachers read access properly. | S2 |
| API-71 | `GET /commonsubject/getAll` | Adm | ⚠️ | Same as API-70 (`StudentDetail.js:99`). | Same. | S2 |

### 3.14 Dashboard & health
| ID | Method & path | Auth | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| API-72 | `GET /dashboard` | Adm | ⚠️ | 6 sequential queries; teacher count includes inactive; attendance not filtered by year; date labels via server `toLocaleDateString` (server TZ/locale dependent); `currentSchoolId` typo for teachers. | Promise.all, filters, ISO dates, actionable metrics. | S3 |
| API-73 | `GET /` | Pub | ✅ | Returns a string. | `/health` with DB ping + version. | S4 |

### 3.15 Implemented but not routed (dead) 💀
`TeacherController.getInactiveTeachers`, `TeacherController.reactivateTeacher`, `CommonSubjectController.addStudentsToCommonSubject`, `addSingleStudentToCommonSubject`, `SubjectController.getAllSubjectsInClass`, `getAllClassesOfSubject` (queries non-existent `SubjectId`), whole `TeacherSchoolController.js` (references undefined `TeacherSchool`), `middlewares/loginRequierd.js`.

---

## 4. Frontend pages (routes)

### 4.1 Global
| ID | Page | File | Status | Non-technical tester feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| PG-01 | Splash / loader | `App.js` | ⚠️ | "Always waits a second even on fast Wi-Fi." | Remove artificial 1 s delay; real auth bootstrap (`/me`). | S4 |
| PG-02 | Login (Teacher/Admin tabs + admin register) | `Login.js` | ⚠️ | See M01. Also: "Network error showed nothing / page went blank." (`err.response` undefined crash in register). | Single friendly login with language picker on top, big inputs, Enter key, persistent errors. | S2 |
| PG-03 | Teacher-only login (unused) | `TeacherSection/Pages/LoginPage.js` | 💀 | — (never routed; doesn't store token) | Delete. | S4 |

### 4.2 Admin (`AdminMain.js` routes)
| ID | Route → Page | File | Status | Tester feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| PG-10 | `/` Dashboard | `Pages/Home.js` | ⚠️ | "'Total Courses' = classes? Chart cut off. Nothing tells me what to do today." | Actionable cards; responsive chart; correct labels. | S3 |
| PG-11 | `/school` School info + academic years | `Pages/SchoolInfo.js` + `AcademicYearList` | ⚠️ | "Edit/Save works but did it save? (always says success). Delete year without warning. Dates in US format." | Separate "Academic Years" page with wizard; confirm dialogs; DD/MM/YYYY. | S1 |
| PG-12 | `/school-list` Switch school | `Pages/SchoolList.js` | ✅ | "Picture isn't our logo." | Logo upload; show year + counts per school. | S4 |
| PG-13 | `/create-organization` | `Pages/OrganizationForm.js` | ✅ | "OK." | Merge into onboarding wizard. | S4 |
| PG-14 | `/create-school` | `Pages/SchoolForm.js` | ✅ | "OK." | Onboarding wizard step. | S4 |
| PG-15 | `/settings` Class / Subject / Common Subject forms | `Pages/Settings.js` | ⚠️ | "'Class Form'? I just want to see my classes and fix names. Lists can't be edited. Subject form shows only this year's classes, class form lets me pick any year — confusing." | Replace with "Classes & Subjects" page: table of classes → subjects inline, add/rename/delete, reorder. | S2 |
| PG-16 | `/syllabus` Syllabus editor + progress | `Pages/SyllabusForm.js` | ❌ | "Delete chapter doesn't work. Editing a chapter removed teachers' ticks. 'Mark completed' says error." | Rebuild: chapter list with inline topics, drag order, progress %; fix bugs. | S1 |
| PG-17 | `/teachers` Teacher list | `Pages/TeachersList.js` | ⚠️ | "Class filter crashed. Sort crashed." | Remove fake class filter; server search; Active/Inactive tabs. | S2 |
| PG-18 | `/teachers/:id` Teacher detail + logs | `Components/Teacher/TeacherDetails.js` | ⚠️ | "Errors stay on screen forever. No classes shown." | Assignments section; reset password button generating temp password. | S3 |
| PG-19 | `/students` Student list | `Pages/StudentsList.js` | ⚠️ | "Class 1 filter shows Class 10 and 11 too. 'Absent' for everyone not yet marked. Wide table needs sideways scroll." | Exact filter; Not-marked status; pagination; export; responsive cards on mobile. | S2 |
| PG-20 | `/students/:id` Student profile | `Pages/StudentInfo.js` | ❌ | "**Academics tab shows marks that aren't real.** Gender is free text here but a dropdown for teachers." | Real reports; year-history tab; shared form. | S1 |
| PG-21 | `/attendence` Attendance report | `Pages/Attendance.js` | ⚠️ | "Spelling 'Attendence'. I must choose class & press button. No totals." | Register grid, totals, defaults to today/current class, Excel/PDF. | S2 |

### 4.3 Teacher (`TeacherMain.js` routes)
| ID | Route → Page | File | Status | Tester feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| PG-30 | `/` My Info (default home!) | `Pages/MyInfo.js` | ⚠️ | "App opens on my profile, not my work. Language buttons here only. Avatar empty. Switch does nothing." | Default home = **Today** (my classes, attendance status, quick actions); profile under "Me". | S2 |
| PG-31 | `/class` Class list | `Pages/Class.js` | ⚠️ | "Two icons, no words — which is attendance?" | Big labeled buttons: "Take attendance" / "Students"; show "Marked ✔ 38/40" per class. | S1 |
| PG-32 | `/class/attendence/:id` Attendance (chips) | `Pages/AttendenceClassWise.js` | ⚠️ | See M13. | New Take-Attendance screen. | S1 |
| PG-33 | `/class/:id` Students of class | `Pages/StudentsList.js` (teacher) | ✅ | "Round + button, I didn't know it adds a student." | FAB with label "Add student"; show roll no & photo. | S3 |
| PG-34 | `/student/:id` Student detail | `Pages/StudentDetail.js` | ⚠️ | "Pencil icon to edit; it closed before saving finished; errors silent." | Clear Edit/Save buttons, sticky save bar, validation messages. | S2 |
| PG-35 | `/syllabus` Syllabus | `Pages/Syllabus.js` | ⚠️ | "Every class of the school, folders inside folders. 'Mark Done' has no undo label." | My classes → subject cards with progress → topic checklist with date. | S2 |
| PG-36 | `/schedule` | `Pages/Schedule.js` | 💀 | Placeholder "Schedule". | Remove until timetable exists. | S4 |
| PG-37 | (empty) Home | `Pages/Home.js` (0 bytes) | 💀 | — | Use for Today page. | S4 |

---

## 5. Frontend components

### 5.1 Shared / root
| ID | Component | File | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| CMP-01 | `GTranslateComponent` | `src/GTranslateWraper.js` | ❌ | Loads external Google widget a 2nd time (also in `index.html` with different language list); translations unreliable; names mangled. | Remove; i18next. | S1 |
| CMP-02 | Theme | `src/theme.js` | ⚠️ | Custom palette keys `colors.main`, `transparentBG.bgcolor`; red error `#ff0000`; translucent cards over background image reduce contrast. | Accessible palette (WCAG AA), larger base font (16→17 px) for teachers, Noto fonts. | S3 |
| CMP-03 | Service worker | `serviceWorkerRegistration.js`, `service-worker.js` | 💀 | Unregistered. | Phase 6 PWA. | S3 |
| CMP-04 | `reportWebVitals` | `src/reportWebVitals.js` | ✅ | Not sending anywhere. | Send to analytics or remove. | S4 |
| CMP-05 | `App.test.js` | `src/App.test.js` | ❌ | Default CRA test expecting "learn react" — fails. | Real tests (Vitest + RTL). | S3 |

### 5.2 Admin components
| ID | Component | File | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| CMP-10 | `AdminMain` layout (drawer, app bar) | `AdminSection/AdminMain.js` | ⚠️ | 7 copy-pasted menu items (~300 lines); not responsive (drawer + fixed widths); misspelt "Attendence"; header lacks year. | Data-driven menu; responsive layout; year switcher in header. | S3 |
| CMP-11 | `AccountMenu` | `Components/AccountMenu.js` | ⚠️ | "Profile" and "My account" do nothing. | Profile page, language, logout. | S3 |
| CMP-12 | `PreLoad` | `PreLoad.js` | 💀 | Empty. | Delete. | S4 |
| CMP-13 | `ChapterChip` (edit chapter dialog) | `Components/ChapterChip.js` | ⚠️ | Save doesn't refresh parent; edit wipes completion (backend); delete via parent has no auth header. | Inline editor; diff update. | S1 |
| CMP-14 | `ExportAttendanceButton` (PDF) | `Components/ExportAttendanceButton.js` | ⚠️ | jsPDF Helvetica → Devanagari/Gujarati render as garbage; only per-date list. | Server-side PDF/Excel with Noto fonts; register layout. | S2 |
| CMP-15 | `MarkTopicCompleted` | `Components/MarkTopicCompleted.js` | ❌ | Prop name `fetchSyallabus` vs passed `fetchSyllabus` → TypeError after success → shows **"Error marking topic"** although saved. | Fix prop; refresh. | S2 |
| CMP-16 | `AcademicYearList` | `Components/School/AcademicYearList.js` | ❌ | Delete no confirm; add errors swallowed; en-US dates; no edit. | Rebuild in Academic Years page. | S1 |
| CMP-17 | `ClassTab`, `SubjectsTab` | `Components/School/*.js` | 💀 | Local-state demos with fake data. | Delete. | S4 |
| CMP-18 | `ClassForm` | `Components/Settings/ClassForm.js` | ⚠️ | Can submit without year; list read-only; no edit/delete. | See PG-15. | S2 |
| CMP-19 | `SubjectForm` | `Components/Settings/SubjectForm.js` | ⚠️ | Only current-year classes; read-only list. | See PG-15. | S3 |
| CMP-20 | `CommonSubjectForm` | `Components/Settings/CommonSubjectForm.js` | ⚠️ | "Common Subjectes" typo; read-only. | Rename "Activities". | S4 |
| CMP-21 | `AddStudent` (admin) | `Components/Student/AddStudent.js` | ⚠️ | Duplicate of teacher `AddNewStudent`; requires age+DOB+address; no parent phone; "From Previous A.Y." creates a duplicate student row with only 5 fields copied. | One `StudentForm` shared; promotion via wizard. | S1 |
| CMP-22 | `NewStudentTab` / `PreviousAcademicYearTab` (admin) | `Components/Student/*.js` | ⚠️ | Duplicates of teacher versions. | Delete after shared form. | S3 |
| CMP-23 | `StudentAcademics` | `Components/Student/StudentAcademics.js` | 💀 | Unused generic key/value table (refs `firstName`/`avatarUrl`). | Delete. | S4 |
| CMP-24 | `StudentDetails` (admin profile form) | `Components/Student/StudentDetails.js` | ⚠️ | Gender free text; big red Delete next to Edit; Aadhaar shown in full. | Shared form; "Mark as left"; mask Aadhaar. | S2 |
| CMP-25 | `StudentListHeader` | `Components/Student/StudentListHeader.js` | ❌ | Class filter substring match; sort keys lower-cased so date sorts never match; `modifiedAt` doesn't exist; mutates props array. | Server-side filter/sort; exact class id. | S2 |
| CMP-26 | `StudentTimeline` (admin) | `Components/Student/StudentTimeline.js` | ⚠️ | Delete without confirm; uses `react-toastify` but no `ToastContainer` mounted → toasts never show. | Confirm; global notifier. | S3 |
| CMP-27 | `StudentsTable` | `Components/Student/StudentsTable.js` | ⚠️ | "Absent" chip styled `success` for unmarked; Edit column does nothing extra; `minWidth: 650`. | Status chips Present/Absent/Not marked; responsive. | S2 |
| CMP-28 | `UploadAvatar` (admin) | `Components/Student/UploadAvatar.js` | ⚠️ | No size/compress; same `id="avatar-input"` as teacher version. | Shared `PhotoPicker` with compression + camera capture. | S3 |
| CMP-29 | `AddTecher` | `Components/Teacher/AddTecher.js` | ⚠️ | File name typo; closes immediately; blank password silently = email. | Temp password shown once; copy/share via WhatsApp. | S2 |
| CMP-30 | `TeacherDetails` | `Components/Teacher/TeacherDetails.js` | ⚠️ | See PG-18. | — | S3 |
| CMP-31 | `TeacherListHeader` | `Components/Teacher/TeacherListHeader.js` | ❌ | Hard-coded "1st–5th Grade" filter on teachers; `student.class` undefined → **crash** on filter or sort. | Remove filter; status tabs. | S2 |
| CMP-32 | `TeacherLogs` | `Components/Teacher/TeacherLogs.js` | ✅ | Dates only (no time); no paging. | Time + filters. | S4 |
| CMP-33 | `TeacherTable` | `Components/Teacher/TeacherTable.js` | ⚠️ | Uses `fetch` + full page reload; errors only in console. | API client + refetch + toast. | S3 |
| CMP-34 | `UploadTeacherAvatar` | `Components/Teacher/UploadTeacherAvatar.js` | ⚠️ | Duplicate of UploadAvatar. | Shared PhotoPicker. | S4 |
| CMP-35 | `dummyStudents.json`, `test.js` | `AdminSection/Pages/` | 💀 | Dummy data bundled into production JS; Node script inside `src`. | Delete. | S4 |

### 5.3 Teacher components
| ID | Component | File | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| CMP-40 | `TeacherMain` (bottom nav) | `TeacherSection/TeacherMain.js` | ⚠️ | 3 tabs: Syllabus / Class / My Info; selected state not synced to URL (`'recents'`). | Tabs: Today / Classes / Syllabus / Me; highlight by route. | S3 |
| CMP-41 | `StudentChip` (per-student daily report dialog) | `components/Students/StudentChip.js` | ⚠️ | No loading/disabled state → double taps create duplicates; errors only console; grey/green/red colours only (colour-blind users); same `id="file-input"` reused. | Replace with attendance row toggle + separate note sheet. | S1 |
| CMP-42 | `BulkAttendence` | `components/Students/BulkAttendence.js` | ⚠️ | Subjects mandatory; present-only; reload after 3 s. | Replaced by Take-Attendance screen. | S1 |
| CMP-43 | `BulkStudent` (CSV) | `components/Students/BulkStudent.js` | ❌ | Commented out; title "Bulk Attendence"; spinner stuck if no file; no errors shown. | Admin import page. | S3 |
| CMP-44 | `AddNewStudent` (teacher) | `components/Students/AddNewStudent.js` | ⚠️ | Same as CMP-21. | Shared form. | S2 |
| CMP-45 | `NewStudentTab` / `PreviousAcademicYearTab` | `components/Students/*.js` | ⚠️ | Duplicates. | Delete. | S3 |
| CMP-46 | `StudentBasicData` | `components/Students/StudentBasicData.js` | ⚠️ | Class select starts empty in edit; table label/value style is long on phone; PAN field. | Card layout, grouped sections ("Child", "Parents", "Documents"). | S3 |
| CMP-47 | `AcademicDetails` | `components/Students/AcademicDetails.js` | ❌ | Closes dialog before request returns; list not refreshed; errors silent; `reportType` empty allowed → backend crash. | Report entry per term with validation. | S1 |
| CMP-48 | `StudentTimeline` (teacher) | `components/Students/StudentTimeline.js` | ✅ | Readable; no edit for teacher. | Edit own entry; group by month. | S3 |
| CMP-49 | `UploadAvatar` (teacher) | `components/Students/UploadAvatar.js` | ⚠️ | No compression. | Shared PhotoPicker. | S3 |
| CMP-50 | `dummy/Classes.json`, `dummy/StudentChipDummy.json`, `classDData` in `Class.js` | — | 💀 | Dead dummy data. | Delete. | S4 |

---

## 6. Middleware, utilities, config

| ID | Item | File | Status | Feedback | Recommendation | Sev |
|---|---|---|---|---|---|---|
| UT-01 | `adminConstraint` | `middlewares/adminConstraint.js` | ❌ | Looks up `Admin` by the token's numeric `id` (`:24`). Teacher tokens also carry `{email, id}`, so **a teacher with id 3 is accepted as whichever admin has id 3** and gets admin rights over that admin's school (privilege escalation, BUG-001). `tokenVerify` looks up by email, which is inconsistent. | Put `role` + `sub` in the JWT. Single `authenticate` + `authorize(...roles)`. Unified users table. | S1 |
| UT-02 | `tokenVerify` | `middlewares/tokenVerify.js` | ⚠️ | 2 DB queries per request; admin wins if a teacher shares the same email; teacher whose `currentSchool` isn't in their schools is locked out. | Role in JWT claims + short cache; unified users. | S2 |
| UT-03 | `loginRequierd` | `middlewares/loginRequierd.js` | 💀 | Unused; crashes if header missing. | Delete. | S4 |
| UT-04 | `adminDetails` | `utils/adminDetails.js` | ⚠️ | Returns password hash; overwrites `currentSchool` int with object (type confusion); heavy include on many endpoints. | `GET /me` DTO. | S1 |
| UT-05 | `createLog` | `utils/createLogs.js` | ⚠️ | Not awaited, errors unhandled; silently drops when args wrong. | Audit service, awaited or queued with catch. | S3 |
| UT-06 | `s3Upload` | `utils/s3Upload.js` | ⚠️ | No region; no file size limit; HEIC rejected; error string "Image only!"; public URLs. | Region env, limits, sharp resize server-side, signed URLs. | S2 |
| UT-07 | DB config | `config/db.js` | ⚠️ | `rejectUnauthorized: false`; no pool settings; logging off. | Proper CA; pool; slow-query log. | S2 |
| UT-08 | Server bootstrap | `server.js` | ⚠️ | CORS `*`; no helmet; no rate limit; no JSON body size limit; no 404/error handler; no `process.on('unhandledRejection')`; unused imports (multer, AWS). | Hardened app.js (see plan Phase 1). | S1 |
| UT-09 | Committed uploads | `tmp/csv/*` (12 files) | ❌ | Student CSVs (names, DOB, addresses) committed to git although `tmp/` is in `.gitignore`. | `git rm --cached`, purge history if repo ever public, auto-delete after import. | S1 |
| UT-10 | Env vars | — | ⚠️ | No `.env.example`; required: `POSTGRES_URL, JWT_SECRET, JWT_EXPIRE_TIME, PORT, AWS_IAM_ACCESS_KEY_ID, AWS_IAM_SECRET_ACCESS_KEY, AWS_AVATAR_BUCKET, AWS_TIMELINE_BUCKET, AWS_FACULTY_BUCKET`; FE `REACT_APP_API_BACKEND`. | `.env.example` + startup validation (zod/envalid). | S3 |
| UT-11 | Frontend API calls | 39 places | ⚠️ | Every component builds axios URL + headers itself; no 401 handling; no timeout; no retry. | `src/api/client.js` interceptor. | S2 |
| UT-12 | Frontend state | localStorage `userInfo` | ⚠️ | Becomes stale (e.g., after switching year in another tab); trusted for routing. | Auth context fed by `/me`; React Query cache. | S2 |

---

## 7. Dependencies

| Repo | Package | Issue | Action |
|---|---|---|---|
| BE | `aws-sdk@2` | v2 reached end-of-support (Sept 2025). | Migrate to `@aws-sdk/client-s3` v3 + `@aws-sdk/lib-storage`. |
| BE | `multer-s3` **and** `multer-s3-v2` | Duplicate; only v2 used. | Keep one (v3-compatible `multer-s3@3`). |
| BE | `jspdf`, `error`, `body-parser`, `morgan` | Unused / redundant (Express has `express.json`). | Remove or use (`morgan` → request logs). |
| BE | `moment` | Legacy, large. | `dayjs` (same as FE). |
| BE | — missing | `helmet`, `express-rate-limit`, `zod`/`joi`, `sequelize-cli`/`umzug`, `jest`+`supertest`, `pino`. | Add. |
| BE | Node version | Not pinned. | `"engines": {"node": ">=20"}` + `.nvmrc`. |
| FE | `react-scripts@5` (CRA) | Deprecated, slow builds, vulnerable transitive deps. | Migrate to Vite. |
| FE | `workbox-*` (12 pkgs) | Unused (SW unregistered). | Remove or use via `vite-plugin-pwa`. |
| FE | `react-toastify` | Imported, container never mounted. | One notifier (MUI Snackbar or toastify mounted once). |
| FE | `@mui/x-charts`, `@mui/x-date-pickers`, `@mui/lab`, `jspdf` | Heavy, eagerly bundled. | Lazy-load per route. |
| FE | GTranslate CDN script | External, unreliable, privacy. | Remove. |
| FE | — missing | `i18next`, `react-i18next`, `@tanstack/react-query`, `react-hook-form`, `zod`, `browser-image-compression`, `vitest`, `@playwright/test`, ESLint i18n plugin. | Add. |

---

## 8. Counts (for tracking)

| Category | Count |
|---|---|
| Modules / capabilities | 26 (M01–M26), 5 of them missing |
| Data models | 16 tables + 2 cross-cutting (DM17–18) |
| API endpoints | 72 + health = 73 (API-01–73), 7 more handlers unrouted |
| Pages / routes | 23 rows: 20 live + 3 dead (PG-01–37) |
| Components | 42 rows (CMP-01–50) |
| Utilities / config | 12 (UT-01–12) |
| Dead / unused files or handlers | 20+ |
