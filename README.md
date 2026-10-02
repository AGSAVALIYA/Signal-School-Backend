# Signal School API (v1)

Student management for schools that teach under-privileged children — attendance in a few taps (even offline),
student records with history across years, syllabus, marks, health check-ups, leaving certificates, and a principal's
dashboard, in English, हिंदी, मराठी and ગુજરાતી. Web app: **Signal-School-Frontend**.

Node.js 22 · Express 5 · PostgreSQL 16 (Sequelize, SQL migrations) · zod · JWT with rotating refresh tokens.

## Screenshots

| Teacher's phone: attendance, one tap per child | Same app in Marathi | Login with language choice |
|---|---|---|
| <img src="docs/screenshots/phone-take-attendance.png" width="240" alt="Attendance sheet on a phone with P, A, L buttons for each child"> | <img src="docs/screenshots/phone-teacher-today-marathi.png" width="240" alt="Teacher home screen in Marathi"> | <img src="docs/screenshots/phone-login.png" width="240" alt="Login screen with English, Hindi, Marathi and Gujarati buttons"> |

| Principal's dashboard | Child's profile | New academic year wizard |
|---|---|---|
| <img src="docs/screenshots/desktop-dashboard.png" width="320" alt="Dashboard with children absent several days in a row"> | <img src="docs/screenshots/desktop-student-profile.png" width="320" alt="Student profile with tabs"> | <img src="docs/screenshots/desktop-new-year-wizard.png" width="320" alt="Five-step new academic year wizard"> |

Screenshots use demo data (`npm run db:seed`) and are regenerated with `npm run screenshots` in the web repo.

## Run locally

```bash
cp .env.example .env            # set DATABASE_URL and JWT_SECRET
npm ci
npm run db:migrate              # SQL migrations in src/db/migrations
npm run db:seed                 # demo data, wipes the database (password: password123)
npm run dev                     # http://localhost:3000/health
```

Demo logins after seeding: `owner@demo.test`, `clerk@demo.test`, `sunita@demo.test` (class teacher), `rahul@demo.test`.

Real school: `npm run create-owner -- --org "Trust" --school "School" --name "Owner" --phone 98XXXXXXXX`.

## Checks

```bash
npm run lint && npm run format:check
npm test          # needs Postgres: TEST_DATABASE_URL (default postgres://postgres:postgres@localhost:5432/signal_test)
npm audit
```

## Documentation

New here (human or AI agent)? Start with [AGENTS.md](AGENTS.md), then [CONTRIBUTING.md](CONTRIBUTING.md).

See [`docs/`](docs/README.md): user stories, user guide, architecture, API reference, security, testing strategy,
deployment.

| Path | Purpose |
|---|---|
| `src/config` | env validation, DB, permission matrix (`permissions.js`) |
| `src/db/migrations` | `NNNN-name.up.sql` / `.down.sql` pairs (never `sync`) |
| `src/db/models` | models; associations only in `models/index.js` |
| `src/middlewares` | `authenticate`, `schoolScope` (X-School-Id), `yearScope` (X-Academic-Year), `requirePerm`, `validate` (zod), uploads, errors |
| `src/modules/<feature>` | routes (+ service): auth, schools, users, structure, years, students, attendance, diary, syllabus, marks, health, dashboard |
| `src/utils` | errors (stable codes), scope checks, dates (school timezone), audit, storage (S3 or signed local files) |
| `scripts` | migrate, seed (dev only), create-owner |
| `tests` | Jest + supertest against Postgres, incl. an automatic cross-school scope matrix |
