# 05 — Issues Register: Bugs, Security, Performance, Code Quality

Every defect found by reading the code, with evidence. Paths are relative to each repo: **BE** = Signal-School-Backend, **FE** = Signal-School-Frontend. Line numbers are as of commit `342ea53` (BE) and `e31962f` (FE).

Severity: **S1** critical (security hole, data loss, server crash, or a core task is blocked) · **S2** high · **S3** medium · **S4** low or cosmetic.
Fix phase refers to [10-implementation-plan.md](10-implementation-plan.md).

> "Predicted" means found by reading code, not yet reproduced. The next round runs [03-test-cases.md](03-test-cases.md) and marks each item **Confirmed** or **Not reproduced**.

---

## A. Security and privacy

| ID | Sev | Title | Evidence | What it means in plain words | Fix | Phase |
|---|---|---|---|---|---|---|
| BUG-001 | S1 | **A teacher is treated as an admin when their id matches an admin's id** | BE `middlewares/adminConstraint.js:23-24` looks up `Admin` by `decodedToken.id`. Teacher JWTs (`TeacherController.js:27`) also contain `id`. | Teacher #2 can call every admin-only API (create/delete teachers, delete students, change school, etc.) as Admin #2. | JWT carries `role` + `sub`. Auth middleware checks role. Unified `users` table. | 1 |
| BUG-002 | S1 | **Attendance API has no login check** | BE `routes/attendance.js:7` (no middleware) | Anyone on the internet can read children's names and attendance by guessing class numbers. | Add auth + school scope. | 1 |
| BUG-003 | S1 | **Password hashes sent to browsers** | BE `utils/adminDetails.js:13` (used by login/register/org/school/AY responses), `AdminController.js:57` (`/admin/getAll`, public), `TeacherController.js:84,185` | Hashes get stored in localStorage and are visible in network tools. `/admin/getAll` exposes every admin's email+hash without login. | `defaultScope: { attributes: { exclude: ['password'] } }`. Explicit DTOs. Delete `/admin/getAll`. | 1 |
| BUG-004 | S1 | **No tenant isolation (organization/school scoping)** | BE `SchoolController.js:119-131` (switch into any school), `:86-98`, `:101-117`; `OrganizationController.js:83-128`; `AdminController.js:79-125`; `StudentController.js:359-422, 462-477`; Subject/Class/AY/Syllabus/Timeline handlers by raw id | An admin of school A can switch into school B (another trust), edit or delete it, edit or delete its students, rename its classes, or delete other admins. | `schoolScope` middleware. Every query filtered by `school_id IN user's schools`. Ownership checks for org/admin. Add tests. | 1 |
| BUG-005 | S1 | **Public admin self-registration and org listing** | BE `routes/auth.js:14`, `routes/organization.js:8-9`; FE `Login.js:304-312` | Anyone can create an admin account. Combined with BUG-004 and BUG-001, that is full access. | Invite-only admins. Remove public listing. | 1 |
| BUG-009 | S1 | Weak credentials | BE `TeacherController.js:65-68` (blank password = email), no password rules, no login rate limit | Guessable teacher passwords. Brute force is possible. | Generated temporary password plus forced change. Min 8 chars. `express-rate-limit` on login. Lockout after 10 failures. | 1 |
| BUG-010 | S2 | Mass assignment on school update | BE `SchoolController.js:92` `School.update(req.body, …)` (not awaited) | The client can overwrite `OrganizationId` or `currentAcademicYear`. The UI says "updated" even when it failed. | Whitelist fields + `await`. | 1 |
| BUG-011 | S2 | Missing role checks inside teacher-accessible routes | BE `TeacherController.js:265` (any teacher changes any teacher's photo), `SyllabusController.js:187` (`teacherId` from body), syllabus add/edit/delete and timeline update/delete open to all teachers | A teacher can delete the syllabus, mark topics as done in a colleague's name, or delete timelines. | Permission matrix ([08-schema §6](08-schema-changes.md)). | 1 |
| BUG-063 | S2 | Transport and session hardening missing | BE `server.js:20-25` CORS `*`; no `helmet`; `config/db.js:19` `rejectUnauthorized:false`; FE stores JWT in localStorage; no token revocation | Easier token theft and man-in-the-middle on the DB link. A logged-out token stays valid. | CORS allow-list, helmet, DB CA cert, short access token + refresh in httpOnly cookie (or keep localStorage but add short expiry + rotation), `token_version` for revocation. | 1/2 |
| BUG-064 | S2 | Children's personal data handling | BE `models/Student.js:41-48` (Aadhaar plaintext, PAN), public S3 URLs for photos | Risk under India's DPDP Act 2023 (children's data needs parental consent, minimal collection) and Aadhaar storage rules. | Remove PAN. Store Aadhaar masked (last 4) or encrypted. Private bucket + signed URLs. Consent flag. Retention policy. | 2 |
| BUG-008 | S1 | Student CSVs committed to git | BE `tmp/csv/*` (12 files with names, DOB, addresses) tracked despite `.gitignore`. `StudentController.js:575` never deletes uploads | Personal data sits in the repo history. Server disk fills over time. | `git rm --cached tmp/csv/*`. Purge history if the repo is or becomes public. Delete the tmp file after import (or parse from memory). | 1 |
| BUG-066 | S3 | No input validation anywhere | All BE controllers | Garbage data (emails, phones, dates, 10,000-char names) gets in, and raw DB errors come back out. | zod/joi schemas per route + `validate` middleware. | 2 |
| BUG-065 | S3 | Aadhaar check is length-only, client-only | FE `StudentInfo.js:100`, `StudentDetail.js:48` | "ABCDEFGHIJKL" passes. | Server-side Verhoeff check/12 digits, or remove the field. | 2 |

## B. Stability: things that crash the server or hang requests

| ID | Sev | Title | Evidence | Plain words | Fix | Phase |
|---|---|---|---|---|---|---|
| BUG-006 | S1 | **Unhandled async errors can kill the Node process** | BE `ReportController.js:7-35,38-67` (no try/catch), `AcademicYearController.js:113-126`, `SyllabusController.js:74-79,109-114` (`forEach(async)`), `StudentTimelineController.js:61,237-247,253-270`, `utils/createLogs.js` (un-awaited `Logs.create`) | In Node ≥15 an unhandled promise rejection exits the process. One teacher pressing "Add Report" with an empty type can take the server down for every school. | `express-async-errors` or an `asyncHandler` wrapper, a global error handler, awaited `Promise.all`/`bulkCreate` in transactions, and a `process.on('unhandledRejection')` logger with restart via PM2/systemd. | 1 |
| BUG-007 | S1 | Schema auto-altered on every boot | BE `models/index.js:177` `sequelize.sync({ alter: true })` | A model typo can drop or alter production columns. Boot is slow and takes locks. | Migrations ([08-schema §7](08-schema-changes.md)). | 2 |
| BUG-018 | S2 | Unknown student id gives a 500 | BE `StudentController.js:344` (calls `getSubjects` before the null check at `:348`) | A broken link shows a technical error. | Null check, then 404. | 1 |
| BUG-045 | S3 | Frontend crashes on network failure | FE `Login.js:162` and 25 places using `err.response.data` without checking `err.response` | Offline or timeout gives a blank screen or an uncaught error instead of "No internet". | API client normalizes errors. | 2 |
| BUG-049 | S3 | Teacher "My Info" crashes if the teacher has no school data | FE `MyInfo.js:125` `userInfo.currentSchoolData.name` | Blank page. | Null-safe + `/me`. | 2 |

## C. Data integrity and data loss

| ID | Sev | Title | Evidence | Plain words | Fix | Phase |
|---|---|---|---|---|---|---|
| BUG-030 | S1 | **Editing a chapter erases all "topic done" progress** | BE `SyllabusController.js:107` (`Topic.destroy` then recreate) | Fixing a spelling mistake wipes months of teacher tracking. | Update topics by id. Move completions to their own table. | 1 |
| BUG-015 | S1 | **Deleting an academic year is one click with no checks** | BE `AcademicYearController.js:98-110`; FE `AcademicYearList.js:85-95,160` | A mis-click orphans a whole year of classes, students and attendance (FK set null) or throws an FK error. | Confirm dialog. Block when it has data or is current. "Archive" instead. | 1 |
| BUG-012 | S1 | GR number generation is unsafe | BE `StudentController.js:132-176` | Two teachers adding students at once get the same GR. A manual GR without "-" breaks the sequence ("SCH1-NaN"). GR isn't unique in the DB. | `schools.next_gr_number` incremented in a transaction (`SELECT … FOR UPDATE`). Unique (school_id, gr_number). | 1 |
| BUG-013 | S1 | **CSV import gives every student the same GR number** | BE `StudentController.js:577-614` (looks up the "last student" inside the loop before any insert) | 40 students imported means 40 identical GR numbers. | Allocate a GR range once per import. Validate each row. Preview, then confirm. | 1 |
| BUG-014 | S2 | Student delete is a hard delete | BE `StudentController.js:462-477` | Attendance/timeline either blocks the delete (FK) or is orphaned. History is lost. Accidental deletes can't be undone. | `status = left` + reason + date. Hard delete only via an admin purge tool. | 3 |
| BUG-016 | S2 | Academic year edit always fails | BE `AcademicYearController.js:80-89` requires `ClassId` | Typos in year dates can't be fixed. | Correct field list. Add edit UI. | 1 |
| BUG-070 | S3 | Academic year create has no validation | BE `AcademicYearController.js:19-27` | End date before start, overlapping years and duplicate names are all allowed. | Validation + unique (school, name). | 2 |
| BUG-023 | S2 | Class/common subject can be created without a year | BE `ClassController.js:21`, `CommonStubjectController.js:22`; FE `ClassForm.js:35-40` | It saves "successfully" and then never appears anywhere. | Year required (default current). | 1 |
| BUG-024 | S3 | Subject's year comes from the school, not the class | BE `SubjectController.js:22-28` | Adding a subject to a past-year class attaches it to the wrong year. | Use `class.AcademicYearId`. | 4 |
| BUG-025 | S2 | Bulk attendance can only mark **present** | BE `StudentTimelineController.js:233,253-270`; FE `BulkAttendence.js` | Absent children get no record, so reports can't tell "absent" from "not taken". Writes race with the response. | New class attendance endpoint saving every status in one transaction. | 3 |
| BUG-026 | S2 | Timeline create duplicates and parses unsafely | BE `StudentTimelineController.js:17-109` (uses `body.studentId`, not the URL; `JSON.parse` throws if `subjects` is missing; one new row per submission) | Marking a child twice shows two entries for the same day. A missing field gives a 500. | Upsert per (student, date). | 3 |
| BUG-019 | S2 | "Not marked yet" shown as "Absent" | BE `StudentController.js:239-241`; FE `StudentsTable.js:62-66` | Admin thinks children are absent when the teacher just hasn't taken attendance. | `null` → "Not marked" chip. | 1 |
| BUG-029 | S1 | **Admin student "Academics" tab shows fake marks** | FE `StudentInfo.js:33-38,199-222` (hard-coded `studentAcademics`) | Every child shows Maths A, Science B, English A, History B. That is misleading and could end up printed or shared. | Hide the tab now. Wire it to real reports in Phase 5. | 1 |
| BUG-062 | S3 | Model/association inconsistencies | BE `models/Teacher.js:49` + `index.js:110` duplicate; `Student.belongsToMany(Subject)` never written; `CommonSubject.addStudents(…, {through:{AcademicYearId}})` refers to a column that doesn't exist | Hidden bugs, confusing for developers. | Single association file. Drop unused joins. | 2 |

## D. Functional bugs: features that don't work

| ID | Sev | Title | Evidence | Plain words | Fix | Phase |
|---|---|---|---|---|---|---|
| BUG-020 | S2 | Class rename always fails | BE `ClassController.js:100` `const Class = await Class.update(...)` (TDZ ReferenceError) | — | Rename the variable. | 1 |
| BUG-021 | S2 | Class delete always fails | BE `ClassController.js:115` (same pattern) | — | Same + block if it has students. | 1 |
| BUG-022 | S3 | Get class by id always fails | BE `ClassController.js:77` `!req.admin \|\| !req.teacher` | — | `&&` + scope. | 1 |
| BUG-031 | S2 | Admin can't delete a chapter | FE `SyllabusForm.js:151` (axios.delete without `headers`) | Delete silently does nothing (401). | Use the API client. | 1 |
| BUG-032 | S2 | "Mark topic completed" (admin) shows an error after succeeding | FE `SyllabusForm.js:392` passes `fetchSyllabus`, `MarkTopicCompleted.js:39,84` expects `fetchSyallabus` | It saved, but the screen says "Error". The admin retries and gets confused. | Fix the prop name. | 1 |
| BUG-033 | S3 | Syllabus add returns before topics exist; order random | BE `SyllabusController.js:74-79` | The list sometimes refreshes with missing topics, in random order. | `bulkCreate` with `sort_order` in a transaction. | 2 |
| BUG-034 | S3 | Chapter delete order | BE `SyllabusController.js:174-176` (chapter first, then topics) | An FK error is possible depending on constraint. | Transaction, children first / `ON DELETE CASCADE`. | 2 |
| BUG-035 | S4 | Admin topic logs never written | BE `SyllabusController.js:205,226` (`createLog('admin', msg, id)`, wrong arity) | The audit trail is missing. | Audit service. | 2 |
| BUG-027 | S3 | Timeline update/delete returns 500 for teachers after succeeding | BE `StudentTimelineController.js:169,189` (`req.admin.id`) | Data changes, but the user sees an error. | Use `req.user`. | 2 |
| BUG-028 | S2 | Teacher "Add academic report" gives no feedback | FE `AcademicDetails.js:32-51` (closes before the response, doesn't refresh, swallows errors) | Teacher can't tell if it saved. Empty type can crash the server (BUG-006). | Await, validate, refresh, toast. | 3 |
| BUG-040 | S2 | Teacher list filter/sort crashes the page | FE `TeacherListHeader.js:22,37,52` (`student.class.toLowerCase()` on undefined) | Selecting a "Class" or "Sort" option gives a white screen. | Remove the fake filter. | 1 |
| BUG-041 | S2 | Student list filter and sort are wrong | FE `StudentListHeader.js:40-49,62-72` (substring: "Class 1" matches "Class 10/11/12"), `:85-101` (`toLowerCase()` makes "createdAt" never match; `modifiedAt` doesn't exist), `:80` mutates props | Wrong children listed. Sort does nothing. | Filter by class id. Sort keys fixed. Do it on the server. | 1 |
| BUG-042 | S3 | Add dialogs close before the save finishes | FE `AddStudent.js`, `AddNewStudent.js:135,171`, `AddTecher.js:56` | On error the typed form is gone and the error appears after closing. | Close only on success. | 2 |
| BUG-043 | S2 | Teacher student edit exits before save; errors silent | FE `StudentDetail.js:55-65` | Teacher believes it saved when it didn't. | Await + show errors + keep edit mode on failure. | 2 |
| BUG-044 | S2 | Expired login shows empty screens | FE: no 401 interceptor anywhere | After the token expires the lists are empty or show "Something went wrong", and the user is stuck. | Interceptor → logout + "Please log in again". | 2 |
| BUG-046 | S3 | Toasts never appear | FE `Components/Student/StudentTimeline.js` uses `react-toastify`; no `<ToastContainer/>` mounted | Delete timeline gives no feedback. | One global notifier. | 2 |
| BUG-047 | S3 | Per-student attendance dialog double-submits | FE `StudentChip.js:43-80` (no loading/disable; errors in console only) | Two taps make two entries. A failure looks like success. | Replaced in Phase 3. | 3 |
| BUG-048 | S3 | CSV upload component broken and hidden | FE `BulkStudent.js:51-56` (spinner stuck when no file), `:102` wrong title, commented out at `TeacherSection/Pages/StudentsList.js:88-90` | — | Admin import page. | 3 |
| BUG-050 | S3 | Year list dates in US format | FE `AcademicYearList.js:157-158` `toLocaleDateString("en-US")` | 06/01/2025 reads as 6 January in India. | Locale-aware DD/MM/YYYY. | 2 |
| BUG-051 | S3 | Class ordering | FE `Class.js:63-70`, `AddNewStudent.js:57-64` (comparator never returns 0; sorted by DB id) | "Std 10" may show before "Std 2". Order depends on creation order. | `grades.sort_order`. | 4 |
| BUG-052 | S4 | Sample CSV filename has literal backticks | BE `StudentController.js:547` | Downloaded file is named oddly. | Template literal. | 2 |
| BUG-053 | S3 | Dashboard numbers wrong or mislabelled | BE `DashboardController.js:28` (counts inactive teachers), `:64-80` (attendance not filtered by year), `:100,105,113` (server-locale date matching can drop data), FE `Home.js:156` "Total Courses" = classes | Admin trusts wrong numbers. | Fix queries, ISO dates, labels. | 2 |
| BUG-054 | S3 | Auth edge cases | BE `tokenVerify.js:43-64` (admin wins if a teacher shares the email; a teacher whose `currentSchool` isn't in their schools is locked out) | — | Unified users. | 2 |
| BUG-055 | S3 | Can't add an existing teacher to a second school | BE `TeacherController.js:76` (unique email) | Teachers working in two schools of the same trust need two emails. | "Add existing teacher" + `user_schools`. | 4 |
| BUG-056 | S3 | Attendance report misses unmarked students; crashes without dates | BE `AttendanceController.js:24-28` | — | Register query from enrollments LEFT JOIN attendance. | 3 |
| BUG-057 | S3 | Upload edge cases | BE `routes/studenttimeline.js:31-63` (locale time with ":" in S3 keys, collisions within the same second, docs allowed but error says "Image only!"), `utils/s3Upload.js:25-34` (HEIC rejected), no size limits | iPhone photos fail. Big photos time out on 3G. | Client compression, UUID keys, size limits, HEIC/WebP accepted. | 2 |
| BUG-067 | S2 | Multi-language is a Google widget overlay | FE `public/index.html:13-14` (en/hi/mr), `GTranslateWraper.js:44` (en/hi/mr/gu), `MyInfo.js:87-101` (cookie hacks + reload) | Wrong translations of school terms, student names translated, flicker, admin side untranslated, needs internet to Google. | Real i18n ([06](06-multilingual-design.md)). | 2 |
| BUG-068 | S2 | PDF export can't print Hindi/Marathi/Gujarati | FE `ExportAttendanceButton.js` (jsPDF default Helvetica) | Names in Devanagari print as boxes. | Embed Noto fonts / server-side PDF. | 3 |
| BUG-069 | S4 | `GET /school/getAll` returns `undefined` for teachers | BE `SchoolController.js:44-50` | — | Return the teacher's schools. | 2 |
| BUG-059 | S3 | App bootstrap inefficiency | FE `App.js:24-61` (`userInfo` re-parsed each render and used as an effect dependency → effect after every render; 1 s artificial splash) | Slower start, extra work. | Auth context. | 2 |
| BUG-060 | S4 | Hot-linked external image | FE `SchoolList.js:75` (maharashtratoday.co.in) | Breaks if that site changes. Privacy leak of the referrer. | Local asset / school logo. | 2 |
| BUG-061 | S4 | Dead UI | FE `AccountMenu.js:84-85` (Profile/My account do nothing), `/schedule` placeholder, `MyInfo.js:155` Switch chip no-op | Users click and nothing happens. | Remove or implement. | 2 |
| BUG-058 | S4 | Spelling and naming | "Attendence" (UI + routes `/attendence`, files), "Common Subjectes", `AddTecher.js`, `CommonStubjectController.js`, `loginRequierd.js`, `GTranslateWraper.js`, `UplaodAvatar` import | Looks unprofessional. Confuses search. | Rename during restructure. | 2 |

## E. Performance and bottlenecks

| ID | Sev | Bottleneck | Evidence | Impact at scale (e.g., 10 schools × 800 students × 200 days) | Fix | Phase |
|---|---|---|---|---|---|---|
| PERF-01 | S2 | No indexes on foreign keys / filter columns | BE models (only PK/unique) | `Attendances` reaches about 1.6 M rows/year. Class register and dashboard queries do sequential scans and take seconds. | Indexes ([08 §4](08-schema-changes.md)). | 2 |
| PERF-02 | S2 | 2–3 DB queries in auth on every request | BE `tokenVerify.js:43-49` (admin + teachers with School include), `adminDetails` heavy include returned by many endpoints | Adds 10–40 ms per call. Big responses. | Role/school in JWT, `/me` cached, slim DTOs. | 2 |
| PERF-03 | S2 | Teacher syllabus loads the entire school tree | BE `SyllabusController.js:128-169` (5-level include), FE `Syllabus.js:43-52` | Payload grows to MBs, slow on 3G phones, renders thousands of DOM nodes. | Per-class/subject endpoints + progress summary endpoint. | 4 |
| PERF-04 | S2 | No pagination | `GET /student/getAll`, `/teacher/getLogs`, `/studentTimeline/getAll`, `/attendance` | Lists slow down as data grows. Logs are unbounded. | `?page&pageSize` / cursor + server-side search. | 2 |
| PERF-05 | S2 | N+1 writes | BE bulk timeline (`findOne`+`create` per student, `save` per timeline), CSV import (GR lookup per row) | 40 students means about 120 queries per save. Slow, and races. | Single `bulkCreate … ON CONFLICT` in a transaction. | 3 |
| PERF-06 | S3 | Search on every keystroke | FE `AddStudent.js:69-87` (no debounce), BE `iLike '%x%'` | A request per letter. Full scans. | Debounce 300 ms + `pg_trgm` index (or retire with the promotion wizard). | 3 |
| PERF-07 | S3 | Dashboard queries run one after another | BE `DashboardController.js:24-80` | About 6 round trips. | `Promise.all` + one aggregated SQL per chart. | 5 |
| PERF-08 | S2 | `sync({alter:true})` at boot | BE `models/index.js:177` | Slow restarts, table locks during deploy. | Migrations. | 2 |
| PERF-09 | S3 | No client caching; repeated fetches; full page reloads | FE: `/class/getAll` fetched separately by 9 components; `window.location.reload()` in `BulkAttendence.js:102`, `TeacherTable.js:36`, `BulkStudent.js:64`, `Login.js:157` | Wasted data on mobile plans. Slow screens. Lost scroll position. | React Query cache + targeted invalidation. | 2 |
| PERF-10 | S3 | Artificial delays (≈ 8 s across common flows) | FE `App.js:53` (1 s splash), `Login.js:103` (2 s), `Home.js:81` (1 s), `BulkAttendence.js:98` (3 s), add/edit dialogs (2 s each) | Feels slow and unresponsive to teachers. | Remove. Show instant optimistic UI + toast. | 2 |
| PERF-11 | S3 | Large JS bundle, no code splitting | FE CRA, eager MUI X charts/date-pickers/lab, jsPDF, `dummyStudents.json`, external GTranslate script | Slow first load on low-end Android over 3G. | Vite + `React.lazy` per route + remove dead deps. Target < 250 KB gzipped initial. | 2 |
| PERF-12 | S2 | Full-size photo uploads | FE all upload components; BE no resize | A 4–8 MB phone photo per upload fails on weak networks. Storage cost. | Client resize to ≤ 1280 px / ~200 KB WebP/JPEG. Server thumbnail via sharp. Drop the bucket-name thumbnail hack (`getThumbLink`). | 2 |
| PERF-13 | S2 | No offline support | FE service worker unregistered | Rural classrooms with no signal can't take attendance. | PWA + IndexedDB queue for attendance (Phase 6). | 6 |
| PERF-14 | S4 | Logs grow forever | BE `Logs` | Table bloat. | Retention (e.g., 2 years) + index on (school_id, created_at). | 5 |

## F. Code quality and maintainability

| ID | Sev | Issue | Evidence | Fix | Phase |
|---|---|---|---|---|---|
| CQ-01 | S2 | Duplicate admin/teacher components | FE: `AddStudent`↔`AddNewStudent`, `NewStudentTab`×2, `PreviousAcademicYearTab`×2, `StudentTimeline`×2, `UploadAvatar`×3 | `features/students` shared components with role-based props. | 2 |
| CQ-02 | S3 | Copy-paste UI blocks | FE: 44 near-identical fixed `<Alert>` blocks; 7 copy-pasted drawer items (`AdminMain.js:223-454`); `headers` objects built in 39 places | `useNotify()`, data-driven menu, API client. | 2 |
| CQ-03 | S3 | Inconsistent API design | BE: `/getAll`, `/get/:id`, `POST` for state changes, mixed `error`/`message` keys, 201 for update/delete, 500 for auth/validation errors | REST `/api/v1/...`, error format `{error:{code,message,fields}}`, correct status codes. | 2 |
| CQ-04 | S3 | Authorization done inside controllers via `throw` | BE: about 40 `if (!req.admin) throw new Error(...)` returning 500 | `authorize()` middleware returning 403. | 1 |
| CQ-05 | S2 | No automated tests | BE none; FE `App.test.js` fails | Jest+supertest (BE), Vitest+RTL (FE), Playwright E2E. CI gate. | 0/2 |
| CQ-06 | S3 | No lint/format; `console.log` in production code | both | ESLint + Prettier + husky pre-commit; remove logs. | 2 |
| CQ-07 | S4 | Misleading generated comments | e.g., `GTranslateWraper.js` header lists Gujarati but index.html doesn't; `TeacherMain.js` says "four sections", has 3; `config/db.js` says "development" for prod SSL setting | Remove noise comments; keep only "why" comments. | 2 |
| CQ-08 | S3 | Dead code | See [01 §3.15, §5](01-inventory.md) (20+ files/handlers) | Delete in Phase 2. | 2 |
| CQ-09 | S3 | Magic strings for statuses/roles | `'present'`, `'admin'`, `'s1'`… spread across BE/FE | Shared constants/enums. | 2 |
| CQ-10 | S3 | No service layer | Business logic + queries in controllers | `modules/*/service.js`. | 2 |
| CQ-11 | S2 | No transactions for multi-step writes | create school + update admin, CSV import, bulk timeline, syllabus edit | `sequelize.transaction()`. | 2 |
| CQ-12 | S2 | No logging/monitoring | BE `console.log` only | pino + request ids + Sentry (BE/FE) + uptime check. | 2 |
| CQ-13 | S3 | No CI/CD | — | GitHub Actions: lint, test, build, migrate check. | 2 |
| CQ-14 | S3 | Env not validated, no `.env.example` | BE/FE | `config/env.js` with zod; examples. | 2 |
| CQ-15 | S3 | Associations defined in several places | `models/*.js` + `models/index.js` | One `associate()` per model, called once. | 2 |

---

## G. Summary counts

| Area | S1 | S2 | S3 | S4 | Total |
|---|---|---|---|---|---|
| Security & privacy (A) | 7 | 4 | 2 | 0 | 13 |
| Stability (B) | 2 | 1 | 2 | 0 | 5 |
| Data integrity (C) | 5 | 6 | 3 | 0 | 14 |
| Functional (D) | 0 | 11 | 16 | 6 | 33 |
| Performance (E) | 0 | 8 | 5 | 1 | 14 |
| Code quality (F) | 0 | 4 | 10 | 1 | 15 |
| **Total** | **14** | **34** | **38** | **8** | **94** |

### Top 12 to fix first (Phase 1)
BUG-001, BUG-002, BUG-003, BUG-004, BUG-005, BUG-006, BUG-008, BUG-030, BUG-015, BUG-013/012, BUG-029, BUG-009.
