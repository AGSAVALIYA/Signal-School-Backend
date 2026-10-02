# Architecture

## Overview

```
 Phone / laptop browser                                   Server
┌──────────────────────────────┐   HTTPS JSON   ┌──────────────────────────────┐    ┌──────────────┐
│ React 19 + MUI 9 PWA         │ ─────────────► │ Express 5 API  (/api/v1)     │ ─► │ PostgreSQL 16│
│ TanStack Query, i18next      │ ◄───────────── │ zod validation, Sequelize 6  │    └──────────────┘
│ IndexedDB offline queue      │                │ JWT + rotating refresh tokens│    ┌──────────────┐
│ Service worker (app shell)   │ ── photos ───► │ sharp (re-encode, strip EXIF)│ ─► │ S3 (private) │
└──────────────────────────────┘                └──────────────────────────────┘    │ or local disk│
                                                                                    └──────────────┘
```

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 22 LTS | Long support window, built-in `fetch`, fast startup on small servers |
| API | Express 5 | Async errors handled natively; tiny, well known |
| Validation | zod 4 | One schema = parsing + error codes per field |
| Database | PostgreSQL 16 + Sequelize 6, plain SQL migrations (umzug) | Relational data with strong constraints; migrations are reviewable SQL, never `sync()` |
| Auth | Short-lived JWT access token (15 min, HS256 pinned) + opaque refresh token (30 days, stored hashed, rotated, reuse detection) | Works offline-ish on phones without long-lived bearer tokens |
| Files | Private S3 with signed URLs, or local disk with HMAC-signed expiring links | Children's photos are never public |
| Web | React 19, MUI 9, React Router 7, TanStack Query 5, react-hook-form + zod, i18next, Vite 8 + PWA plugin | Mainstream, accessible components, small bundles per screen |

## Back-end layout

```
src/
  app.js             express app: helmet, CORS, request id, logging, rate limit, /health, /files, /api/v1
  routes.js          mounts every module; everything after auth runs as one member of one school
  config/            env (validated), db, permissions.js (the single permission matrix)
  db/migrations/     NNNN-name.up.sql / .down.sql
  db/models/         people, structure, students, records + associations in index.js
  middlewares/       authenticate, schoolScope (X-School-Id), yearScope (X-Academic-Year), requirePerm, validate, upload, errorHandler
  modules/<feature>/ <feature>.routes.js (+ .service.js for logic)
  utils/             errors (stable codes), scope (findInSchool, teacher checks, closed years), dates (school timezone), audit, storage
scripts/             migrate, seed (dev only), create-owner
tests/               jest + supertest against a real Postgres
```

Feature modules: `auth`, `schools`, `users` (staff + teacher assignments), `structure` (class levels, classes, subjects,
activities), `years` (academic years + rollover), `students` (+ import/export), `attendance` (+ holidays, register),
`diary`, `syllabus`, `marks` (+ report cards), `health`, `dashboard` (+ teacher home, audit log).

## Request pipeline

1. `X-Request-Id` (validated) → log line per request (pino).
2. Per-IP rate limit on `/api/v1` (600/min) and stricter limits on login (20 / 15 min) and refresh.
3. `authenticate` — verifies the JWT and that the user is still active and the token version matches (password change,
   reset and deactivation end every session immediately).
4. `schoolScope` — picks the school from `X-School-Id` among the user's memberships (default school otherwise) and sets
   `req.role` for that school.
5. `yearScope` (where needed) — academic year from `X-Academic-Year`, default the active one.
6. `requirePerm('…')` — role check from `config/permissions.js`.
7. Handler — loads every record with `findInSchool` (404 for other schools' ids, so existence never leaks), checks
   teacher assignment for writes (`assertSectionWrite`) and closed years (`assertYearWritable`).
8. Errors → `{ error: { code, message, fields, params, requestId } }`. The web app translates `code`.

## Data model

```
organizations ─< schools ─< user_schools >─ users ─< refresh_tokens
                    │
                    ├─< academic_years ─< class_sections ─< subjects ─< chapters ─< topics ─ topic_completions
                    │          │               │                │
                    │          │               └─< teacher_assignments (user, section, subject?, class/subject teacher)
                    ├─< grades (class levels, next level, final)
                    ├─< students ─< enrollments (one per year: section, roll no, status, previous enrollment)
                    │       ├─< attendance (one per child per day)        attendance_sessions (per class per day, counts)
                    │       ├─< daily_logs (child diary)                   class_daily_logs (class diary)
                    │       ├─< report_entries (subject × term)            health_checks
                    ├─< holidays, activity_groups ─< activity_members
                    └─< audit_logs, rollover_runs (idempotency)
```

Key decisions:

- **Student vs. enrollment.** A child is created once (`students`, permanent: GR number, family, photo). Each academic year
  gets an `enrollment` (class, roll number, status). Promotion creates the next enrollment and links the previous one,
  so history and attendance stay attached to the right year.
- **Class level vs. class.** `grades` are permanent levels (Balwadi, Std 1 … with "next level"); `class_sections` are the
  classes of one year (Std 1 A in 2026-27). Ordering everywhere is level order, then section.
- **Never delete children.** Leaving sets status, date, reason and destination school; re-admission is one click.
- **Approximate age.** `dob_is_approximate` + `estimated_birth_year` for children without documents.
- **Aadhaar** is never stored in full — only the last 4 digits, for matching.
- **Tenancy.** Every table carries `school_id`; queries always filter by the request's school. Users belong to one
  organization; a teacher in two schools of the same trust has two memberships.
- **Concurrency.** GR numbers are allocated with an atomic `UPDATE … RETURNING`; attendance upserts keep the newest
  `marked_at` (offline saves never overwrite newer marks); rollover runs once per idempotency key.

## Academic years

`planned → active → closed`. Exactly one active year per school (partial unique index). Closed years are read-only for
everyone until an admin unlocks them for 5–240 minutes with a reason. The rollover wizard builds a plan (`/preview`, no
writes), the admin edits it, then `/rollover` applies it in one transaction.

## Offline & performance (web)

- Service worker precaches the app shell and fonts; selected GET endpoints use network-first with a 5 s timeout.
- Attendance saved without network goes to IndexedDB and is uploaded on reconnect / every minute. Temporary errors keep
  the item; refusals are shown to the teacher. Logout clears the queue and the API cache.
- Every screen is a lazy chunk; photos are compressed on the phone; lists paginate.

## Languages

- UI: i18next with `en`, `hi`, `mr`, `gu` JSON files. ESLint forbids literal text in JSX; a unit test fails if a language
  misses a key or a `{{placeholder}}`. Plurals use `_one` / `_other`.
- Server messages: stable error **codes**, translated in the app (`errors.*`, `fieldErrors.*`).
- Data: class levels, subjects and activities have optional `name_translations`. Children's and people's names are never
  machine-translated.
- Dates: dayjs locale follows the app language; printing uses the browser so Devanagari and Gujarati render correctly.
- WhatsApp messages to families use the **guardian's** language saved on the child.

## Adding a feature

1. SQL migration pair in `src/db/migrations` (after v1 is live, never edit `0001-init`).
2. Model in `src/db/models/*.js`, associations in `index.js`.
3. `src/modules/<name>/<name>.routes.js`; add the name to `src/routes.js`.
4. Permission in `src/config/permissions.js` **and** the web app's `shared/utils/permissions.js`.
5. New error codes in `src/utils/errors.js` and the four locale files.
6. Tests in `tests/`. The scope-matrix test automatically checks every new route for login and cross-school isolation.
