# 07 — Academic Year Lifecycle: Design Spec

**Goal.** Starting a new academic year takes **minutes**, children keep **one identity for life** with their history attached, and anyone can **look at any past year** safely (read-only).

---

## 1. What's wrong today (summary)

| Today | Consequence |
|---|---|
| `Student` rows belong to one `AcademicYear` + `Class`. "From Previous A.Y." creates a **new** student copying 5 fields (name, age, DOB, address, GR). | History is split across rows. Parents/phones/Aadhaar/photo are lost each year. Duplicate search results. There's no way to show "Ravi's attendance in 2024-25". |
| `Class` is a per-year name with no order and no "next class" | Promotion can't be automated. Classes must be re-created by hand each year. |
| Subjects and syllabus are tied to per-year classes with nothing to copy them | Re-typing every subject, chapter and topic every year. |
| Only `school.currentAcademicYear` drives every list (`/class/getAll`, `/student/getAll`, syllabus, reports) | Past data becomes **invisible** in the UI the moment the year is switched. |
| Delete-year is one click (BUG-015), edit-year is broken (BUG-016), no date validation (BUG-070) | Risk of wiping a whole year. Typos can't be fixed. |
| Nothing makes a past year read-only | Old attendance can be changed silently. |

---

## 2. Concepts (new model)

| Concept | Meaning | Lives across years? |
|---|---|---|
| **Student** | The child (identity, profile, guardians, documents). | ✅ permanent |
| **Grade** | A level such as "Balwadi", "Std 1" … "Std 10". Has `sort_order`, `next_grade_id`, `is_final`. | ✅ permanent |
| **Academic year** | A period with `status`: `planned` → `active` → `closed`. Exactly one `active` per school (= current). | — |
| **Class section** | A grade in a year, optionally split ("Std 1 A", "Std 1 B"). Has a class teacher. | ❌ per year |
| **Enrollment** | Student × year → class section, roll no, status (`active`, `promoted`, `detained`, `left`, `graduated`, `transferred`). | ❌ per year |
| **Subject** | Belongs to a class section (per year). Copied at rollover. | ❌ per year (copied) |
| **Chapter / Topic** | Syllabus of a subject. Copied at rollover **without** completion records. | ❌ per year (copied) |
| **Teacher assignment** | Teacher × class section (× subject) for a year. Copied at rollover (editable). | ❌ per year |
| **Attendance / daily log / report** | Linked to the **enrollment** (and so to the student and the year). | stays with its year |

Full table definitions are in [08-schema-changes.md](08-schema-changes.md).

```
students ──< enrollments >── class_sections >── grades
                │                 │
                │                 ├──< subjects ──< chapters ──< topics ──< topic_completions
                │                 └──< teacher_assignments >── users
                ├──< attendance
                ├──< daily_logs
                └──< report_entries
academic_years ──< class_sections, enrollments (via section), holidays
```

---

## 3. The rollover wizard (admin)

**Entry points:** a dashboard banner appears from 45 days before the current year's end date ("2025-26 ends on 30 Apr. Prepare 2026-27 →"), plus Academic Years page → "Start new academic year".

| Step | Screen | Defaults | Notes |
|---|---|---|---|
| 1 | **Year details**: name, start date, end date | Name = next pattern ("2026-27"). Dates = last year + 1 year. | Validation: start < end, no overlap, unique name. |
| 2 | **Classes**: table of last year's sections grouped by grade, each with a "copy" checkbox. Add/remove/rename sections. | All copied. | Shows the student count per section to help split/merge decisions. |
| 3 | **Subjects & syllabus**: per grade, "copy subjects" ☑ and "copy syllabus (chapters & topics)" ☑ | Both on. | Completion ticks are never copied. |
| 4 | **Teachers**: copy class-teacher and subject-teacher assignments | On (inactive teachers are skipped and listed). | Editable later. |
| 5 | **Promotion**: per section, list of active enrollments with a per-student action | `Promote → <next grade's matching section>`. Final grade → `Graduated`. | Actions: Promote (choose section), Detain (same grade, new year), Left (date + reason), Graduated, Transferred. Bulk select. Can be skipped and done later per class. |
| 6 | **Review & create**: summary counts ("12 sections, 36 subjects, 410 topics, 18 assignments, 380 promoted, 9 detained, 11 left, 40 graduated") + "Make 2026-27 current: ◉ on 01/06/2026 ○ now" | On the start date. | One API call, one DB transaction. Idempotency key prevents double creation. |

