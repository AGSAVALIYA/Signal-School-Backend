# Signal School — Full System Review, Test Plan and Improvement Plan

**Date:** 1 Oct 2026 · **Scope:** `Signal-School-Backend` @ `342ea53` and `Signal-School-Frontend` @ `e31962f` · **Round:** 1 (inventory and plan) → round 2 implemented, see status below

## Implementation status (round 2)

v2 is implemented on branch `ccr-61b11ce9-g6fan3` in both repos (rewrite rather than incremental patching; Phase 1 fixes are covered by the rewrite).

| Phase | Status | Where |
|---|---|---|
| 0 Test round | Replaced by automated tests: 177 API tests (auth, scope/permission matrix, students, attendance, years/rollover, syllabus, legacy migration) + frontend locale/unit tests + browser smoke run | `tests/`, frontend `src/**/*.test.js` |
| 1 Safety fixes | Done: hashed rotating refresh tokens, lockout, school/year scoping on every route, teacher-section checks, validation, coded errors | `src/middlewares`, `src/modules/auth` |
| 2 Foundations | Done: feature folders, SQL migrations, API client, i18next en/hi/mr/gu | both repos |
| 3 Data model v2 + teacher core | Done: students + enrollments, Today screen, one-tap attendance, diary | `0001-init.up.sql`, `features/today`, `features/attendance` |
| 4 Academic year + syllabus | Done: year switcher, read-only past years with timed unlock, rollover wizard (idempotent, single transaction), per-year topic completion | `modules/years`, `features/years`, `modules/syllabus` |
| 5 Reports & oversight | Done: monthly register, report cards, dashboard, activity log | `modules/dashboard`, `features/marks`, `features/audit` |
| 6 Offline & performance | Done: PWA, offline attendance queue (newest mark wins), indexed queries, code-split routes | frontend `vite.config.js`, `offlineQueue.js` |
| 7 Extras | Partly: activities, holidays, Excel import, legacy data migration (`npm run migrate-legacy`). **Not done:** SMS to parents, TC/leaving certificate, ID cards, mid-day meal, staff attendance | — |

## Why this exists
Teachers using Signal School are mostly **not technical**. Three goals drive this review:
1. Make the app **easy for teachers** (attendance in seconds, in their language, with certainty it saved).
2. Make multi-language **real**. Today it's a Google Translate overlay.
3. Make the **new academic year easy**, and keep **past years viewable**.

This round lists **everything** in the system, writes user stories and test cases, simulates a non-technical tester to collect feedback and recommendations next to each item, and records every bottleneck, speed problem and code issue. **The next round executes the tests** (Phase 0 of the plan). After that, the fixing starts.

---

## Document map

| # | Document | What's inside |
|---|---|---|
| 01 | [Inventory](01-inventory.md) | 26 modules, 18 data-model items, **73 API endpoints**, 23 pages/routes, 42 components, utilities, dependencies. Each has status, *tester feedback* and *recommendation* next to it. |
| 02 | [Personas & user stories](02-user-stories.md) | 6 personas, **65 user stories** with acceptance criteria and current status. |
| 03 | [Test cases](03-test-cases.md) | How to run round 2, test data, roles, **201 test cases + 14 future regression cases** (functional, negative, security, performance, language, accessibility, task-based UX sessions) with predicted outcomes. |
| 04 | [Non-technical walkthrough & UX](04-ux-walkthrough.md) | Teacher and principal journeys screen by screen, 15 cross-cutting UX findings, wireframes of the redesigned key screens, and a "teacher-first" checklist. |
| 05 | [Issues register](05-issues-register.md) | **94 issues** (bugs, security, data integrity, performance, code quality) with file:line evidence, plain-language impact, fix and phase. |
| 06 | [Multi-language design](06-multilingual-design.md) | Replace GTranslate with i18next. Language persistence, server error codes, dates, fonts, PDFs, glossary (en/hi/mr/gu), translation workflow. |
| 07 | [Academic year design](07-academic-year-design.md) | Student identity + enrollments. Rollover wizard, promotion, year switcher, read-only past years, legacy data migration, edge cases. |
| 08 | [Schema v2](08-schema-changes.md) | Every table, constraint and index. Permission matrix. Migrations instead of `sync({alter})`. Old → new mapping. |
| 09 | [Folder structure & conventions](09-folder-structure-and-conventions.md) | Feature-first layout for both repos. API and frontend conventions. Incremental migration path. |
| 10 | [Implementation plan](10-implementation-plan.md) | Phase 0 (test round) → Phase 7, with tasks, files, interfaces, checkbox steps, review-focus tests and a timeline. |
| 11 | [Feature gaps](11-feature-gaps.md) | 32 missing management/attendance/academic-year features with priority and phase. |

---

## Legend (used in every document)

