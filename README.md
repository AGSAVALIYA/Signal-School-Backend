# Signal School API new

Express 5 + Sequelize + PostgreSQL. Feature modules under `src/modules/*`, all mounted at `/api/v1`.

## Run
```bash
cp .env.example .env            # set DATABASE_URL, JWT_SECRET
npm ci
npm run db:migrate              # SQL migrations in src/db/migrations
npm run db:seed                 # optional demo data (password: password123)
npm run create-owner -- --org "Trust" --school "School" --name "Owner" --email owner@example.org
npm run dev
```
Tests need a Postgres database (`TEST_DATABASE_URL`, default `postgres://postgres:postgres@localhost:5432/signal_test`): `npm test`.

## Structure
| Path | Purpose |
|---|---|
| `src/config` | env validation, DB, permission matrix (`permissions.js`) |
| `src/db/migrations` | `NNNN-name.up.sql` / `.down.sql` pairs (never `sync`) |
| `src/db/models` | models; associations only in `models/index.js` |
| `src/middlewares` | `authenticate`, `schoolScope` (X-School-Id), `yearScope` (X-Academic-Year), `requirePerm`, `validate` (zod), uploads, errors |
| `src/modules/<feature>` | routes (+ service for logic): auth, schools, users, structure, years (rollover), students (import/export), attendance, diary, syllabus, marks, dashboard |
| `src/utils` | errors (stable codes), scope checks, dates (school timezone), audit, storage (S3 or local) |
| `scripts` | migrate, seed, create-owner, `migrate-legacy` (v1 → v2 data, dry run by default) |

## Adding a feature
1. SQL migration pair in `src/db/migrations`.
2. Model in `src/db/models/*.js`, associations in `index.js`.
3. `src/modules/<name>/<name>.routes.js`, register the name in `src/routes.js`.
4. Permission key in `src/config/permissions.js`; error codes in `src/utils/errors.js` (+ frontend `errors.json`).
5. Tests in `tests/`. The scope-matrix test checks every new route for login and cross-school isolation automatically.

## Upgrading from v1
Back up the database, run `npm run db:migrate`, then `npm run migrate-legacy` (dry run, review `legacy-migration-*/`), then `npm run migrate-legacy -- --apply`. Legacy tables are left untouched.
