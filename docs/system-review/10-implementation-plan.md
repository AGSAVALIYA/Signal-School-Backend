# 10 — Implementation Plan

> Format follows the *superpowers:writing-plans* structure (header → global constraints → review focus → phased tasks with files, interfaces and checkbox steps). Those skills weren't installed in this session, so the format was taken from the public skill and applied here.

**Goal.** Make Signal School safe, reliable and **easy for non-technical teachers**, with **real multi-language support** and an **effortless academic-year rollover with full history**.

**Architecture.** Express + Sequelize (PostgreSQL) API restructured into feature modules under `/api/v1` with role/school/year scoping middleware. React frontend moved to Vite with feature folders, React Query, i18next, and a teacher-first mobile UI. Data model v2 separates permanent **students** from per-year **enrollments** ([08](08-schema-changes.md)).

**Tech stack additions.** BE: zod, helmet, express-rate-limit, pino, sequelize-cli/umzug, jest + supertest, @aws-sdk/client-s3 v3, sharp, exceljs, pdfmake (Noto fonts). FE: Vite, i18next/react-i18next, @tanstack/react-query, react-hook-form + zod, browser-image-compression, vite-plugin-pwa, vitest + RTL, Playwright.

**Specs this plan implements:** [01 inventory](01-inventory.md) · [02 stories](02-user-stories.md) · [03 tests](03-test-cases.md) · [04 UX](04-ux-walkthrough.md) · [05 issues](05-issues-register.md) · [06 i18n](06-multilingual-design.md) · [07 academic year](07-academic-year-design.md) · [08 schema](08-schema-changes.md) · [09 structure](09-folder-structure-and-conventions.md) · [11 feature gaps](11-feature-gaps.md).

---

