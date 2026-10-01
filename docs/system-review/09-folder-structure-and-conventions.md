# 09 — Target Folder Structure and Code Conventions

The current structure is flat (backend: `controllers/ models/ routes/`; frontend: `AdminSection/ TeacherSection/` with duplicated components). The target structure is **feature-first** in both repos. Code for one capability (e.g., attendance) lives together, and admin and teacher screens share components and differ only by permissions.

---

## 1. Backend (Signal-School-Backend)

```
signal-school-backend/
├─ src/
│  ├─ app.js                    # builds the express app (no listen) – used by tests
│  ├─ server.js                 # listen + graceful shutdown
│  ├─ config/
│  │  ├─ env.js                 # zod-validated env (fails fast on missing vars)
│  │  ├─ db.js                  # Sequelize instance (pool, SSL CA)
│  │  └─ s3.js                  # @aws-sdk/client-s3 v3 client (region from env)
│  ├─ db/
│  │  ├─ models/                # one file per table, each exports (sequelize) => Model + associate()
│  │  ├─ models/index.js        # loads models, calls associate() ONCE
│  │  ├─ migrations/            # versioned migrations (no sync in prod)
│  │  └─ seeders/               # demo + test seed (two orgs, Devanagari names, past year)
│  ├─ middlewares/
│  │  ├─ authenticate.js        # verify JWT (sub, role, schoolIds, tokenVersion)
│  │  ├─ authorize.js           # authorize('admin','clerk') → 403
│  │  ├─ schoolScope.js         # resolves req.schoolId (header X-School-Id / default), checks membership
│  │  ├─ academicYearScope.js   # resolves req.academicYear, blocks writes to closed years (423)
│  │  ├─ validate.js            # zod schema → 400 with field codes
│  │  ├─ upload.js              # multer memory storage + size/type limits
│  │  ├─ rateLimit.js           # login + general limits
│  │  ├─ requestId.js
│  │  └─ errorHandler.js        # AppError → {error:{code,message,fields}}; unknown → 500 + log
│  ├─ modules/
│  │  ├─ auth/                  # login, refresh, logout, me, change-password, invites
│  │  ├─ organizations/
│  │  ├─ schools/
│  │  ├─ academic-years/        # + rollover.service.js, promotions.service.js
│  │  ├─ grades/
│  │  ├─ class-sections/
│  │  ├─ subjects/
│  │  ├─ users/                 # teachers, clerks, assignments
│  │  ├─ students/              # + history, gr-number.service.js
│  │  ├─ imports/               # student import preview/apply
│  │  ├─ attendance/            # take/edit, sessions, register, holidays
│  │  ├─ daily-logs/
│  │  ├─ syllabus/              # chapters, topics, completions, progress
│  │  ├─ reports/               # report entries, report cards
│  │  ├─ exports/               # xlsx/pdf generation (Noto fonts)
│  │  ├─ dashboard/
│  │  └─ audit/
│  │     # each module: <name>.routes.js, <name>.controller.js (thin), <name>.service.js (logic+tx),
│  │     #              <name>.schemas.js (zod), <name>.test.js (integration)
│  ├─ utils/
│  │  ├─ AppError.js, errorCodes.js
│  │  ├─ asyncHandler.js
│  │  ├─ dates.js               # school timezone helpers (Asia/Kolkata)
│  │  ├─ logger.js              # pino
│  │  └─ storage.js             # put/get signed URL, image resize (sharp)
│  └─ server-locales/           # i18n strings for PDFs/Excel/SMS only
├─ scripts/
│  ├─ migrate-legacy-to-v2.js
│  ├─ seed-test-data.js
│  └─ create-owner.js           # bootstrap first org owner (replaces public register)
├─ tests/
│  ├─ helpers/ (test db, factories, auth tokens)
│  ├─ security/scope-matrix.test.js  # every route × {no token, teacher, other-org admin}
│  └─ e2e-api/
├─ docs/
├─ .env.example
├─ .nvmrc  (20)
├─ .eslintrc.cjs / .prettierrc
└─ package.json  (scripts: dev, start, test, lint, db:migrate, db:seed, db:reset)
```

### API conventions
- Base path `/api/v1`. Resources are plural nouns, and HTTP verbs carry the meaning:
  `GET /students?classSectionId=&q=&status=&page=` · `POST /students` · `GET /students/:id` · `PATCH /students/:id` · `POST /students/:id/leave` · `GET /students/:id/history`.