**After creation:**
- The new year is `planned` (visible in the switcher with a "Planned" badge) until activation. Admins can prepare timetables, admissions for new joiners, etc.
- On activation (manual button, or an automatic daily job on the start date): the new year becomes `active` and the previous `active` becomes `closed` **only when the admin confirms** (attendance for the last days may still be pending). Recommended: the old year stays `active-overlap` for up to 14 days, then auto-closes, with a warning banner.
- **Undo window:** while a year is `planned` and has no attendance, "Delete planned year" removes everything the wizard created (cascade on `academic_year_id`).

### Promotion details
- Section mapping default: same letter in the next grade (`Std 1 A → Std 2 A`). If the next grade has a single section, use it. If there's no match, the admin must choose one (the step is blocked until resolved).
- **Detained** students get a new enrollment in the *same grade* for the new year.
- **Left** sets the old enrollment to `left` with `exited_on` and a reason. The student's status becomes `left` unless they're re-admitted later.
- **Graduated** (final grade) sets `students.status = graduated`.
- Students added mid-year to the old year after the wizard ran: the promotion screen for that section shows "3 students not yet processed".

---

## 4. Viewing data from any year

### UX
- **Year switcher** in the admin header and in the teacher "Me" tab (teachers rarely need it, but class teachers look up last year's records).
- Selecting a past year shows a sticky yellow banner: *"You are viewing 2025-26 (read-only). [Back to 2026-27]"*.
- Every list, report, dashboard card and syllabus page reflects the selected year.
- **Student profile → History tab** (any year selected): one card per enrollment with year, class, roll no, attendance % (link to that year's register), report grades, and a "Daily diary" link filtered to that year.
- Search across all years: Students page has a "Search all years" toggle that returns one row per child with their latest class.

### API contract
- Every year-scoped endpoint accepts `academicYearId` (query) or the header `X-Academic-Year: <id>`. **Default = the school's current (active) year.**
- `academicYearScope` middleware resolves the year, checks it belongs to `req.schoolId`, and sets `req.academicYear = { id, status }`.
- **Writes to a `closed` year** return `423 Locked` with code `YEAR_CLOSED`, unless the user is an admin with an active *unlock* (`POST /academic-years/:id/unlock { reason, minutes: 60 }`, audited).
- Frontend: `YearContext` holds the selected year. React Query keys include `yearId`, so switching refetches cleanly.

---

## 5. API summary (new)

| Method & path | Purpose |
|---|---|
| `GET /api/v1/academic-years` | List with status, counts (sections, students). Teachers: read. |
| `POST /api/v1/academic-years` | Create a single (empty) year (rarely used; the wizard is preferred). |
| `PATCH /api/v1/academic-years/:id` | Edit name/dates (validated). |
| `DELETE /api/v1/academic-years/:id` | Only if `planned` with no attendance; otherwise 409 `YEAR_HAS_DATA`. |
| `POST /api/v1/academic-years/rollover/preview` | Body: `{sourceYearId, name, startDate, endDate, copy:{sections, subjects, syllabus, assignments}}` → returns the proposed sections, subjects count, and per-section default promotion lists. No writes. |
| `POST /api/v1/academic-years/rollover` | Body: preview output after admin edits + `promotions[]` + `activation: 'now'\|'on_start'` + `idempotencyKey`. Creates everything in **one transaction**. Returns a summary. |
| `POST /api/v1/academic-years/:id/promotions` | Batch promotions for one or more sections (lets big schools promote class by class). Idempotent per enrollment. |
| `POST /api/v1/academic-years/:id/activate` | Make current. Optional `closePrevious: true`. |
| `POST /api/v1/academic-years/:id/close` / `…/reopen` | Admin only, audited. |
| `POST /api/v1/academic-years/:id/unlock` | Temporary write access to a closed year (admin, reason, expiry). |
| `GET /api/v1/students/:id/history` | All enrollments with summaries. |

Service implementation: `modules/academic-years/rollover.service.js` with pure functions `buildPlan(sourceYear, options)` and `applyPlan(plan, tx)`. These are easy to unit test.

---

## 6. Migrating existing data (one-time, scripted)

Script: `scripts/migrate-legacy-to-v2.js`, with `--dry-run` (default) and `--apply`.

1. **Grades.** For each school, collect distinct class names across all years and normalize them (trim, case, "Std1" vs "Std 1", Marathi/English variants). Write `grade-mapping.<school>.csv` (legacy name → grade name, sort order, next grade). The admin reviews/edits the CSV, then re-runs.
2. **Class sections.** One per legacy `Class` row (year + grade from the mapping).
3. **Students (dedupe).** Group legacy `Students` by `(SchoolId, GRNumber)`, since the "previous A.Y." flow copied the GR. If the GR is missing or conflicting, fall back to `(normalized name, dob)`. Ambiguous groups go to `review-students.csv` for manual decision (merge / keep separate).
   - Profile fields: take the most recent non-empty value per field (parents and phones were often filled only in the latest copy).
   - Create one `students` row + one `enrollments` row per legacy row (status: latest = `active`, older = `promoted`, or `detained` if the grade didn't increase).
   - Keep `legacy_student_map(legacy_student_id → student_id, enrollment_id)`.
4. **Attendance:** map `studentId` → (`student_id`, `enrollment_id`), `classId` → `class_section_id`, and set `academic_year_id`.
5. **Timelines** → `daily_logs` (+ subjects). Duplicate entries for the same student/day are merged (notes concatenated, latest status kept).
6. **Reports** → `report_entries` (deduplicated by enrollment+subject+term, keeping the latest).
7. **Topic completion** → `topic_completions`.
8. **Verification report:** row counts before/after per table, number of merged students, unmatched rows, and 10 random students' histories printed for a human check.
9. Run on a **copy of production**, review, then schedule a maintenance window and run with `--apply` inside a transaction per school. Keep the legacy tables renamed (`legacy_*`) for 90 days.

---

## 7. Edge cases

| Case | Handling |
|---|---|
| Child re-admitted after leaving (common with migrant families) | Search "all years / left" and **Re-admit**, which creates a new enrollment for the same student. |
| Child joins mid-year | Normal add, into the current year's section. |
| Child moves section mid-year | Update `enrollments.class_section_id`. Attendance history keeps its old section id (register shows "moved on 12/11"). |
| Teacher leaves mid-year | Deactivate. Assignments show "unassigned" for reassignment. |
| A grade is added (e.g., new Std 9) | Add a grade with sort order + next grade. Rollover picks it up. |
| Sections merged next year (1A + 1B → 2A) | Promotion step lets you pick the target section per student or in bulk. |
| Overlap: old year still active while the new starts | Allowed up to 14 days. Teachers' "Today" uses the year containing today's date. Attendance dates are validated against the section's year range. |
| Admin runs the wizard twice (double click / retry) | Idempotency key. Unique (school, year name) as a second guard. |
| Rollover fails halfway | Single transaction, so nothing is created. Error shown with code. |
| Year deleted by mistake | Only `planned` years without attendance can be deleted. Others can only be archived/closed. |
| Attendance on a date outside the year's range | 400 `DATE_OUTSIDE_YEAR`. |

---

## 8. Acceptance criteria (tests TC-ROLL-01…06)
- [ ] A full rollover for a school with 12 sections and 400 students completes in ≤ 15 minutes of admin time and ≤ 10 s server time.
- [ ] After rollover, each promoted child has exactly **one** `students` row and two `enrollments`.
- [ ] Subjects/chapters/topics counts match the source. Completions = 0.
- [ ] Switching the header to the previous year shows all its classes, students, attendance and syllabus progress unchanged.
- [ ] Teachers can't write to a closed year (423). Admin unlock works and is audited.
- [ ] Student History tab shows both years.
- [ ] Legacy migration dry-run report shows 0 unexplained count differences.
