# Changelog

All notable changes to the Signal School API. Dates are release dates; the format follows
[Keep a Changelog](https://keepachangelog.com/) and versions follow [Semantic Versioning](https://semver.org/).

## Unreleased

### Added
- `npm run db:seed:qa` / `npm run stack -- qa`: the demo plus fixed children and logins (`scripts/demo/qa.js`) that the
  web app's manual QA pack refers to; today is always a school day.
- `S3_ENDPOINT` for Cloudflare R2 and other S3-compatible storage. Docker Compose can use an outside database and
  Redis (`EXTERNAL_DATABASE_URL`, `EXTERNAL_REDIS_URL`).
- School look (`schools.theme`, migration `0003-school-theme`): set with `PATCH /school { theme }` by the principal,
  returned per school by `/me`; the web app has six looks with Signal Shala as the default.
- Demo seed rebuilt as a working Signal Shala: two schools, three academic years with promotions, detentions, children
  who joined mid-year, moved away or finished school, drawn faces (`scripts/demo/avatars.js`, never real photos),
  attendance for every school day with holidays, syllabus progress, marks, health check-ups, diary notes, activity
  groups and an activity log. Deterministic, ~15 s. New logins `principal@demo.test` and `imran@demo.test`.
- Faces in the dashboard's absence-streak and low-attendance lists and in today's absentees (`thumbUrl`).
- `scripts/loadtest.js`: a school-morning load test (logins, attendance, lists, dashboard) with rising users.
- `WEB_CONCURRENCY` (number or `auto`): several API processes sharing Redis; Docker Compose runs 2.
- `GET /students/possible-duplicates` — similar name or same guardian phone, so returning children are re-admitted (#3).
- Dashboard `consecutiveAbsences`: children absent on their latest 3+ marked school days (#4).
- `GET /students/:id/attendance?month=YYYY-MM` — one child's month with holidays and totals (#5).
- `GET /audit?areas=` filter by area of the app.
- `AGENTS.md`, `CONTRIBUTING.md`, screenshots in the docs (#6).
- Seed data: guardian languages and an absence streak per class for demos.
- Docker: `Dockerfile`, `docker-compose.yml` (Postgres, Redis, API, web) and `npm run stack`, which clones the web
  app, creates secrets, builds and starts everything; `demo`, `owner`, `thumbnails`, `logs`, `down` sub-commands.
  CI starts the whole stack on every push.
- Photo thumbnails (160 px) made at upload, replacing the old Lambda-filled thumbnail bucket; lists return
  `thumbUrl`; `npm run thumbnails` backfills older photos.
- Optional Redis (`REDIS_URL`): shared rate limits and a response cache for dashboard, today, class list, syllabus
  progress and today's absentees, invalidated by every write in the school (`CACHE_TTL`, default 60 s).
  `/health` reports `redis`.
- Gzip compression; `API_RATE_LIMIT`; load-test tooling (`npm run db:seed:perf`, `scripts/bench.js`) and
  [docs/performance.md](docs/performance.md).

### Security
- `proxy-addr` 2.0.8 (critical: IP spoofing through IPv4-mapped IPv6 trust subnets, via Express).
- Migrations run by a small built-in runner instead of umzug, removing its command-line dependency tree (`argparse`
  1 → `sprintf-js`, a moderate advisory with no fixed version); the `schema_migrations` table is unchanged. The same
  advisory in the test tooling is closed with an override to `js-yaml` 4. `npm audit`: 0 vulnerabilities.

### Changed
- Load test fixes (`docs/performance.md`): 216 → 333 requests/s in one process, ~430 with two; 40 simultaneous logins
  4.2 → 1.4 s. Passwords use scrypt on the thread pool (bcrypt hashes upgraded at login); user, school and year
  lookups are cached 5 s per process; the JWT key and date formatter are made once; the dashboard's low-attendance
  list counts from a covering index (migration `0004-attendance-cover`, 34 → 9 ms).
- API image ~370 → ~210 MB on disk (100 → 70 MB to download): Node without npm/yarn/corepack, pruned production
  dependencies, Alpine security updates, layer and npm caches for fast rebuilds. Compose runs the API read-only with
  no capabilities, `no-new-privileges` and `init`; the web container runs nginx unprivileged on port 8080.
- Student list is a single SQL query with lean rows (p50 90 → 34 ms, 38 KB → 2.3 KB for 50 children); dashboard
  69 ms → 19 ms with the cache. Faster absence streaks, report cards and history; new indexes (migration 0002).
- Excel import and the new-year rollover use bulk statements: 1,200-row import 2.0 s → 0.2 s, rollover of a
  1,200-child school (2,400 enrollments) 46 s → 0.9 s. The per-class promotion screen uses the same code.
- Attendance sheet and register read in parallel with plain rows; `DB_POOL_MAX` sets the connection pool.
- `npm run dev` uses `node --watch` instead of nodemon (unpatched advisory in its `braces` dependency).

### Fixed
- Clerks could not admit children, edit them or add photos (refused by the teacher class check).
- Student list: the status filter was ignored within a year, the order ignored class level, and `%`/`_` in a search
  matched every child.

## 1.0.0

First release for Signal School.

### Added
- Schools and trusts with roles (owner, admin, clerk, teacher) and per-school permissions.
- Students with yearly enrollments, GR numbers, approximate age, Excel import/export, leaving and re-admission with destination school.
- One-call attendance per class with offline-safe "newest mark wins", edit window, holidays and weekly offs, monthly register.
- Diary notes with photos, syllabus with "taught" ticks, marks and report cards, health check-ups with follow-ups.
- Academic years with a rollover wizard (copy classes, subjects, syllabus, teachers; promote/detain/leave/graduate), read-only past years and timed unlock.
- Principal dashboard, teacher home, activity log.

### Security
- JWT pinned to HS256, rotating refresh tokens with reuse detection, constant-time login, lockout and rate limits.
- Private files via S3 signed URLs or HMAC-signed local links; images re-encoded; strict tenant scoping tested on every route.
