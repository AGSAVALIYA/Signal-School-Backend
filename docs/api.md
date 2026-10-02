# API reference (v1)

Base URL: `/api/v1`. JSON in and out. Every response is `{ data, meta? }` or `{ error }`.

## Conventions

| Header | Meaning |
|---|---|
| `Authorization: Bearer <accessToken>` | Required on everything except `/auth/*` |
| `X-School-Id` | School to act in (must be one of the user's schools; default school otherwise) |
| `X-Academic-Year` | Year to read (default: the active year). Writes to closed years are refused with `423 YEAR_CLOSED` |
| `X-Request-Id` | Optional, `[\w.-]{1,64}`; echoed back and logged |

- Ids of another school always answer **404** (never 403), so existence does not leak.
- Lists accept `page` and `pageSize` (max 100) where noted and return `meta.total`.
- Dates are `YYYY-MM-DD` in the school's timezone (default Asia/Kolkata).
- Rate limits: 600 requests/min per IP overall; login 20 / 15 min; refresh 120 / 15 min → `429 RATE_LIMITED`.

### Errors

```json
{ "error": { "code": "VALIDATION", "message": "Some fields are invalid", "fields": { "guardianPhone": "INVALID_FORMAT" }, "requestId": "…" } }
```

| Code | HTTP | When |
|---|---|---|
| `VALIDATION` | 400 | Body/query invalid; `fields` maps field → reason code (`REQUIRED`, `INVALID_FORMAT`, `TOO_BIG`, `MORE_THAN_MAX`, …) |
| `UNAUTHENTICATED`, `SESSION_EXPIRED` | 401 | No/invalid token; expired or revoked session |
| `INVALID_CREDENTIALS` | 401 | Wrong login or password (same answer for unknown users) |
| `ACCOUNT_INACTIVE` | 403 | Deactivated user |
| `ACCOUNT_LOCKED`, `RATE_LIMITED` | 429 | Too many attempts |
| `FORBIDDEN`, `NO_SCHOOL` | 403 | Role not allowed / not assigned to this class / no school |
| `NOT_FOUND` | 404 | Missing or another school's record |
| `DUPLICATE`, `GR_DUPLICATE`, `IN_USE`, `YEAR_OVERLAP`, `YEAR_HAS_DATA`, `TOPIC_HAS_COMPLETION`, `NO_ACTIVE_YEAR` | 409 | Conflicts |
| `YEAR_CLOSED`, `ATTENDANCE_LOCKED` | 423 | Read-only year / date older than the edit window |
| `DATE_IN_FUTURE`, `DATE_OUTSIDE_YEAR`, `ROLLOVER_INVALID`, `WRONG_PASSWORD`, `FILE_TYPE` | 400 | |
| `FILE_TOO_LARGE` | 413 | Photo > 8 MB, sheet > 5 MB |
| `INTERNAL` | 500 | Logged with the request id |

## Roles

`owner` (trust), `admin` (principal), `clerk` (office), `teacher`. The full matrix is in
[`src/config/permissions.js`](../src/config/permissions.js). Teachers additionally write only to classes/subjects
assigned to them; owners and admins bypass assignment checks.

## Endpoints

"Any" = any logged-in member of the school.

### Auth & profile
| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/auth/login` | public | `{ identifier (mobile or email), password }` → tokens + profile |
| POST | `/auth/refresh` | public | `{ refreshToken }` → new pair; old token revoked; replay after 60 s revokes all sessions |
| POST | `/auth/logout` | public | `{ refreshToken }` |
| GET / PATCH | `/me` | any | name, `preferredLanguage` (`en`/`hi`/`mr`/`gu`) |
| POST | `/me/password` | any | returns a fresh token pair; other sessions end |
| POST | `/me/photo` | any | multipart `photo` |
| PUT | `/me/default-school` | any | |

### Organization & school
| Method | Path | Who |
|---|---|---|
| GET | `/organization`, `/school`, `/schools` | any |
| PATCH | `/organization`; GET `/organization/summary`; POST `/schools` | owner |
| PATCH | `/school`; POST `/school/logo` | owner, admin |

### Staff & assignments
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/users` | any | `role`, `status`, `q`. Teachers get names only |
| POST | `/users` | owner, admin | returns `tempPassword` once (null when an existing trust user is linked) |
| PATCH | `/users/:id` | owner, admin | only owners grant or change owners |
| POST | `/users/:id/reset-password`, `/activate`, `/deactivate` | owner, admin | |
| GET | `/users/:id/activity` | owner, admin | paginated |
| GET | `/assignments` | any | `userId`, `classSectionId` |
| POST / DELETE | `/assignments`, `/assignments/:id` | owner, admin | one class teacher per class |

### Structure
| Method | Path | Who |
|---|---|---|
| GET | `/grades`, `/sections`, `/activities`, `/activities/:id/members` | any |
| POST, PATCH, DELETE | `/grades…`, `PUT /grades/order`, `/sections…`, `/subjects…`, `/activities…`, `PUT /activities/:id/members` | owner, admin |

### Academic years
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/academic-years` | any | with section and student counts |
| POST / PATCH / DELETE | `/academic-years[/:id]` | owner, admin | first year becomes active; delete only empty planned years |
| POST | `/academic-years/:id/activate`, `/close`, `/unlock` | owner, admin | unlock `{ minutes 5–240, reason }` |
| POST | `/academic-years/rollover/preview` | owner, admin | plan only, no writes |
| POST | `/academic-years/rollover` | owner, admin | `{ idempotencyKey, plan }`, single transaction |
| POST | `/academic-years/:id/promotions` | owner, admin | late promotions |

### Students
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/students` | any | `sectionId`, `q`, `status`, `allYears`, paging; includes today's attendance |
| POST | `/students` | teacher (own class), clerk, admin, owner | GR auto if empty |
| GET | `/students/:id`, `/students/:id/history` | any | |
| PATCH | `/students/:id` | as POST | |
| POST | `/students/:id/photo` | as POST | |
| POST | `/students/:id/leave` | clerk, admin, owner | `{ date, reason, note?, toSchool? }` |
| POST | `/students/:id/readmit` | clerk, admin, owner | `{ classSectionId }` |
| GET | `/students-import/template`; POST `/students-import/preview` (multipart `file`), `/students-import` | clerk, admin, owner | up to 2000 rows |
| GET | `/students-export` | any (web app shows it to office roles) | Excel |

### Attendance & holidays
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/attendance/sections/:sectionId/:date` | any | sheet + `editable` / `lockReason` |
| PUT | `/attendance/sections/:sectionId/:date` | teacher (own class), admin, owner | `{ rows: [{studentId, status P/A/L/LATE, remark?}], clientMarkedAt? }`; newest mark wins |
| GET | `/attendance/today` | any | per-class status + absentees with guardian phone & language |
| GET | `/attendance/register` | any | `sectionId`, `month=YYYY-MM`, `format=json|xlsx` |
| GET | `/holidays?from&to`; POST, DELETE | any; owner, admin | |

### Diary, syllabus, marks, health, dashboard
| Method | Path | Who |
|---|---|---|
| PUT | `/diary/students/:id/:date`, `/diary/sections/:id/:date` (multipart `note`, `subjectIds`, `photo?`, `removePhoto?`) | teacher (own class), admin, owner |
| GET | `/diary/students/:id`, `/diary/sections/:id?from&to` | any |
| DELETE | `/diary/entries/:kind/:id` | author, admin, owner |
| GET | `/syllabus/subjects/:id`, `/syllabus/progress` | any |
| PUT | `/syllabus/subjects/:id` (whole tree; ids keep ticks) | owner, admin |
| POST / DELETE | `/syllabus/topics/:id/complete` | teacher (own subject), admin, owner |
| GET / PUT | `/marks?subjectId&term` / `/marks` | any / teacher (own subject), admin, owner |
| GET | `/report-cards/:studentId?term` | any |
| GET / POST | `/students/:id/health` | any / teacher, clerk, admin, owner |
| DELETE | `/health/:id` | author, admin, owner |
| GET | `/health/follow-ups` | any |
| GET | `/dashboard` | any (web app: office roles) |
| GET | `/today` | any (teacher home) |
| GET | `/audit` | owner, admin |

### Files

`GET /files/<key>?e=<expiry>&s=<signature>` — only when S3 is not configured. Links come from the API (`photoUrl`,
`logoUrl`) and expire after 2–3 hours.

`GET /health` — `{ status: "ok", version }` or `503` when the database is unreachable (for load balancers/uptime checks).
