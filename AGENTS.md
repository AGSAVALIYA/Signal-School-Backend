# AGENTS.md — working in Signal-School-Backend

Brief for anyone (human or AI coding agent) changing this repository. Read this first; details live in `docs/`.

## What this is
REST API (`/api/v1`) for Signal School: student management for schools teaching under-privileged, often migrant,
children. Users are mostly non-technical teachers on cheap phones. The web app is the sibling repo
**Signal-School-Frontend** (React). Version 1.x, Node 22, Express 5, PostgreSQL 16, Sequelize 6, zod 4, Jest.

## Commands
```bash
npm ci
cp .env.example .env                  # DATABASE_URL + JWT_SECRET (16+ chars; 32+ in production)
npm run db:migrate                    # apply SQL migrations
npm run db:seed                       # demo data — WIPES the target database; refuses NODE_ENV=production
npm run dev                           # http://localhost:3000/health  (for web e2e runs: LOGIN_RATE_LIMIT=1000)
npm test                              # Jest; needs Postgres at TEST_DATABASE_URL
                                      # (default postgres://postgres:postgres@localhost:5432/signal_test; schema is dropped & recreated)
npm run lint && npm run format:check  # ESLint 10 flat config + Prettier
npm audit --audit-level=moderate      # must stay at 0
npm run stack                         # whole app in Docker (db, redis, api, web on :8080); `-- demo` loads demo data
npm run db:seed:perf && node scripts/bench.js   # 1,200-child load test (see docs/performance.md)
npm run thumbnails                    # create missing list thumbnails for existing photos
```
Postgres for tests: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=signal_test postgres:16`.
Demo logins after seeding (password `password123`): `owner@demo.test`, `clerk@demo.test`, `sunita@demo.test`, `rahul@demo.test`.

## Map
| Path | What |
|---|---|
| `src/app.js` | Express app: helmet, CORS, request id, pino, rate limit, `/health`, signed `/files`, `/api/v1` |
| `src/routes.js` | Mounts modules. Everything after `auth` runs through `authenticate` + `schoolScope` |
| `src/config/permissions.js` | **The** role → permission matrix (mirrored in the web app's `shared/utils/permissions.js`) |
| `src/modules/<feature>/` | `<feature>.routes.js` (+ `.service.js`): auth, schools, users, structure, years, students, attendance, diary, syllabus, marks, health, dashboard |
| `src/db/migrations/` | `NNNN-name.up.sql` / `.down.sql`. Never use `sequelize.sync()` |
| `src/db/models/` | Model definitions; associations only in `models/index.js` |
| `src/utils/` | `errors` (codes), `scope` (tenant/teacher/closed-year checks), `dates` (school timezone), `audit`, `storage` (photos + thumbnails), `cache` (response cache, Redis, rate-limit store) |
| `Dockerfile`, `docker-compose.yml`, `scripts/stack.sh` | API image; full stack (Postgres, Redis, API, web via nginx); the script clones the web app into `.stack/frontend` |
| `tests/` | API tests; `helpers.js` → `makeSchool()` builds a full school; `security.test.js` auto-tests every route |
| `docs/` | user stories, user guide, architecture, API, security, testing, deployment |

## Invariants — do not break
1. **Tenant isolation.** Every query is filtered by `req.school.id`. Load records with `findInSchool(Model, id, req)` so
   other schools' ids return **404** (not 403). Raw SQL must include `school_id = :s` (or join through a scoped row).
2. **Permissions.** Gate writes with `requirePerm('area.action')`; teachers also need `assertSectionWrite(req, sectionId, subjectId?)`.
3. **Closed academic years are read-only**: call `assertYearWritable(year)` before writing year-scoped data.
4. **Errors are codes**, never prose: `throw badRequest('CODE')` / `new AppError(status, 'CODE')`. A new code needs an
   English message in `src/utils/errors.js` **and** translations in the web app's 4 locale files.
5. **Validate input with zod** via `validate({ body, query, params })`; read parsed values from `req.v.*` (Express 5 `req.query` is read-only).
6. **Never hard-delete children**; leaving/readmission change status. Never store full Aadhaar (last 4 digits only).
7. **Dates** are `YYYY-MM-DD` in the school's timezone: use `todayIn(req.school.timezone)`, not `new Date()`.
8. **Audit** meaningful changes: `await audit(req, 'area.verb', { entityType, entityId, summary })` (never throws).
9. Files: `storage.saveImage()` (re-encodes, strips EXIF); return URLs with `storage.urlFor(key)` — never public paths.
   Photos shown as avatars are saved with `{ thumb: true }`; lists return `thumbUrl` (`storage.thumbUrlFor`), not `photoUrl`.
10. Until v1 is deployed for real, schema changes may edit `0001-init.up.sql`; after that, **add a new migration pair**.
11. **Cached reads** (`cacheResponse(name)` after `yearScope`) are invalidated by any successful write request in the same
    school. A cached route whose data can change in another way (another school, a background job, a non-HTTP write)
    must not be cached, or needs `{ perUser: true }` when the answer depends on who asks.
12. Lists that can grow (students, attendance) are plain SQL returning lean rows; don't load model trees per row.

## Adding an endpoint (checklist)
- [ ] Route in the module's `*.routes.js` (static paths like `/students/possible-duplicates` **before** `/students/:id`).
- [ ] `requirePerm`, zod `validate`, `findInSchool`, teacher/closed-year checks as needed.
- [ ] Permission key added to both permission files if new.
- [ ] Test in `tests/` using `makeSchool()`; if the route uses a new kind of id, add its prefix to `fill()` in `security.test.js`.
- [ ] Document it in `docs/api.md`; user-visible behaviour in `docs/user-stories.md` / `docs/user-guide.md`.
- [ ] `npm run lint && npm run format:check && npm test` green; `CHANGELOG.md` entry.

## Definition of done
Lint, format, tests and audit green; docs updated; no secrets or real children's data committed; commit message says
why, and references the issue (`Fixes #n`).

## Gotchas
- Sequelize `replacements` in raw SQL: in JS template literals write regex backslashes as `\\D`.
- `pg_trgm` and `citext` extensions are created by the first migration (similarity search, case-insensitive email).
- Jest runs in band against one database; tests in a file share state from `beforeAll` — keep them order-independent where possible.
- `trust proxy` is 1: rate limits assume exactly one reverse proxy in front (the web container's nginx in Docker).
- The response cache is off in tests (`CACHE_TTL=0`) except `tests/cache.test.js`; check `X-Cache` headers when debugging stale data.
- `npm run dev` uses `node --watch` (no nodemon).