- Attendance: `GET /attendance/class-sections/:id/dates/:date` · `PUT /attendance/class-sections/:id/dates/:date` (whole class, idempotent) · `GET /attendance/register?classSectionId=&month=2026-07`.
- Responses: `{ data, meta? }`. Errors: `{ error: { code, message, params?, fields?, requestId } }`.
- Status codes: 200/201/204, 400 validation, 401 unauthenticated, 403 forbidden, 404 not found (also used for out-of-scope ids), 409 conflict, 423 year locked, 429 rate-limited, 500.
- Pagination `page`, `pageSize` (max 100) with `meta.total`.
- Dates as ISO `YYYY-MM-DD` (school-local calendar dates). Timestamps in UTC ISO.
- **Never** return `password_hash`. DTO mappers live per module.

---

## 2. Frontend (Signal-School-Frontend)

Move from CRA to **Vite** (faster builds, smaller bundles, modern PWA plugin).

```
signal-school-frontend/
├─ index.html
├─ vite.config.js               # + vite-plugin-pwa (Phase 6)
├─ src/
│  ├─ main.jsx
│  ├─ app/
│  │  ├─ App.jsx
│  │  ├─ providers.jsx          # ThemeProvider, I18nextProvider, QueryClientProvider, AuthProvider, YearProvider, Notifier
│  │  ├─ routes.jsx             # lazy routes; role guards
│  │  └─ layouts/
│  │     ├─ AdminLayout.jsx     # responsive: drawer ≥ md, bottom nav < md; header w/ school + year + language
│  │     └─ TeacherLayout.jsx   # bottom nav: Today · Classes · Syllabus · Me
│  ├─ api/
│  │  ├─ client.js              # axios instance: baseURL, auth, X-School-Id, X-Academic-Year, Accept-Language, 401 → logout, error normalization
│  │  └─ endpoints/*.js         # typed-ish functions per module
│  ├─ i18n/                     # see 06-multilingual-design.md
│  ├─ features/
│  │  ├─ auth/                  # LoginPage, LanguagePicker, ChangePasswordPage, FirstLogin
│  │  ├─ today/                 # Teacher home
│  │  ├─ attendance/            # TakeAttendancePage, AttendanceRow, RegisterPage, HolidaysPage, offlineQueue.js
│  │  ├─ students/              # StudentListPage, StudentProfilePage, StudentForm, HistoryTab, ImportStudentsPage
│  │  ├─ daily-diary/           # ClassNoteSheet, StudentNoteSheet, DiaryTimeline
│  │  ├─ syllabus/              # TeacherSyllabusPage, SyllabusEditorPage, ProgressBar
│  │  ├─ academic-years/        # YearSwitcher, YearsPage, RolloverWizard/*
│  │  ├─ classes/               # ClassesAndSubjectsPage, GradesPage
│  │  ├─ teachers/              # TeacherListPage, TeacherProfilePage, AssignmentsEditor
│  │  ├─ schools/  organization/  dashboard/  reports/  audit/  profile/
│  ├─ shared/
│  │  ├─ components/            # PageHeader, BigButton, ConfirmDialog, EmptyState, StatusChip(P/A/L),
│  │  │                         # PhotoPicker (camera + compression), DateField (locale), SaveBar, ReadOnlyYearBanner
│  │  ├─ hooks/                 # useAuth, useYear, useNotify, useDebounce, useOnlineStatus
│  │  └─ utils/                 # dates.js (dayjs+locale), format.js, permissions.js
│  ├─ theme/                    # palette (WCAG AA), typography (Noto), component overrides (min 48px targets)
│  └─ test/                     # setup, msw handlers
├─ e2e/                         # Playwright specs (+ screenshot per language)
├─ .env.example                 # VITE_API_BASE_URL
└─ package.json                 # scripts: dev, build, preview, test, e2e, lint, i18n:extract
```

### Frontend conventions
- **Server state with React Query.** No ad-hoc `useEffect` + axios. Query keys include `schoolId` and `yearId`.
- **Forms with react-hook-form + zod.** Error messages through i18n. Keep form data on server error.
- **One notifier** (`useNotify().success/error`). No per-component fixed `<Alert>` blocks.
- **No `window.location.reload()`.** Invalidate queries instead.
- **Every route lazy-loaded.** Heavy libraries (charts, date pickers, PDF) load only on the pages that use them.
- **Permissions in one place:** `can(user, 'attendance.write', section)` mirrors the backend matrix (backend is the authority).
- **No literal UI strings** (ESLint i18next rule).

---

## 3. Migration path (incremental, not big-bang)

1. **Phase 1** fixes critical bugs in the **current** structure (small, safe diffs).
2. **Phase 2** creates `src/app.js` + `modules/` in the backend and moves modules one at a time behind `/api/v1` while keeping the old routes alive. In the frontend: Vite migration + `api/client.js` + i18n + `features/` folders, moving screens one at a time.
3. **Phases 3–5** build the new features directly in the new structure. Old routes and components are deleted as each replacement ships (tracked in [01 §3.15 and §5](01-inventory.md)).
4. When the last legacy route has no callers (checked via access logs), remove the legacy routers and models.