> **Status:** Phases 1–6 implemented in round 2; Phase 7 partly. See the status table in [README](README.md#implementation-status-round-2).

## Global constraints

1. **Never test against production data.** Use a seeded test DB. Production migrations only after a backup.
2. **Every bug fix starts with a failing test** (supertest for API, RTL/Playwright for UI) that reproduces the BUG-ID.
3. **No literal UI strings** in new or touched frontend code (from Phase 2 on, enforced by lint).
4. **Legacy routes keep working** until the frontend no longer calls them (both repos ship together per phase).
5. **Every school-owned query is scoped** by `school_id` (and `academic_year_id` where relevant). The scope-matrix test must pass.
6. **Mobile budget:** teacher screens are interactive in < 3 s on Slow 3G / Moto G4. Initial JS < 250 KB gzipped. Images ≤ 200 KB.
7. **Accessibility:** ≥ 16 px text, ≥ 48 px touch targets, WCAG AA contrast, icon + label on teacher screens.
8. **Children's data:** minimal collection, no full Aadhaar in responses, private photo storage, audit for edits/deletes.
9. **Small PRs**, one task each where possible. Run `lint + test` before pushing. Don't merge on red CI.

## Review focus: five failure modes not covered elsewhere, and the test that guards each

| # | Failure mode | Guarding test (owning task) |
|---|---|---|
| R1 | A newly added endpoint forgets scoping and leaks another school's data | `tests/security/scope-matrix.test.js` **auto-enumerates** all express routes and calls each with {no token, teacher of other school, admin of other org}; expects 401/403/404 (Task 1.2, extended in 2.3) |
| R2 | Rollover double-submits or half-fails, creating duplicate years/sections | Idempotency + transaction test: two concurrent `POST /rollover` with the same key yield one year; an injected failure mid-apply leaves 0 rows (Task 4.2) |
| R3 | Legacy migration merges two different children who share a GR or name | Fixture with deliberate collisions (same GR different DOB, same name different GR); the dry-run must list them in `review-students.csv` and never auto-merge (Task 3.3) |
| R4 | Attendance saved near midnight lands on the wrong day (server UTC vs IST) | Test with `TZ=UTC` server: a request at 23:45 IST with date omitted resolves to the IST calendar date; explicit dates are never shifted (Task 3.6) |
| R5 | Missing translations show raw keys (`attendance.take.save`) or silent English in production | CI `i18n:check` fails on missing keys in P1 namespaces. The Playwright screenshot run fails if visible text matches `/^[a-z]+(\.[a-zA-Z]+){1,}$/` (Task 2.6) |
| R6 | Offline sync overwrites a newer online edit | Sync sends `marked_at`; the server keeps the newer row and audits the conflict; test both orders (Task 6.2) |

---

## Phase 0 — Test round (NEXT ITERATION, no code changes to features)

**Outcome:** every predicted item in docs 01/03/05 is marked Confirmed / Not reproduced, real teacher feedback is captured, and baseline metrics are recorded.

### Task 0.1: Test environment
**Files:** Create `docs/system-review/test-env.md` (BE), `.env.example` (BE & FE), `scripts/seed-test-data.js` (BE)
- [ ] Write `.env.example` for BE: `POSTGRES_URL, JWT_SECRET, JWT_EXPIRE_TIME, PORT, AWS_IAM_ACCESS_KEY_ID, AWS_IAM_SECRET_ACCESS_KEY, AWS_AVATAR_BUCKET, AWS_TIMELINE_BUCKET, AWS_FACULTY_BUCKET` (+ AWS_REGION) and FE `REACT_APP_API_BACKEND`.
- [ ] `docker run -p 5432:5432 -e POSTGRES_PASSWORD=test postgres:15`. Start the API once so the existing `sync` creates tables (test DB only).
- [ ] Write `seed-test-data.js` creating the dataset in [03 §1.1](03-test-cases.md) (2 orgs, id collisions, Devanagari names, past year with 20 days attendance). Use a local S3 mock (MinIO) or a test bucket.
- [ ] Verify: log in as each seeded user; record the commands in `test-env.md`.

### Task 0.2: Execute functional, security and performance cases
- [ ] Run TC-AUTH … TC-A11Y. Record Status/Actual/Evidence in a spreadsheet (`docs/system-review/results/test-run-1.xlsx`, or results columns appended in 03).
- [ ] For each ❌, link the BUG-ID or open a new one in 05 (next free number).
- [ ] Baselines: Lighthouse mobile score + LCP + JS size; API p95 for `/student/getAll`, `/syllabus/getFull`, bulk attendance; DB queries per request.

### Task 0.3: Non-technical UX sessions
- [ ] Recruit 2–3 real teachers (at least 1 Marathi-first, 1 older than 40) + 1 principal.
- [ ] Run TC-UX-01…14 with think-aloud. Record screen and audio (with consent). Stopwatch.
- [ ] Capture each tester's **own words** for buttons and terms, and update the glossary in 06 §7.
- [ ] Fill the satisfaction questionnaire.

### Task 0.4: Triage and report
**Files:** Create `docs/system-review/12-test-report-round-1.md`
- [ ] Summary table: confirmed vs not reproduced by severity. Top 10 teacher pain points (quotes). Metric baselines.
- [ ] Re-prioritize Phases 1–7 if test findings change the ordering. Commit the docs.

**Exit criteria:** 100% of P1 cases executed. All S1 items confirmed or closed. Report committed.

---

## Phase 1 — Critical safety fixes on the current code (≈ 1–2 weeks)

Small, surgical diffs in the existing structure. No redesign.

### Task 1.1: Test harness for the backend
**Files:** Create `app.js` (export express app; `server.js` only listens), `tests/helpers/db.js`, `tests/helpers/factories.js`, `jest.config.js`; Modify `package.json` (scripts `test`), `models/index.js` (skip `sync` when `NODE_ENV=test`, use `sync({force:true})` in the test helper only)
**Interfaces:** `createApp(): express.Application`; `tokenFor(user): string`
- [ ] Split `server.js` into `app.js` + `server.js`.
- [ ] Jest + supertest against a test Postgres (`POSTGRES_URL_TEST`).
- [ ] Smoke test `GET /` returns 200. Run `npm test`, which passes.

### Task 1.2: Authentication and role fixes (BUG-001, BUG-003, BUG-005)
**Files:** Modify `controllers/AdminController.js`, `TeacherController.js` (add `role` to JWT payload), `middlewares/adminConstraint.js`, `middlewares/tokenVerify.js`, `models/Admin.js`, `models/Teacher.js` (defaultScope excludes password), `utils/adminDetails.js`, `routes/auth.js`; Test `tests/security/auth.test.js`, `tests/security/scope-matrix.test.js`
- [ ] Failing tests: a teacher token on `GET /teacher/getAll` → 403. `/admin/getAll` without a token → 401. Login response has no `password`.
- [ ] JWT payload `{ sub, role: 'admin'|'teacher', email }`. `adminConstraint` requires `role==='admin'` and looks up by `sub`. `tokenVerify` branches on `role`. Old tokens without `role` → 401 (force re-login, announced to users).
- [ ] `defaultScope: { attributes: { exclude: ['password'] } }` + `scope('withPassword')` for login only.
- [ ] Remove `/admin/getAll` and `/admin/get/:id`. Disable `/admin/register` unless `ALLOW_ADMIN_REGISTER=true`. Add `scripts/create-owner.js`.
- [ ] Scope-matrix test skeleton enumerating routes (R1).
- [ ] Tests pass. Commit `fix(auth): role-based tokens, hide password hashes, close admin registration`.

### Task 1.3: Tenant scoping (BUG-004, BUG-002, BUG-010, BUG-011)
**Files:** Create `middlewares/schoolScope.js`, `utils/scope.js` (`assertInSchool(model, id, schoolId)`); Modify `routes/attendance.js`, `routes/organization.js`, `SchoolController.js`, `OrganizationController.js`, `AdminController.js`, `StudentController.js`, `SubjectController.js`, `ClassController.js`, `AcademicYearController.js`, `SyllabusController.js`, `StudentTimelineController.js`, `TeacherController.js`
- [ ] Failing tests from TC-SEC-04/05/06, TC-SCH-03/05/06/07, TC-ARP-07.
- [ ] `tokenVerify` on `/attendance/:classId` + class must be in `req.currentSchool`.
- [ ] `switchSchoolAdmin`, school update/delete, and org update/delete check organization ownership. Whitelist school update fields and `await`.
- [ ] Every by-id handler loads the record joined to its school and returns 404 if it's out of scope.
- [ ] Syllabus write routes + timeline update/delete require admin (teacher writes come back in Phase 4 with assignments). `markTopicAsCompleted` uses `req.teacher.id` for teachers. Avatar upload: self or admin.
- [ ] Tests pass. Commit.

### Task 1.4: Crash-proofing (BUG-006, BUG-018)
**Files:** Create `utils/asyncHandler.js`, `middlewares/errorHandler.js`; Modify all route files (wrap handlers), `ReportController.js`, `AcademicYearController.js`, `SyllabusController.js`, `StudentTimelineController.js`, `utils/createLogs.js`, `server.js`
- [ ] Failing tests: `POST /report/create {}` → 400 and the server stays up. Invalid `setCurrentAcademicYear` → 404.
- [ ] Wrap all handlers. Global error handler returns `{error:{code,message}}`. Replace `forEach(async)` with `await Promise.all` / `bulkCreate` in a transaction. Await `setSubjects`. `createLog` catches its own errors.
- [ ] `process.on('unhandledRejection')` logs (does not swallow). Run under PM2/systemd with restart.
- [ ] Null-check before use in `getStudentById`.

### Task 1.5: Data-loss fixes (BUG-030, BUG-015, BUG-016, BUG-012, BUG-013, BUG-023)
**Files:** Modify `SyllabusController.js` (`editChapter`), `AcademicYearController.js`, FE `AcademicYearList.js`, `StudentController.js` (`createStudent`, `getStudentsFromCsv`), `ClassController.js`, `CommonStubjectController.js`; Create migration-free safety: unique index on `(SchoolId, GRNumber)` via a guarded raw query in the test/prod release script
- [ ] `editChapter`: update the chapter name. For topics, accept `[{id?, content}]`, update existing ids in place, create new ones, and delete removed ones only if they have no completion (otherwise 409). FE `ChapterChip` sends ids.
- [ ] AY delete: 409 if it's the current year or has classes. FE: confirm dialog. AY update: drop the `ClassId` requirement. Validate dates.
- [ ] GR: allocate in a transaction with `SELECT … FOR UPDATE` on the school row (add `nextGrNumber` column via a one-off SQL). CSV: allocate N numbers once, validate rows, delete the tmp file.
- [ ] Class/common subject create requires `AcademicYearId` (default current).

### Task 1.6: Wrong-information fixes (BUG-029, BUG-019, BUG-020/021/022, BUG-031, BUG-032, BUG-040, BUG-041)
**Files:** FE `StudentInfo.js`, `StudentsTable.js`, `SyllabusForm.js`, `MarkTopicCompleted.js`, `TeacherListHeader.js`, `StudentListHeader.js`; BE `StudentController.js`, `ClassController.js`
- [ ] Hide the dummy Academics tab (show real reports via the existing `/report/getForCurrAY`).
- [ ] `todayStatus: null` → "Not marked" chip (neutral colour). Present/Absent chips correct.
- [ ] Fix the class update/delete TDZ and the `getClassById` condition.
- [ ] Syllabus delete with headers. Fix the `fetchSyllabus` prop name.
- [ ] Remove the fake teacher class filter. Fix sort. Student filter by class id (exact). No prop mutation.

### Task 1.7: Privacy and repo hygiene (BUG-008, BUG-009, FG-14)
- [ ] `git rm --cached tmp/csv/*` (keep `.gitignore`). Decide on a history purge (`git filter-repo`) if the repo is shared outside the team.
- [ ] Teacher creation: if no password, generate a random 10-char temporary password, return it **once**, and set `mustChangePassword` (column added). Minimum length 8. `express-rate-limit` on login (10 / 15 min / IP+email).
- [ ] Enable daily automated DB backups (provider snapshot or `pg_dump` cron to private storage, 30-day retention). Write the restore runbook and test a restore once.

**Phase 1 exit:** all S1 BUG-IDs closed with tests. Scope-matrix green. A deployed hotfix release, with users told about the forced re-login.

---

## Phase 2 — Foundations (≈ 2–3 weeks): structure, API client, real i18n

### Task 2.1: Backend skeleton and conventions
**Files:** Create `src/` tree per [09 §1](09-folder-structure-and-conventions.md), `src/config/env.js`, `src/utils/AppError.js`, `src/utils/errorCodes.js`, `src/middlewares/{authenticate,authorize,validate,requestId,rateLimit,upload}.js`; Modify `package.json`
- [ ] Move existing routes under the new app (mounted at `/` for legacy + `/api/v1` for new modules).
- [ ] helmet, CORS allow-list from env, `express.json({limit:'1mb'})`, pino request logs with request id, `/health` with DB ping.
- [ ] ESLint + Prettier + husky. GitHub Actions: lint, test, (FE) build.

### Task 2.2: Migrations instead of sync (BUG-007)
**Files:** Create `src/db/migrations/0001-baseline.js` (from the prod schema), `.sequelizerc`; Modify `models/index.js` (remove `sync` outside tests)
- [ ] Generate the baseline from `pg_dump --schema-only` of production (staging copy).
- [ ] `npm run db:migrate` in the deploy script. CI runs migrate up/down on an empty DB.

### Task 2.3: Users and roles (FG-15, BUG-054/055 groundwork)
**Files:** Migrations `0002-users.js`, `0003-user-schools.js`, `0004-invites.js`; Create `src/modules/auth/*`, `src/modules/users/*`; Script `scripts/migrate-admins-teachers-to-users.js`
**Interfaces:** `POST /api/v1/auth/login {identifier, password}` → `{accessToken, refreshToken, user}`; `GET /api/v1/me`; `PATCH /api/v1/me`; `POST /api/v1/me/password`; `POST /api/v1/invites`; `POST /api/v1/invites/:token/accept`
- [ ] Copy admins and teachers into `users` + `user_schools` (keep the old tables in place for now).
- [ ] Unified login (email or phone). Refresh token rotation. `token_version` revocation. `mustChangePassword` flow.
- [ ] Extend the scope-matrix test to `/api/v1`.

### Task 2.4: Frontend platform move (Vite, API client, React Query, notifier)
**Files:** Create `vite.config.js`, `src/main.jsx`, `src/app/*`, `src/api/client.js`, `src/shared/hooks/useNotify.js`; Delete CRA files and dead files listed in [01 §5](01-inventory.md) (CMP-12, 17, 23, 35, 50, PG-03, PG-36/37, `test.js`, dummy JSON)
- [ ] Vite migration (env `VITE_API_BASE_URL`). Routes lazy-loaded. Build passes.
- [ ] `client.js`: base URL, auth header, `X-School-Id`, `Accept-Language`, 401 → logout with message (BUG-044), network-error normalization (BUG-045).
- [ ] Replace per-component axios + headers in all screens with endpoint functions + React Query. Remove `window.location.reload()` calls. Remove artificial delays (PERF-10).
- [ ] One notifier. Delete the 44 fixed `<Alert>` blocks.

### Task 2.5: Real multi-language, part 1: infrastructure (BUG-067)
**Files:** Create `src/i18n/index.js`, `src/i18n/languages.js`, `src/i18n/locales/{en,hi,mr,gu}/*.json`, `src/features/auth/LanguagePicker.jsx`; Delete `GTranslateWraper.js`, gtranslate lines in `index.html`, cookie code in `MyInfo.js`, `.gtranslate_wrapper`/`.VIpgJd` CSS
- [ ] i18next setup with the detector order from [06 §3](06-multilingual-design.md). `<html lang>` sync. Noto fonts in the theme.
- [ ] Language picker on login + teacher Me + admin header. Persist via `PATCH /me {preferredLanguage}`.
- [ ] dayjs locales + MUI date picker `adapterLocale`. DD/MM/YYYY everywhere (BUG-050).

### Task 2.6: Real multi-language, part 2: extract and translate every string
- [ ] Extract all literal strings from every existing screen into namespaces (common, auth, students, attendance, syllabus, classes, teachers, academicYear, dashboard, reports, errors). Apply the plain-word renames (06 §7).
- [ ] Backend: replace thrown strings with `AppError(code)`. Mirror the codes in `errors.json`.
- [ ] Translate hi/mr/gu with the teacher reviewers (from Phase 0). `eslint-plugin-i18next` on. `npm run i18n:check` in CI (R5).
- [ ] Playwright screenshot run in 4 languages + pseudo-locale for P1 screens.

### Task 2.7: Uploads hardened (BUG-057, PERF-12, BUG-064 part)
**Files:** Create `src/shared/components/PhotoPicker.jsx`, BE `src/utils/storage.js`, `src/middlewares/upload.js`
- [ ] Client compression (≤ 1280 px, ~200 KB), camera capture, HEIC → JPEG. Server: size limit 5 MB, sharp resize + thumbnail, UUID keys, private bucket + signed URLs, AWS SDK v3.

**Phase 2 exit:** the app is fully usable in en/hi/mr/gu with no GTranslate. The new structure is in place. Scope matrix green on legacy and v1.

---

## Phase 3 — Data model v2 and teacher-first core (≈ 4 weeks)

### Task 3.1: Schema v2 migrations
**Files:** Migrations for `academic_years` (status), `grades`, `class_sections`, `subjects` (v2), `teacher_assignments`, `students` (v2), `enrollments`, `attendance` (v2), `attendance_sessions`, `holidays`, `daily_logs`, `class_daily_logs`, `topic_completions`, `report_entries`, `audit_logs`, `files`, `import_jobs` + indexes ([08 §6](08-schema-changes.md))
- [ ] Migrations up/down tested in CI. Models + associations in `src/db/models`.

### Task 3.2: Grade mapping tool
- [ ] `scripts/migrate-legacy-to-v2.js --step=grades` writes `grade-mapping.<school>.csv`. Admin UI (simple page) or CSV edit to confirm order and next grade.

### Task 3.3: Legacy data migration (dry run + apply)
**Files:** `scripts/migrate-legacy-to-v2.js`, `tests/migration/legacy.test.js` (fixtures incl. R3 collisions)
- [ ] Implement steps 2–8 of [07 §6](07-academic-year-design.md). Dry-run report + `review-students.csv`.
- [ ] Run on a staging copy of production. Review with the principal. Apply in a maintenance window. Keep `legacy_*` tables for 90 days.

### Task 3.4: Students v2 module + shared Student form (US-601…608, BUG-014, BUG-043)
**Interfaces:** `GET/POST /api/v1/students`, `GET/PATCH /api/v1/students/:id`, `POST /api/v1/students/:id/leave`, `POST /api/v1/students/:id/readmit`, `GET /api/v1/students/:id/history`
**Files:** BE `src/modules/students/*`; FE `src/features/students/{StudentListPage,StudentProfilePage,StudentForm,HistoryTab}.jsx`; delete the admin/teacher duplicates (CMP-21/22/44/45)
- [ ] Essentials-first form (06/04 §4.3). DOB or approximate age. Guardian phone. Aadhaar last 4 only.
- [ ] "Mark as left" with reason. List with server-side search/filter/pagination. "Not marked" today status.

### Task 3.5: Teacher assignments + Today home (FG-01, US-502, US-701)
**Files:** BE `src/modules/users/assignments.*`; FE `src/features/teachers/AssignmentsEditor.jsx`, `src/features/today/TodayPage.jsx`, `src/app/layouts/TeacherLayout.jsx`
- [ ] Admin assigns class teacher/subject teachers. The teacher's home lists assigned sections with attendance status from `attendance_sessions`.

### Task 3.6: Take-attendance screen (FG-02, US-702/703/705, BUG-025/026/047)
**Interfaces:** `GET /api/v1/attendance/class-sections/:id/dates/:date` → `{ session, rows:[{enrollmentId, studentId, name, roll, photoUrl, status|null}] }`; `PUT` same path `{ rows:[{studentId, status}] }` → upserts in one transaction, writes the session + audit
**Files:** BE `src/modules/attendance/*`; FE `src/features/attendance/{TakeAttendancePage,AttendanceRow}.jsx`; Tests: R4 timezone test, idempotency test, lock-window test
- [ ] UI per [04 §4.2](04-ux-walkthrough.md): default all present, toggle P→A→L, live counts, sticky save, saved banner with time, error with retry. Future dates blocked. Lock window from school settings.
- [ ] Remove the old chip/bulk attendance screens once released (CMP-41/42, PG-32).

### Task 3.7: Class diary and student notes (FG-20, US-801…803)
- [ ] `class_daily_logs` with one photo. Per-student notes (upsert per author/day). The diary timeline merges both. Authors edit their own entries.

### Task 3.8: Holidays and attendance register (FG-03, FG-04, US-706/707, BUG-056, BUG-068)
**Interfaces:** `GET /api/v1/attendance/register?classSectionId&month=YYYY-MM&format=json|xlsx|pdf&lang=mr`
- [ ] Register grid (enrollments LEFT JOIN attendance, holidays marked), totals/%. Excel via exceljs. PDF with Noto fonts on the server.

### Task 3.9: Student import/export (FG-11, US-603/606, BUG-013 final)
- [ ] `import_jobs`: upload → preview with per-row errors → apply valid rows. Template in the user's language. Export `.xlsx`.

**Phase 3 exit:** TC-ATT2-*, TC-STU v2 and TC-UX-03/04/05 pass with real teachers in their language. Attendance under 45 s for 40 children.

---

## Phase 4 — Academic year experience and syllabus (≈ 3 weeks)

### Task 4.1: Year scoping and switcher (US-304, US-305)
**Files:** BE `src/middlewares/academicYearScope.js`; FE `src/features/academic-years/YearSwitcher.jsx`, `ReadOnlyYearBanner.jsx`, `YearProvider`
- [ ] All v1 list/report endpoints accept the year. Writes to closed years → 423. Admin unlock (audited).
- [ ] Header switcher + yellow banner. Query keys include `yearId`. Student History tab.

### Task 4.2: Rollover wizard (US-301…303, FG-31, R2)
**Files:** BE `src/modules/academic-years/{rollover.service,rollover.controller,promotions.service}.js` + tests; FE `src/features/academic-years/RolloverWizard/{Step1Year,Step2Classes,Step3Subjects,Step4Teachers,Step5Promotion,Step6Review}.jsx`
**Interfaces:** `buildPlan(sourceYearId, options) → Plan` (pure); `applyPlan(plan, {tx, idempotencyKey}) → Summary`
- [ ] Unit tests for `buildPlan` (section mapping, final grade → graduate, inactive teachers skipped).
- [ ] Integration: full rollover of the seeded school; counts match; completions 0; idempotency; injected failure → rollback.
- [ ] UI per [04 §4.5](04-ux-walkthrough.md) / [07 §3](07-academic-year-design.md). Dashboard banner 45 days before the year ends.
- [ ] Activation/close/reopen endpoints + overlap handling.

### Task 4.3: Academic years page (US-306, BUG-015/016/070 final)
- [ ] List with status badges, edit dates, delete only planned-empty years, close/reopen.

### Task 4.4: Classes & subjects page and grades (US-401…404, BUG-020/021/024/051)
- [ ] One page: grades (order, next grade), sections per year with inline subjects, rename/delete/reorder, optional translations.

### Task 4.5: Syllabus rebuilt (US-901…904, PERF-03, FG-21)
**Interfaces:** `GET /api/v1/syllabus/progress?yearId` (per section/subject %), `GET /api/v1/subjects/:id/syllabus`, `PUT /api/v1/subjects/:id/syllabus` (diff update), `POST /api/v1/topics/:id/completion`, `DELETE /api/v1/topics/:id/completion`
- [ ] Editor: paste lines → topics, drag order, rename keeps completions.
- [ ] Teacher: My classes → subject cards with progress → checklist with date and a clear undo label.
- [ ] Progress report for the principal.

### Task 4.6: Onboarding checklist and in-app help (FG-18, FG-19)
- [ ] Dashboard checklist. Help cards per screen. Video links per language (record after the UI stabilizes).

**Phase 4 exit:** TC-ROLL-01…06 pass. TC-UX-11 (new year) ≤ 15 min. TC-UX-12 (last year's attendance) ≤ 60 s.

---

## Phase 5 — Reports, dashboard, oversight (≈ 2–3 weeks)

- [ ] **5.1** Marks/grade grid per class subject + report entries API (FG-09, US-1001, BUG-028 final).
- [ ] **5.2** Report card PDF in the local language (FG-08, US-1002).
- [ ] **5.3** Actionable dashboard: classes not marked today, absentees with guardian phone, attendance %, syllabus %, birthdays. Aggregated SQL with `Promise.all` (US-1101, US-708, BUG-053, PERF-07).
- [ ] **5.4** At-risk list (FG-05, US-709). Data-quality report (FG-23).
- [ ] **5.5** Audit log viewer (FG-16, US-505). Retention job (PERF-14).
- [ ] **5.6** Organization dashboard (FG-10). Government export fields (FG-29). OTP password reset (FG-30).

## Phase 6 — Offline and performance (≈ 2 weeks)

- [ ] **6.1** PWA (vite-plugin-pwa): app shell cache, installable, update prompt.
- [ ] **6.2** Offline attendance queue in IndexedDB with background sync, pending indicator, conflict rule (R6) (FG-07, US-704).
- [ ] **6.3** Performance budget in CI (bundle size check, Lighthouse CI on P1 pages). Index review with `EXPLAIN ANALYZE` on register/dashboard queries using production-size seed (PERF-01/04).
- [ ] **6.4** Load test with k6 (TC-PERF-09) and fix hotspots.

## Phase 7 — Extras (prioritize after Phase 3 feedback)

Parent absence SMS/WhatsApp (FG-12) · Leaving/transfer certificate (FG-13) · ID cards (FG-17) · Birthdays (FG-22) · Mid-day meal counts (FG-24) · Staff attendance (FG-25) · Student documents (FG-26).

---

## Rough timeline (1 full-stack dev + 1 part-time QA/translator)

| Phase | Duration | Cumulative |
|---|---|---|
| 0 Test round | 1 week | wk 1 |
| 1 Critical fixes | 1–2 weeks | wk 3 |
| 2 Foundations + i18n | 2–3 weeks | wk 6 |
| 3 Data model v2 + attendance/students | 4 weeks | wk 10 |
| 4 Academic year + syllabus | 3 weeks | wk 13 |
| 5 Reports & dashboard | 2–3 weeks | wk 16 |
| 6 Offline & performance | 2 weeks | wk 18 |
| 7 Extras | ongoing | — |

Release after each phase. Phases 1, 2 and 3 each end with a short teacher session (2 tasks) to confirm direction.

## Self-review checklist (done for this plan)
- [x] Every S1/S2 BUG in 05 maps to a task (Phase 1: security/stability/data loss; Phases 2–6: the rest).
- [x] Every "M" user story in 02 maps to a task (E1→2.3/2.5/2.6; E3→4.1–4.3; E6→3.4/3.9; E7→3.5/3.6/3.8; E9→4.5; E12→1.2–1.7).
- [x] Review-focus tests R1–R6 each have an owning task.
- [x] Interfaces are consistent with [07 §5](07-academic-year-design.md) and [09 §1](09-folder-structure-and-conventions.md).
- [x] The plan describes what to build, not code transcripts.

## Execution handoff
After Phase 0, choose: **subagent-driven** (one task per agent with independent review) or **native** (one developer implements tasks in order with a review at each phase exit). Either way, open one PR per task (or a small group of tasks) and keep both repos' PRs linked per phase.