| Symbol | Meaning |
|---|---|
| ✅ | Works (as far as the code shows) |
| ⚠️ | Works, with problems |
| ❌ | Broken / wrong |
| 🚫 | Missing (feature needed) |
| 💀 | Dead / unused code |
| **S1** | Critical: security hole, data loss, server crash, or a core task blocked |
| **S2** | High: core task broken or very confusing |
| **S3** | Medium |
| **S4** | Low / cosmetic |
| BUG-xxx / PERF-xx / CQ-xx | Issue IDs in [05](05-issues-register.md) |
| M/API/PG/CMP/DM/UT-xx | Inventory IDs in [01](01-inventory.md) |
| US-xxx | User stories in [02](02-user-stories.md) |
| TC-xxx | Test cases in [03](03-test-cases.md) |
| FG-xx | Feature gaps in [11](11-feature-gaps.md) |

> **Predicted vs confirmed.** Everything in round 1 comes from reading every source file in both repos. Statements such as "crashes" or "fails" are predictions with code evidence. Round 2 confirms or rejects each one.

---

## Executive summary

### Overall health (predicted)

| Area | Rating | One-line reason |
|---|---|---|
| Security & privacy | 🔴 Critical | A teacher token can act as an admin (BUG-001). The attendance API is public (BUG-002). Password hashes are sent to browsers (BUG-003). There's no isolation between organizations (BUG-004). Admin registration is open (BUG-005). |
| Stability | 🔴 Critical | Several endpoints can **crash the whole server** with one bad request (BUG-006). The schema auto-alters production on boot (BUG-007). |
| Data integrity | 🔴 High | Editing a chapter wipes syllabus progress (BUG-030). Deleting a year takes one click (BUG-015). GR numbers duplicate, and CSV import gives every student the same GR (BUG-012/013). |
| Teacher usability | 🟠 Poor | Attendance takes about 5 minutes per class with no "saved" certainty. Icon-only buttons, English jargon, the app opens on a profile page. |
| Multi-language | 🔴 Gimmick | Google widget on the teacher profile page only. Translates children's names. Nothing for admins, server messages or PDFs. |
| Academic year | 🔴 Missing | No rollover. Students are re-created each year (history split). Past years are invisible in the UI. |
| Performance | 🟠 Fair now, poor at scale | No indexes, no pagination, whole-school syllabus payloads, about 8 s of artificial delays, full-size photo uploads, no offline mode. |
| Code quality | 🟠 Fair | No tests. Duplicated admin/teacher components. Copy-pasted UI. Inconsistent API. Dead code. |

### The 10 most important findings
1. **BUG-001**: `adminConstraint` trusts the numeric `id` in any JWT, so **teacher #N becomes admin #N**.
2. **BUG-002 / BUG-003**: children's attendance is readable without login, and `/admin/getAll` publicly lists admins *with password hashes*.
3. **BUG-004**: an admin can switch into, edit or delete **another organization's** schools, students and admins.
4. **BUG-006**: report creation and set-current-year (among others) throw outside try/catch. In Node ≥ 15 that **exits the process**.
5. **BUG-030**: renaming a chapter **deletes all topics and their completion ticks**.
6. **BUG-029**: the admin's student "Academics" tab shows **hard-coded fake grades** for every child.
7. **Attendance UX**: per-child dialog with 5 unrelated fields. Bulk mode needs subjects and can't mark absences (BUG-025). Unmarked children show as "Absent" (BUG-019).
8. **Academic year**: no rollover or promotion. "From Previous A.Y." makes a new student row with 5 fields (parents, phones and photo lost). No way to view past years.
9. **Multi-language**: GTranslate overlay, configured twice, teacher side only, with page reloads and translated names. Replace with i18next ([06](06-multilingual-design.md)).
10. **Privacy**: student CSVs (names, DOB, addresses) committed in `tmp/csv/`. Aadhaar stored in plaintext. PAN collected for minors. Public photo URLs.

### What we recommend, in order
1. **Phase 0 (next round):** run the test plan with real teachers and confirm the findings.
2. **Phase 1:** close every S1 (security, crashes, data loss) with tests, in the current code. About 1–2 weeks.
3. **Phase 2:** foundations plus **real multi-language** (Vite, API client, i18next, error codes, migrations, roles). About 2–3 weeks.
4. **Phase 3:** **data model v2** (students + enrollments) and the **teacher-first core**: Today home, 45-second attendance, shared student form, register, import. About 4 weeks.
5. **Phase 4:** **academic year rollover wizard, year switcher, student history**, plus the rebuilt syllabus. About 3 weeks.
6. **Phases 5–7:** reports and dashboards, offline PWA and performance, extras (parent SMS, TC, ID cards).

---

## How to use these documents in round 2
1. Set up the test environment (plan Task 0.1).
2. Work through [03](03-test-cases.md) and mark each case Pass/Fail with evidence. For every failure, update the matching BUG in [05](05-issues-register.md) to **Confirmed**, or add a new BUG.
3. Run the TC-UX sessions with real teachers. Paste their quotes into the "Tester feedback" columns of [01](01-inventory.md), replacing the predicted text, and their words into the glossary in [06](06-multilingual-design.md).
4. Write `12-test-report-round-1.md` (template in plan Task 0.4) and re-prioritize the plan if needed.
