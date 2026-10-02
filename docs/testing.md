# Testing strategy

Goal: a teacher with a cheap phone and bad network can trust that what she saved is saved, in her language, and that no
child's data leaks to another school. Tests are layered so that most problems are caught in seconds on a laptop.

```
            ▲  Field testing with teachers (each term)           — manual, real phones, real classes
           ▲▲  Browser end-to-end (Playwright, phone + desktop)   — ~4 min, web repo `e2e/`
         ▲▲▲▲  API integration (Jest + supertest + Postgres)      — ~35 s, this repo `tests/`
      ▲▲▲▲▲▲▲  Unit (Vitest: offline queue, locales, utils)       — ~2 s, web repo `src/**/*.test.*`
   ▲▲▲▲▲▲▲▲▲▲  Static: ESLint (incl. no literal UI text), Prettier, npm audit
```

## 1. Static checks (every commit)

| Check | Command | Catches |
|---|---|---|
| Lint | `npm run lint` (both repos) | Bugs, hooks misuse, **untranslated text in JSX** (`i18next/no-literal-string`) |
| Format | `npm run format:check` (API) / `npx prettier --check src` (web) | Noise in reviews |
| Dependencies | `npm audit --audit-level=moderate` | Known vulnerable packages |

## 2. Unit tests — web (`npm test`)

- `i18n/locales.test.js`: every language has exactly the English keys, no empty strings, same `{{placeholders}}`; every
  `t('key')` in the code exists.
- `features/attendance/offlineQueue.test.js`: one entry per class/date, upload on success, **keep on temporary errors**
  (network, logged out, 5xx), move refusals to the visible failed list, clear on logout.
- `shared/components/components.test.jsx`: WhatsApp number/country code and message in the guardian's language; the error
  boundary shows a friendly screen.
- `shared/utils/utils.test.js`: formatting and the permission mirror.

## 3. API integration tests (`npm test` here)

Run against a real PostgreSQL (`TEST_DATABASE_URL`, default `postgres://postgres:postgres@localhost:5432/signal_test`);
the schema is dropped and migrated fresh each run, so migrations are tested too.

| File | Focus |
|---|---|
| `security.test.js` | **Scope matrix**: every route (discovered automatically) needs login, and every route with an id is invisible to another trust (≥ 400, never 500). Teacher/admin boundaries |
| `hardening.test.js` | Refresh-token reuse detection, `alg:none`/forged JWTs, uniform login errors, signed file links, fake images, staff contact privacy, request-id sanitising, rollover keys per school |
| `auth.test.js` | Login, lockout, rotation, password change and deactivation end sessions, temp passwords, linking a teacher to a 2nd school |
| `students.test.js` | Admission, GR allocation and duplicates, import preview/commit, leave/readmit, history |
| `attendance.test.js` | Sheets, edit window, future dates, holidays, newest-mark-wins for offline saves, closed/unlocked years, register, school timezone |
| `years.test.js` | Date validation and overlaps, rollover preview/apply (class-level order, no ticks copied), idempotency under concurrency, late promotions |
| `syllabus.test.js` | Tree edits keep ticks, taught topics cannot be removed, teacher may untick only own, progress, marks → report card, dashboard, class diary |
| `followup.test.js` | Possible duplicates (similar names, same phone, isolation), absence streaks (holidays don't break them), one child's month, activity-log filters |
| `health.test.js` | Health check-ups, follow-ups, leaving destination, marks above maximum, import date validation, dashboard counts |

Writing a new API test: use `makeSchool()` from `tests/helpers.js` (owner, admin, two teachers, two classes, five
children) and `as(user).get(…)`. Any new route is automatically included in the scope matrix — add its id prefix to
`fill()` in `security.test.js` if it uses a new kind of id.

## 4. Browser end-to-end (web repo)

```bash
# terminal 1 (API repo) — many logins come from one machine, so lift the login rate limit for this run
npm run db:migrate && npm run db:seed && LOGIN_RATE_LIMIT=1000 npm start
# terminal 2 (web repo)
npx playwright test            # starts Vite automatically; runs at 360×740 (phone) and 1280×800 (desktop)
```

`e2e/smoke.spec.js` checks, for owner, clerk and teacher: every page they can open renders, **no console errors, no
sideways scrolling on a 360 px phone**, and saves a screenshot per page to `e2e-results/screens/` for visual review.
Journeys: teacher takes attendance with one tap per child; language switch changes the interface; text size at 130%
still fits a phone; clerk records a health check-up, marks a child as left and opens the leaving certificate; clerk is
warned before admitting a child twice and sees the child's month; principal filters the activity log.

`e2e/a11y.spec.js` runs axe-core (WCAG 2.1 A/AA) on every screen for owner, clerk and teacher, including the student
and staff profile tabs and the attendance sheet; it must report zero violations.

`npm run screenshots` (web repo) refreshes the images in `docs/screenshots/` used by the READMEs.

## 5. Manual checks before a release

- [ ] Print the monthly register (landscape), a report card and a leaving certificate (portrait) in **Marathi and
      Gujarati** — characters must join correctly.
- [ ] Airplane mode: take attendance, see "waiting for internet", reconnect, see it upload.
- [ ] Install as an app (Add to home screen); open offline; update prompt appears after a deploy.
- [ ] Screen reader spot check (TalkBack) on Today and attendance: each child announces name and status.
- [ ] Rollover wizard on a copy of real data; compare counts with the paper register.

## 6. Field testing with teachers (each term)

Non-technical users find problems no automated test does. Run short sessions (20 minutes, one teacher, her own phone):

1. Give a task, not instructions: "Take today's attendance; Aarav is absent", "Add a new child who has no birth
   certificate", "Find Diya's mother's number and send her a WhatsApp".
2. Watch silently; note where she hesitates, what she taps first, which words she reads aloud or asks about.
3. Measure: time to finish, mistakes, whether she was sure it was saved.
4. Ask her to say in her own words what each button does; replace our wording with hers in the locale files.
5. Log findings as issues labelled `field-test`; fix the top three before the next session.

Success targets: attendance for 35 children in **under 60 seconds**; a new teacher completes the first-login flow and
takes attendance **without help**; zero lost attendance reports per term.

## CI

Both repositories run lint, tests, build and `npm audit` on every push and pull request (`.github/workflows/ci.yml`).
The API workflow starts a Postgres service container. End-to-end tests run locally or on demand because they need both
repositories.
