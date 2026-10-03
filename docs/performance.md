# Performance

Target users are on cheap phones with patchy mobile data, and the server is a small NGO machine. So the goals are
small responses, few round trips, and nothing that slows down as years of attendance pile up.

## How it was measured

```bash
createdb signal_perf
DATABASE_URL=postgres://…/signal_perf npm run db:migrate
DATABASE_URL=postgres://…/signal_perf npm run db:seed:perf     # wipes it: 1 school, 24 classes, 1,200 children,
                                                               # two years of attendance (~470,000 marks), marks, diary
# start the API with NODE_ENV=production and API_RATE_LIMIT / LOGIN_RATE_LIMIT raised, then:
BENCH_URL=http://localhost:3000 node scripts/bench.js 5        # autocannon, 10 parallel clients, 5 s per endpoint
```

Logins: `owner@perf.test` / `teacher@perf.test`, password `password123`. Slow queries were found with
`log_min_duration_statement`, `EXPLAIN ANALYZE` and `node --cpu-prof`.

## Results (median latency at 10 parallel clients, one API process)

| Endpoint | Before | After query fixes | With cache | Bytes per response before → after |
|---|---:|---:|---:|---:|
| Student list (50 children) | 90 ms | 34 ms | — | 38,120 → 2,262 |
| Student search | 89 ms | 26 ms | — | 38,163 → 2,300 |
| Student history | 83 ms | 18 ms | — | 1,062 → 1,485 |
| Report card | 99 ms | 26 ms | — | 675 → 1,777 |
| Attendance sheet | 57 ms | 43 ms | — | 7,188 → 2,019 |
| Monthly register | 59 ms | 43 ms | — | 37,150 → 2,493 |
| Today's absentees | 35 ms | 22 ms | 20 ms | 16,123 → 1,445 |
| Principal dashboard | 209 ms | 69 ms | **19 ms** | 19,108 → 1,940 |
| Teacher home | 32 ms | 23 ms | 17 ms | 3,245 → 1,482 |
| Syllabus progress | 26 ms | 21 ms | 17 ms | 13,421 → 2,059 |
| Class list | 53 ms | 42 ms | **17 ms** | 14,407 → 2,154 |

"Before" bytes are the uncompressed JSON body; "after" bytes are everything read from the socket, headers (~1.2 KB of
security headers) included, with gzip. Small responses grow slightly because of the headers; they were below the 1 KB
compression threshold before as well.

## Writes that touch a whole school

| Operation (1,200-child school) | Before | After |
|---|---:|---:|
| Excel import, 1,200 rows | 1,985 ms | 213 ms |
| New-year rollover, 2,400 enrollments (promote + graduate) | **45,729 ms** | 870 ms |

The rollover ran ~7 queries per child inside one transaction; at 45 s it could time out behind a proxy. Promotions are
now a few set-based statements per 1,000 children (`applyPromotions` in `src/modules/years/rollover.service.js`), and
the import inserts all children, then all enrollments, in two statements after one duplicate-GR check. Measure with
`npm run db:seed:perf`, then time `POST /students-import` and `POST /academic-years/rollover`.

## Bottlenecks found and what changed

| Problem | Fix |
|---|---|
| No compression: a 50-child list was 38 KB on mobile data | `compression` for responses over 1 KB (~90% smaller) |
| Student list built two Sequelize queries with nested model objects (≈ 15 ms of CPU for 50 rows) | One SQL query with `count(*) OVER()`, plain rows, lean DTO; ordered like the register (class level → class → roll number) |
| List avatars downloaded every child's full 1024 px photo (~150 KB each) | 160 px thumbnails created at upload (~6 KB), lazy-loaded |
| Absence streaks scanned all of the year's attendance (49 ms) | Start from children absent in the last 7 days, count back to their last non-absent mark (6 ms) |
| Report card and history loaded every attendance row into Node to count it | `count(*) FILTER (…)` in SQL, per enrollment |
| Missing indexes for attendance by enrollment, recent absences, enrollments by year/status, subjects by year, report entries, health checks | Migration `0002-performance` |
| Dashboard and class list are read on every screen change by principals and every teacher | Response cache (below) |
| Monthly register built ~1,300 model objects per class; sheet and register ran their queries one after another | Plain rows, independent queries in parallel (`DB_POOL_MAX`, default 10) |
| Import and rollover: queries per child | Bulk statements (above) |

The remaining floor (~17 ms at 10 parallel clients, ~550 requests/s) is authentication (token check + one user
lookup), school/year resolution and JSON/gzip. That is far above what a school needs (a 40-teacher school
taking attendance at 9 a.m. produces a few requests per second).

## Response cache and Redis

`src/utils/cache.js`. Cached: `/dashboard`, `/today` (per user), `/sections`, `/syllabus/progress`, `/attendance/today`.

- Key: school, **school version**, year, school-local date, URL (and user for `/today`).
- Every successful `POST/PUT/PATCH/DELETE` in a school increments its version **before the response is sent**, so the
  app's refetch after a save never sees the old answer. `CACHE_TTL` (default 60 s) bounds anything else (e.g. a
  teacher renaming themself, which is shown in other schools).
- Without `REDIS_URL` the cache lives in the API process (right for one server). With `REDIS_URL` it is shared, and
  so are the rate-limit counters, which is required when running more than one API container.
- Redis down → the API answers from the database (no cache), rate limits let requests through, `/health` reports
  `"redis": "down"`. Requests never wait for Redis to come back.
- After restoring a database backup, run `redis-cli FLUSHDB` (or wait `CACHE_TTL` seconds).

Adding a cached route: put `cacheResponse('name')` after `yearScope`, use `{ perUser: true }` if the answer depends on
who asks, and make sure everything that changes its data is a write request in the same school.

## Web app

Measured on the production build (`vite build` + `vite preview`) with Chrome's CPU slowed down 4× to resemble a cheap
Android phone, on the 1,200-child data:

| What | Before | After |
|---|---:|---:|
| JavaScript before the first screen (gzip) | 313 KB | 244 KB |
| Offline cache downloaded on first visit | 2.0 MB | 1.4 MB |
| One tap on P / A / L (50-child class) | 141 ms (p90 263) | 16 ms (p90 33) |
| One keystroke in the marks grid (50 children, phone) | 188 ms (p90 409) | 17 ms (p90 19) |
| Changing one child's decision in the new-year wizard (1,200 children) | **5,500 ms** | 138 ms |

- **Languages:** only English is in the main bundle; हिंदी / मराठी / ગુજરાતી are separate chunks loaded when chosen (or for a
  guardian's WhatsApp message) and precached for offline use. The app renders after the chosen language has loaded, so
  there is no English flash.
- **Form libraries** (zod, react-hook-form) load with the screens that have forms, not for the login page.
- **Fonts:** only Latin, Devanagari and Gujarati subsets (no Cyrillic/Greek/Vietnamese, no duplicate Latin), cached on
  first use instead of all being precached.
- **Lists with one control per child** (attendance, marks, rollover) render each child as a memoised row with stable
  callbacks, so a change re-renders one row instead of the whole class or school.
- **Student list and activity log** keep the current rows on screen while "show more", a search or the next page loads.

## Thumbnails

The old app pointed list avatars at a second S3 bucket (`…-thumbnails`) filled by an AWS Lambda. v1 makes them in the
API: `storage.saveImage(buffer, folder, { thumb: true })` stores `<key>.thumb.jpg` (160 × 160, cropped around the most detailed part of the picture) next to
the photo, `storage.remove()` deletes both, and lists return `thumbUrl`. Photos uploaded earlier get thumbnails with
`npm run thumbnails` (safe to repeat).
