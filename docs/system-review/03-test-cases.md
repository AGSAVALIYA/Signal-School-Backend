# 03 — Test Cases (to run in the next round)

This round only writes the test cases and predicts results from the code. In the next round they get **executed**, with Status/Actual/Evidence filled in.

---

## 1. How to run the test round

### 1.1 Test environment (set up once)
1. **Backend:** Postgres 15 (Docker), `.env` from the template in [10-implementation-plan.md §Phase 0](10-implementation-plan.md), `npm i && npm run dev`. Use a **separate test database**, never production.
2. **Frontend:** `REACT_APP_API_BACKEND=http://localhost:3000 npm start`.
3. **Seed data** (script to be written in Phase 0, `scripts/seed-test-data.js`):
   - Org **A** "Signal Trust" with School **A1** (current year 2025-26, past year 2024-25) and School **A2**.
   - Org **B** "Other Trust" with School **B1**, used for cross-tenant security tests.
   - Admins: `adminA@test` (id 1), `adminB@test` (id 2).
   - Teachers: `t.sunita@test` (id 1, collides with admin id 1), `t.rahul@test` (id 2), `t.inactive@test` (inactive).
   - School A1, 2025-26: classes Balwadi, Std 1, Std 2, Std 10 (to test ordering and "Std 1" vs "Std 10" filtering). 40 students in Std 1, some with Devanagari names (e.g., "सुनील पवार"). Subjects Marathi/English/Maths. Syllabus with 3 chapters × 4 topics, some completed.
   - 2024-25: the same classes with 30 students (the old copy-per-year model), attendance for 20 days.
4. **Devices:** (a) a low-end Android phone (or Chrome DevTools "Moto G4" + **Slow 3G**), (b) desktop Chrome 1366×768, (c) one iPhone Safari if available.
5. **Tools:** browser DevTools (Network tab), Postman/curl for API tests, a screen recorder for UX sessions, and a stopwatch.

### 1.2 Who tests
| Role | Who | Runs |
|---|---|---|
| **T1 – Non-technical teacher** | Ideally a real teacher (P1 persona). Otherwise someone who is not a developer. | TC-UX scenarios, TC-ATT, TC-STU (teacher), TC-SYL (teacher), TC-LANG. Think aloud; the facilitator only observes. |
| **T2 – Admin/principal** | Office staff or a product person | TC-SCH, TC-AY, TC-CLS, TC-TCH, TC-STU (admin), TC-ARP, TC-DSH |
| **T3 – Technical tester** | Developer | TC-SEC, TC-PERF, TC-DATA, API-only cases, and confirming root causes |

### 1.3 How to record results
Copy the result columns into a spreadsheet (or tick them in this file):

`Status` (Not run / Pass / Fail / Blocked) · `Actual result` · `Evidence` (screenshot/video/HAR) · `Time taken` · `Ease 1–5` (5 = very easy) · `Tester quote` · `Bug ID` (existing BUG-xxx or new).

**UX feedback rule:** for every screen a T1 tester touches, write down what they **expected**, what **confused** them, and what they **would call** the button. Those words feed the Marathi/Hindi glossary.

### 1.4 Columns used below
**Type:** F functional · N negative/edge · U usability · S security · P performance · L language · D data integrity · A accessibility/compatibility.
**Pri:** P1 must pass before release · P2 should · P3 nice to have.
**Predicted:** expected outcome from the code review. ❌ = likely FAIL (with bug ref), ⚠️ = passes with problems, ✅ = likely PASS.

---

## 2. Test cases

### 2.1 Login and session — TC-AUTH
| ID | Title | Role | Steps | Expected result | Type | Pri | Predicted |
|---|---|---|---|---|---|---|---|
| TC-AUTH-01 | Teacher logs in | T1 | Open app → type teacher email + password → press Login | Lands on the teacher home within 3 s | F | P1 | ⚠️ Opens on the Admin tab by default; a teacher must notice and switch (PG-02). There's a 2 s artificial wait |
| TC-AUTH-02 | Login with Enter key | T1 | Type the password, press Enter on the phone keyboard | Logs in | U | P2 | ❌ Nothing happens (no `<form>`) |
| TC-AUTH-03 | Wrong password message | T1 | Enter a wrong password | Clear message in the chosen language that stays until dismissed | U/L | P1 | ⚠️ English message disappears after 2 s |
| TC-AUTH-04 | Teacher uses the Admin tab by mistake | T1 | Leave the Admin tab selected, enter teacher credentials | Either works (single login) or says "This is a teacher account – use Teacher" | U | P1 | ❌ "Invalid email or password" – misleading |
| TC-AUTH-05 | Inactive teacher login | T3 | Log in as `t.inactive` | Refused with "Account inactive, contact office" | F | P1 | ✅ |
| TC-AUTH-06 | Network down during login | T1 | Turn on airplane mode, press Login | "No internet connection" message | N | P2 | ❌ Login shows "Server Error"; register crashes (`err.response` undefined, BUG-045) |
| TC-AUTH-07 | Session expiry | T3 | Set `JWT_EXPIRE_TIME=1m`, log in, wait 2 min, open Students | Redirect to login with "Session ended" | F | P1 | ❌ Empty lists / "Something went wrong", stuck (BUG-044) |
| TC-AUTH-08 | Logout (teacher) | T1 | Me → Logout | Back at login. Back button doesn't reopen data | F | P1 | ✅ |
| TC-AUTH-09 | Logout (admin) | T2 | Account icon → Logout | Back at login | F | P1 | ✅ |
| TC-AUTH-10 | Admin self-registration visible | T3 | On login: Admin tab → "Need to register?" → create account | Should **not** be possible publicly | S | P1 | ❌ Anyone can register (BUG-005) |
| TC-AUTH-11 | Brute force | T3 | Script 50 wrong logins in 1 minute | Rate-limited after ~10 attempts | S | P1 | ❌ No limit (BUG-009) |
| TC-AUTH-12 | Password hash in login response | T3 | DevTools → Network → login response | No `password` field | S | P1 | ❌ Hash present in `data` (BUG-003) |
| TC-AUTH-13 | Default teacher password | T3 | Admin creates a teacher with blank password → log in with password = email | Not allowed; temporary password shown to admin | S | P1 | ❌ Works with email as password (BUG-009) |
| TC-AUTH-14 | Show/hide password | T1 | Look for an eye icon | Present | U | P3 | ❌ Missing |
| TC-AUTH-15 | Teacher changes own password | T1 | Me → Change password | Possible | F | P2 | ❌ Feature missing |

### 2.2 Organization and school — TC-SCH
| ID | Title | Role | Steps | Expected | Type | Pri | Predicted |
|---|---|---|---|---|---|---|---|
| TC-SCH-01 | First-time admin setup flow | T2 | Register (test env) → follow screens | Guided: Org → School → Year → Classes … with "next step" hints | U | P2 | ⚠️ Org and School forms appear, then the user is left on the School page with no guidance to create a year/classes |
| TC-SCH-02 | Edit school info | T2 | School → Edit → change phone → Save → reload page | New phone shown after reload | F | P1 | ⚠️ Works, but "success" is shown even on failure (not awaited, BUG-010) |
| TC-SCH-03 | Mass assignment | T3 | `PUT /school/update/:id` with body `{"OrganizationId": <B>}` | Ignored / 400 | S | P1 | ❌ Changes organization (BUG-010) |
| TC-SCH-04 | Add second school & switch | T2 | Switch School → Add School → fill → back → Switch | Header shows the new school. Lists show its data | F | P1 | ✅ |
| TC-SCH-05 | Switch into another org's school | T3 | As adminA: `POST /school/switchByAdmin/<B1 id>` then `GET /student/getAll` | 403 | S | P1 | ❌ Switches and returns B1 students (BUG-004) |
| TC-SCH-06 | Edit/delete another org | T3 | As adminA: `PUT /organization/update/<B>` / `DELETE` | 403 | S | P1 | ❌ Allowed (BUG-004) |
| TC-SCH-07 | Public org list | T3 | `curl /organization/getAll` with no token | 401 | S | P1 | ❌ Returns all orgs (API-08) |
| TC-SCH-08 | School list logo | T2 | Open Switch School | Own logo or neutral icon | U | P3 | ⚠️ External news-site image (BUG-060) |

### 2.3 Academic years — TC-AY
| ID | Title | Role | Steps | Expected | Type | Pri | Predicted |
|---|---|---|---|---|---|---|---|
| TC-AY-01 | Create academic year | T2 | School → Add Academic Year → "2026-27", 01/06/2026–30/04/2027 → Save | Appears in list with DD/MM/YYYY dates | F | P1 | ⚠️ Appears; dates shown in US format MM/DD/YYYY (BUG-050) |
| TC-AY-02 | End date before start date | T2 | Start 01/06/2027, end 01/06/2026 | Error "End date must be after start date" | N | P1 | ❌ Saved (BUG-070) |
| TC-AY-03 | Duplicate year name | T2 | Create "2025-26" again | Error "already exists" | N | P2 | ❌ Saved |
| TC-AY-04 | Set current year | T2 | Click "Set Current Year" on 2026-27 | Badge moves; classes/students lists switch to 2026-27 | F | P1 | ⚠️ Works; other open pages keep stale data (localStorage) |
| TC-AY-05 | Set current year with invalid id | T3 | `POST /academicYear/setCurrentAcademicYear {"academicYearId": 99999}` | 404 JSON | N | P1 | ❌ **Server process crashes** (BUG-006) – check with `ps`/logs |
| TC-AY-06 | Set current to another school's year | T3 | adminA sends B1's year id | 403 | S | P1 | ❌ Accepted (no scope) |
| TC-AY-07 | Edit year dates | T2 | Look for Edit on a year | Edit form saves | F | P1 | ❌ No UI; API requires `ClassId` and always fails (BUG-016) |
| TC-AY-08 | Delete current year with data | T2 | Click Delete on the current year | Blocked with an explanation, or strong confirm | D | P1 | ❌ Deleted instantly, no confirm; classes/students orphaned (BUG-015) |
| TC-AY-09 | View last year's students | T2 | Try to see 2024-25 students | Year selector shows them read-only | F | P1 | ❌ Impossible from UI (only the current year is listed anywhere) |
| TC-AY-10 | Start new year: time and effort | T2 | Stopwatch: make 2026-27 fully ready (4 classes, 3 subjects each, syllabus, promote 40 students) | ≤ 15 min with wizard | U | P1 | ❌ Estimated 2–4 hours of manual re-entry; students re-added one by one with "From Previous A.Y." |
| TC-AY-11 | Promote a student via "From Previous A.Y." | T1 | Students → + → From Previous A.Y. → search name → choose class → Submit | Student in new class with all details and history | D | P1 | ⚠️ Creates a **new** student copying only 5 fields; parents/phones/Aadhaar/photo lost; history split |
| TC-AY-12 | Same child appears multiple times in search | T1 | Search a child who studied 2 past years | One result per child | U | P2 | ❌ One result per past year |

### 2.4 Classes, subjects, activities — TC-CLS
| ID | Title | Role | Steps | Expected | Type | Pri | Predicted |
|---|---|---|---|---|---|---|---|
| TC-CLS-01 | Add class | T2 | Settings → Class Form → choose year → "Std 3" → Add | Appears in list | F | P1 | ✅ (list only refreshes after re-selecting the year) |
| TC-CLS-02 | Add class without choosing year | T2 | Leave year empty → Add | Validation message | N | P1 | ❌ "Created successfully" then invisible (BUG-023) |
| TC-CLS-03 | Rename class | T2/T3 | Look for rename in UI; API `PUT /class/update/:id` | Renamed | F | P1 | ❌ No UI; API always fails (BUG-020) |
| TC-CLS-04 | Delete class | T3 | `DELETE /class/delete/:id` | Deleted, or blocked if it has students | F | P2 | ❌ Always fails (BUG-021) |
| TC-CLS-05 | Get class by id | T3 | `GET /class/get/:id` | 200 | F | P3 | ❌ Always 500 (BUG-022) |
| TC-CLS-06 | Class ordering | T1 | Open Classes on teacher app | Balwadi, Std 1, Std 2 … Std 10 | U | P2 | ⚠️ Ordered by creation id (BUG-051) |
| TC-CLS-07 | Add subject | T2 | Settings → Subject Form → class → "Science" → Add | Listed under class | F | P1 | ✅ |
| TC-CLS-08 | Subject for past-year class | T2 | Try to add a subject to a 2024-25 class | Not offered, or attached to the correct year | D | P3 | ⚠️ Only current classes listed; API would attach to the wrong year (BUG-024) |
| TC-CLS-09 | Edit/delete subject | T2 | Look for edit/delete | Available | F | P2 | ❌ No UI |
| TC-CLS-10 | Duplicate subject | T2 | Add "Maths" twice to the same class | Error | N | P3 | ❌ Duplicate created |
| TC-CLS-11 | Common subject wording | T1/T2 | Ask the tester what "Common Subject" means | Understands | U | P3 | ❌ Unclear term |
| TC-CLS-12 | Assign common subject to student | T2 | Student → Edit → Common Subjects → pick → Save | Saved and shown | F | P2 | ✅ |

### 2.5 Teacher management — TC-TCH
| ID | Title | Role | Steps | Expected | Type | Pri | Predicted |
|---|---|---|---|---|---|---|---|
| TC-TCH-01 | Add teacher | T2 | Teachers → + → name, email, password → Submit | Appears in list | F | P1 | ✅ (dialog closes before the result; on error the form is lost, BUG-042) |
| TC-TCH-02 | Add teacher with existing email | T2 | Use an existing email | Friendly "Email already used" | N | P1 | ❌ Raw DB error text |
| TC-TCH-03 | Invalid email | T2 | "abc" as email | Validation | N | P2 | ❌ Saved |
| TC-TCH-04 | Teacher list class filter | T2 | Teachers → Class filter → "1st Grade" | Filter or no such filter | F | P1 | ❌ **Page crashes** (BUG-040) |
| TC-TCH-05 | Teacher list sort | T2 | Sort By → Name | Sorted | F | P2 | ❌ Crashes (BUG-040) |
| TC-TCH-06 | Edit teacher | T2 | Open teacher → Edit → phone → Save | Saved | F | P1 | ✅ |
| TC-TCH-07 | Reset teacher password | T2 | Teacher → Change Password → twice → Update | Success; teacher can log in with new password | F | P1 | ✅ (no strength rule) |
| TC-TCH-08 | Make inactive | T2 | Make Inactive → confirm | Removed from list; can't log in | F | P1 | ✅ (full page reload) |
| TC-TCH-09 | Reactivate teacher | T2 | Find inactive teachers | Inactive tab + Reactivate | F | P2 | ❌ No UI/route |
| TC-TCH-10 | Teacher activity log | T2 | Teacher → Logs | Shows logins, attendance, edits with date+time | F | P2 | ⚠️ Date only; some actions missing |
| TC-TCH-11 | Assign classes to teacher | T2 | Look for class assignment | Available | F | P1 | ❌ Missing (M24) |
| TC-TCH-12 | Teacher password hash exposure | T3 | `GET /teacher/get/:id` | No `password` | S | P1 | ❌ Present (BUG-003) |
| TC-TCH-13 | Teacher changes another teacher's photo | T3 | As t.rahul: `POST /teacher/addAvatar/<sunita id>` | 403 | S | P2 | ❌ Allowed (BUG-011) |

### 2.6 Students — TC-STU
| ID | Title | Role | Steps | Expected | Type | Pri | Predicted |
|---|---|---|---|---|---|---|---|
| TC-STU-01 | Teacher adds a student (essentials only) | T1 | Class → Students → + → name, class → Submit | Saved with only essential fields | F/U | P1 | ❌ Requires age, DOB and address; no guardian phone field |
| TC-STU-02 | Child with unknown DOB | T1 | Add child whose DOB is unknown, approx. 8 years | Allowed (approximate age) | F | P1 | ⚠️ Must invent a DOB in the UI (backend allows null DOB) |
| TC-STU-03 | Admin adds a student | T2 | Students → + → fill → Submit | In list with auto GR | F | P1 | ✅ |
| TC-STU-04 | GR uniqueness (manual) | T3 | Create a student with GR = an existing GR | Rejected | D | P1 | ❌ Accepted (BUG-012) |
| TC-STU-05 | GR concurrency | T3 | Fire 5 parallel `POST /student/create` without GR | 5 different GRs | D | P1 | ❌ Duplicates likely (BUG-012) |
| TC-STU-06 | GR after manual GR without dash | T3 | Create a student with GR "1234", then one without GR | Next GR valid | D | P2 | ❌ "SCH1-NaN" |
| TC-STU-07 | Student list today status | T2 | Before any attendance today, open Students | "Not marked" | D/U | P1 | ❌ Everyone "Absent" (BUG-019) |
| TC-STU-08 | Filter "Std 1" | T2 | Class filter = Std 1 | Only Std 1 | F | P1 | ❌ Also Std 10 (BUG-041) |
| TC-STU-09 | Sort by date added | T2 | Sort By → Date Added | Newest first | F | P2 | ❌ No effect (BUG-041) |
| TC-STU-10 | Student profile (admin) | T2 | Click a student | Correct info, real academics | F | P1 | ❌ Academics tab shows fake grades (BUG-029) |
| TC-STU-11 | Edit student (admin) | T2 | Edit → change father name → Save → reload | Persisted | F | P1 | ✅ |
| TC-STU-12 | Edit student (teacher) with error | T1 | Edit → Aadhaar "123" → Save | Error shown, stays in edit | U | P1 | ⚠️ Error shown; with other server errors the edit closes silently (BUG-043) |
| TC-STU-13 | Change class | T1/T2 | Edit → class → Std 2 → Save | Moved; attendance list updated | F | P2 | ✅ |
| TC-STU-14 | Delete student | T2 | Delete → confirm | Soft "left school" with reason; history kept | D | P1 | ❌ Hard delete; may fail with FK error if attendance exists (BUG-014) |
| TC-STU-15 | Upload student photo | T1 | Profile → photo icon → choose → Upload | Photo visible in list | F | P1 | ✅ |
| TC-STU-16 | iPhone HEIC photo | T1 | Upload a HEIC photo | Accepted/converted | A | P2 | ❌ "Image only!" (BUG-057) |
| TC-STU-17 | 8 MB photo on Slow 3G | T1 | Upload a large photo | Compressed, uploads < 15 s | P | P2 | ❌ Very slow/timeout (PERF-12) |
| TC-STU-18 | Unknown student URL | T3 | Open `/students/999999` | "Student not found" | N | P3 | ❌ 500 technical error (BUG-018) |
| TC-STU-19 | Edit another org's student | T3 | adminA: `PUT /student/update/<B1 student>` | 403/404 | S | P1 | ❌ Updated (BUG-004) |
| TC-STU-20 | Export student list | T2 | Look for Export | Excel download | F | P2 | ❌ Missing |

### 2.7 Student import — TC-IMP
| ID | Title | Role | Steps | Expected | Type | Pri | Predicted |
|---|---|---|---|---|---|---|---|
| TC-IMP-01 | Find import feature | T2 | Look for "Import students" | Visible on admin Students page | U | P1 | ❌ Not visible (component commented out) |
| TC-IMP-02 | Download template | T3 | `GET /student/getSampleCsv/:classId` | Template with all fields + instructions | F | P2 | ⚠️ 4 columns; odd filename (BUG-052) |
| TC-IMP-03 | Import 10 rows | T3 | `POST /student/uploadCsv/:classId` with 10 rows | 10 students, 10 unique GRs | D | P1 | ❌ All 10 get the same GR (BUG-013) |
| TC-IMP-04 | Bad row | T3 | Row with empty name / invalid date | Row rejected with reason; others imported | N | P1 | ❌ Whole import fails or bad data saved |
| TC-IMP-05 | Devanagari names in CSV | T3 | UTF-8 CSV with Marathi names | Imported correctly | L | P2 | ✅ (csvtojson handles UTF-8) — verify BOM |
| TC-IMP-06 | Temp file cleanup | T3 | After import, check `tmp/csv/` | File deleted | S | P2 | ❌ Remains (BUG-008) |

### 2.8 Attendance, teacher side — TC-ATT
| ID | Title | Role | Steps | Expected | Type | Pri | Predicted |
|---|---|---|---|---|---|---|---|
| TC-ATT-01 | Find attendance | T1 | From app open, find where to take attendance for Std 1 (no help) | Found in ≤ 10 s, obvious label | U | P1 | ❌ Bottom nav "Class" → unlabeled ✔ icon; testers likely tap the wrong icon (PG-31) |
| TC-ATT-02 | Mark one child present | T1 | Tap child chip → Present | Chip turns green; saved | F | P1 | ⚠️ Works; dialog has 5 unrelated fields first |
| TC-ATT-03 | Mark one child absent | T1 | Tap chip → Absent | Red; saved | F | P1 | ✅ |
| TC-ATT-04 | Whole class time | T1 | Stopwatch: mark 40 children (38 P, 2 A) | ≤ 60 s | U/P | P1 | ❌ Estimated 4–6 min (2 taps + dialog per child) or Bulk + subject selection |
| TC-ATT-05 | Bulk attendance without subjects | T1 | Bulk → Select All → Save | Saves attendance | F | P1 | ❌ "Please select subjects" |
| TC-ATT-06 | Bulk: mark absentees | T1 | Bulk → select only present → Save | Unselected children marked absent | D | P1 | ❌ Unselected get **no** record (BUG-025) |
| TC-ATT-07 | Double tap Present | T1 | Tap Present twice quickly | One record | D | P2 | ❌ Two timeline entries (BUG-047) |
| TC-ATT-08 | Correct a mistake | T1 | Mark A, then mark the same child P | Status P; one record for the day | D | P1 | ⚠️ Attendance becomes P, but two timeline entries show (P and A) |
| TC-ATT-09 | Past date | T1 | Choose yesterday in the dialog | Allowed, saved for yesterday | F | P2 | ✅ |
| TC-ATT-10 | Future date | T1 | Choose tomorrow | Blocked | N | P2 | ❌ Allowed |
| TC-ATT-11 | Saved confirmation | T1 | After saving, ask the tester "Are you sure it saved?" | Confident answer, visible confirmation + counts | U | P1 | ❌ Single: silent (dialog closes); Bulk: message then page reload |
| TC-ATT-12 | Failure visibility | T3 | Stop backend, mark a child | Clear error + retry | N | P1 | ❌ Silent failure (console only) |
| TC-ATT-13 | Offline classroom | T1 | Airplane mode → take attendance | Queued and synced later | F | P2 | ❌ Not supported (PERF-13) |
| TC-ATT-14 | Colour-only status | T1/A | View chips in grayscale (DevTools emulate achromatopsia) | Status readable via letter/icon | A | P2 | ❌ Colour only |
| TC-ATT-15 | Holiday | T1 | Take attendance on a declared holiday | Warned "Holiday" | F | P3 | ❌ No calendar |
| TC-ATT-16 | Bulk race | T3 | Two devices bulk-save the same class at the same moment | No crash, consistent result | D/S | P2 | ❌ Unique violation → unhandled rejection → possible crash (BUG-006/025) |

### 2.9 Attendance reports, admin — TC-ARP
| ID | Title | Role | Steps | Expected | Type | Pri | Predicted |
|---|---|---|---|---|---|---|---|
| TC-ARP-01 | Weekly report | T2 | Attendance → class Std 1 → last 7 days → Get | Per-day lists incl. unmarked | F | P1 | ⚠️ Only marked rows shown |
| TC-ARP-02 | No class selected | T2 | Press Get Attendance | Default class or clear prompt | U | P3 | ✅ Message shown |
| TC-ARP-03 | Monthly register grid | T2 | Look for a students × days grid with % | Available | F | P1 | ❌ Missing |
| TC-ARP-04 | Export PDF in English | T2 | Export PDF | Readable PDF | F | P2 | ✅ |
| TC-ARP-05 | Export PDF with Devanagari names | T2 | Export with Marathi names | Names readable | L | P1 | ❌ Garbled (BUG-068) |
| TC-ARP-06 | Export Excel | T2 | Look for Excel | Available | F | P2 | ❌ Missing |
| TC-ARP-07 | No-auth access | T3 | `curl /attendance/<classId>?startDate=2025-06-01&endDate=2025-06-30` (no token) | 401 | S | P1 | ❌ **Data returned** (BUG-002) |
| TC-ARP-08 | Missing dates | T3 | `GET /attendance/1` without dates | 400 with message | N | P3 | ❌ 500 |

### 2.10 Daily learning timeline — TC-TL
| ID | Title | Role | Steps | Expected | Type | Pri | Predicted |
|---|---|---|---|---|---|---|---|
| TC-TL-01 | Add note + photo for a child | T1 | Chip → write note → photo → subjects → Present | Timeline shows note + photo | F | P1 | ✅ |
| TC-TL-02 | Bulk class note + photo | T2 | Bulk → note → photo → subjects → students → Save | Each child's timeline shows it | F | P2 | ✅ (page reloads; same image key for all) |
| TC-TL-03 | View timeline | T1 | Student → Timeline tab | Newest first, readable | F | P1 | ✅ |
| TC-TL-04 | Teacher edits own note | T1 | Try to edit | Possible | F | P2 | ❌ No UI; API returns 500 for teachers (BUG-027) |
| TC-TL-05 | Admin deletes entry | T2 | Admin student → Timeline → delete | Confirm, then removed with toast | F | P2 | ⚠️ No confirm; toast never shows (BUG-046) |
| TC-TL-06 | Missing subjects field | T3 | POST create without `subjects` | 400 | N | P3 | ❌ 500 (JSON.parse) |
| TC-TL-07 | Admin creates timeline via API | T3 | Admin token POST create | Saved, 201 | N | P3 | ❌ Saved then 500 (`req.teacher.id`) |
| TC-TL-08 | Large file type | T3 | Upload a 50 MB PDF to timeline | Rejected (size/type) | S | P2 | ❌ Accepted (no limit, docs allowed) |

### 2.11 Academic reports — TC-REP
| ID | Title | Role | Steps | Expected | Type | Pri | Predicted |
|---|---|---|---|---|---|---|---|
| TC-REP-01 | Add report (teacher) | T1 | Student → Academic Details → Add → type, grade, subject, content → Add Report | Appears in list with success message | F | P1 | ❌ Dialog closes, list not refreshed, no message (BUG-028) |
| TC-REP-02 | Add report with empty type | T1/T3 | Leave report type empty → Add | Validation message | N | P1 | ❌ Unhandled rejection → **server crash** (BUG-006) |
| TC-REP-03 | Duplicate report | T1 | Add S1 Maths twice | Updates the existing one, or warns | D | P2 | ❌ Duplicate |
| TC-REP-04 | Previous year reports | T2 | View last year's grades | Visible with year selector | F | P2 | ❌ Current year only |
| TC-REP-05 | Admin academics tab | T2 | Admin student profile → Academics | Real data | F | P1 | ❌ Dummy (BUG-029) |
| TC-REP-06 | Report card PDF | T2 | Look for print report card | Available | F | P3 | ❌ Missing |

### 2.12 Syllabus — TC-SYL
| ID | Title | Role | Steps | Expected | Type | Pri | Predicted |
|---|---|---|---|---|---|---|---|
| TC-SYL-01 | Add chapter with topics | T2 | Syllabus → class → subject → chapter name + 3 topics → Submit | Chapter chip appears with topics in order | F | P1 | ⚠️ Appears; topics may be missing until refresh / out of order (BUG-033) |
| TC-SYL-02 | Edit chapter name | T2 | Click chip → change name → Save | Renamed; completion kept | D | P1 | ❌ All topic completion lost (BUG-030); parent list not refreshed |
| TC-SYL-03 | Delete chapter | T2 | Chip → Delete | Removed (with confirm) | F | P1 | ❌ Nothing happens (401, BUG-031) |
| TC-SYL-04 | Admin marks topic completed | T2 | View/Manage → Mark Topic Completed → teacher + date → Mark | Success + table updates | F | P1 | ❌ Saves but shows "Error marking topic" (BUG-032) |
| TC-SYL-05 | Admin unmarks | T2 | Click undo icon | Unmarked | F | P2 | ✅ (icon has no label) |
| TC-SYL-06 | Teacher finds own class syllabus | T1 | Syllabus tab → find Std 1 Maths chapter 2 | Found in ≤ 15 s | U | P1 | ⚠️ 3 levels of accordions over all classes |
| TC-SYL-07 | Teacher marks done | T1 | Tap "Mark Done" | Tick + success | F | P1 | ✅ (no date choice, no confirm) |
| TC-SYL-08 | Teacher unmarks | T1 | Find how to undo | Clear "Mark not done" | U | P2 | ⚠️ Unlabeled icon; only for own topics |
| TC-SYL-09 | Teacher marks as another teacher | T3 | POST markTopicAsCompleted with `teacherId` of another teacher | Ignored (uses self) | S | P2 | ❌ Accepted (BUG-011) |
| TC-SYL-10 | Teacher deletes syllabus via API | T3 | Teacher token `DELETE /syllabus/delete/:id` | 403 | S | P1 | ❌ Allowed (BUG-011) |
| TC-SYL-11 | Syllabus load time | T3 | Seed 10 classes × 6 subjects × 10 chapters × 8 topics; open teacher Syllabus on Slow 3G | < 3 s to first useful content | P | P2 | ❌ Large single payload (PERF-03) |
| TC-SYL-12 | Progress view | T2 | Look for % complete per subject | Shown | F | P2 | ❌ Missing |
| TC-SYL-13 | Copy syllabus to new year | T2 | Look for copy | Available (wizard) | F | P1 | ❌ Missing |
| TC-SYL-14 | Paste many topics | T2 | Paste 10 lines into a topic box | Becomes 10 topics | U | P3 | ❌ One topic with newlines |

### 2.13 Dashboard and logs — TC-DSH
| ID | Title | Role | Steps | Expected | Type | Pri | Predicted |
|---|---|---|---|---|---|---|---|
| TC-DSH-01 | Numbers correct | T2/T3 | Compare cards to DB counts | Match | D | P1 | ⚠️ Teacher count includes inactive (BUG-053) |
| TC-DSH-02 | Labels understandable | T2 | Ask what "Total Courses" means | Clear | U | P2 | ❌ It's classes |
| TC-DSH-03 | Chart on 1366 px laptop | T2 | Open dashboard | Chart fits | A | P2 | ❌ Fixed 1000 px width overflows with the drawer |
| TC-DSH-04 | Today's pending classes | T2 | Look for "classes not marked today" | Visible | F | P1 | ❌ Missing |
| TC-DSH-05 | Attendance chart vs register | T3 | Compare chart counts with the attendance report for 7 days | Equal | D | P2 | ⚠️ Includes other years' classes; TZ issues |
| TC-LOG-01 | Teacher actions logged | T3 | Teacher marks attendance, edits student, marks topic → check Logs | All present with time | F | P2 | ⚠️ Mostly; admin topic marks missing (BUG-035) |
| TC-LOG-02 | Admin actions visible | T2 | Look for an admin audit log | Available | F | P3 | ❌ Missing |

### 2.14 Language — TC-LANG
| ID | Title | Role | Steps | Expected | Type | Pri | Predicted |
|---|---|---|---|---|---|---|---|
| TC-LANG-01 | Language on login | T1 | Open app logged out | Language choice visible | L | P1 | ❌ None |
| TC-LANG-02 | Switch to Marathi (teacher) | T1 | Me → Marathi | Whole UI in Marathi instantly | L | P1 | ⚠️ Page reloads; Google machine translation; partial/odd terms |
| TC-LANG-03 | Student names not translated | T1 | In Marathi, view the list with English-script names | Names unchanged | L | P1 | ❌ Names get translated/transliterated |
| TC-LANG-04 | Terminology quality | T1 | Native speaker reviews 20 key screens | Natural school words (उपस्थिती, गैरहजर, इयत्ता) | L | P1 | ❌ Machine translation quality |
| TC-LANG-05 | Admin language | T2 | Look for language option in admin | Available | L | P1 | ❌ None |
| TC-LANG-06 | Dates/months localized | T1 | Date picker in Marathi | Marathi month names, DD/MM/YYYY | L | P2 | ❌ English |
| TC-LANG-07 | Server messages | T1 | Trigger "Please fill all the fields" in Marathi | Marathi message | L | P1 | ❌ English (server text) |
| TC-LANG-08 | Works without Google | T3 | Block `cdn.gtranslate.net` | UI still translated | L | P1 | ❌ English only |
| TC-LANG-09 | Gujarati availability | T1 | Look for Gujarati | Consistent with others | L | P3 | ⚠️ In the component list, not in `index.html` config |
| TC-LANG-10 | Layout with long words | T1 | Marathi on 360 px width | No cut-off buttons | L/A | P2 | ⚠️ Fixed widths; likely truncation |

### 2.15 Security (API, by technical tester) — TC-SEC
| ID | Title | Steps | Expected | Pri | Predicted |
|---|---|---|---|---|---|
| TC-SEC-01 | Teacher→admin escalation | Log in as t.sunita (id 1), call `GET /teacher/getAll` with her token | 401/403 | P1 | ❌ Returns admin #1's school teachers (BUG-001) |
| TC-SEC-02 | Teacher deletes a student | t.sunita token → `DELETE /student/delete/<id>` | 403 | P1 | ❌ Deleted via BUG-001 |
| TC-SEC-03 | Public admin list | `curl /admin/getAll` | 401 | P1 | ❌ All admins + hashes |
| TC-SEC-04 | Admin edits another admin | adminA → `PUT /admin/update/<adminB>` new password | 403 | P1 | ❌ Allowed |
| TC-SEC-05 | Cross-tenant read | adminA token → `GET /school/get/<B1>`, `GET /studentTimeline/getAll/<B1 student>` | 403/404 | P1 | ❌ Returned |
| TC-SEC-06 | Cross-tenant write | adminA → `PUT /subject/update/<B1 subject>` | 403/404 | P1 | ❌ Updated |
| TC-SEC-07 | Token tampering | Change one char of JWT | 401 | P1 | ✅ |
| TC-SEC-08 | Deactivated teacher's old token | Deactivate t.rahul while logged in → call API | 401 | P1 | ✅ (tokenVerify checks status) / ❌ for admin routes via BUG-001 |
| TC-SEC-09 | SQL injection in search | `/student/searchName?name=%27%20OR%201=1--` | No leak/error | P1 | ✅ (Sequelize parameterizes) |
| TC-SEC-10 | XSS in names/notes | Student name `<img src=x onerror=alert(1)>` | Rendered as text | P1 | ✅ (React escapes); check PDF export |
| TC-SEC-11 | Upload type bypass | Upload `.html`/`.svg` renamed `.png` as avatar | Rejected or served safely | P2 | ⚠️ Mimetype+ext regex; check S3 content-type |
| TC-SEC-12 | Upload size | 100 MB file | 413 | P2 | ❌ Accepted |
| TC-SEC-13 | CORS | Request from `https://evil.example` origin | Blocked | P2 | ❌ `*` |
| TC-SEC-14 | Security headers | Check response headers | HSTS, X-Content-Type-Options, etc. | P2 | ❌ None (no helmet) |
| TC-SEC-15 | Error leakage | Trigger DB error | Generic message + request id | P2 | ❌ Raw Sequelize message |
| TC-SEC-16 | Secrets in repo | Scan both repos (gitleaks) | No secrets/PII | P1 | ❌ Student PII CSVs in `tmp/csv` (BUG-008) |
| TC-SEC-17 | Crash via bad input | `POST /report/create {}` | 4xx; server still up | P1 | ❌ Process exits (BUG-006) |

### 2.16 Performance — TC-PERF
| ID | Title | Steps | Target | Pri | Predicted |
|---|---|---|---|---|---|
| TC-PERF-01 | First load on Slow 3G | Lighthouse mobile, cleared cache | LCP < 4 s, JS < 300 KB gz | P1 | ❌ CRA bundle + MUI X + GTranslate + 1 s splash |
| TC-PERF-02 | Login to usable home | Stopwatch, mid-range phone on 4G | < 3 s | P1 | ❌ ≥ 3 s from artificial delays alone |
| TC-PERF-03 | Student list 1,000 students | Seed 1,000; open admin Students | < 2 s | P2 | ⚠️ No pagination; JS sorting |
| TC-PERF-04 | Attendance register query | Seed 1 year × 800 students; register for a month | < 1 s | P2 | ❌ No indexes (PERF-01) |
| TC-PERF-05 | Bulk save 40 students | Time the request | < 1 s | P2 | ⚠️ ~120 queries; response before writes |
| TC-PERF-06 | Teacher syllabus big school | See TC-SYL-11 | < 3 s | P2 | ❌ |
| TC-PERF-07 | Auth overhead | Measure DB queries per request (SQL logging) | ≤ 1 | P3 | ❌ 2–3 |
| TC-PERF-08 | Server restart time | Restart API with prod-size DB | < 10 s | P3 | ❌ `sync({alter})` slows boot |
| TC-PERF-09 | Concurrency smoke | k6: 50 virtual teachers saving attendance in 1 min | 0 errors, p95 < 800 ms | P2 | ❌ Races/unhandled rejections |

### 2.17 Accessibility and compatibility — TC-A11Y
| ID | Title | Steps | Expected | Pri | Predicted |
|---|---|---|---|---|---|
| TC-A11Y-01 | Text size | Android font size "Large" | Layout holds; text ≥ 16 px | P2 | ⚠️ Many 12–14 px texts; fixed widths |
| TC-A11Y-02 | Touch targets | Measure icons on teacher screens | ≥ 48×48 px | P1 | ⚠️ Some icons small (undo, edit) |
| TC-A11Y-03 | Contrast | Lighthouse a11y / axe | No contrast failures | P2 | ❌ Translucent cards over background |
| TC-A11Y-04 | Icon-only buttons | Screen reader / ask tester | All have labels | P1 | ❌ Many unlabeled icons |
| TC-A11Y-05 | Admin on phone | Admin pages at 390 px | Usable | P2 | ❌ Drawer + 650 px tables |
| TC-A11Y-06 | Browsers | Chrome Android, Safari iOS, Chrome/Edge desktop | All core flows work | P1 | ⚠️ Date pickers/HEIC differ on iOS |

### 2.18 Task-based UX sessions with non-technical testers — TC-UX
Run each task **without help**. Record time, number of wrong taps, ease (1–5), and quotes. Success means the task was finished correctly within the target time.

| ID | Task given to the tester (read aloud in their language) | Target time | Success criteria | Predicted |
|---|---|---|---|---|
| TC-UX-01 | "Log in with this email and password." | 60 s | On home | ⚠️ Admin tab default |
| TC-UX-02 | "Change the app language to Marathi." | 30 s | UI in Marathi | ❌ Hidden in My Info; not on login |
| TC-UX-03 | "Take today's attendance for Std 1. Ravi and Pooja are absent." | 90 s | 38 P, 2 A saved | ❌ |
| TC-UX-04 | "You marked Ravi absent by mistake. Fix it." | 45 s | Ravi P, single record | ⚠️ |
| TC-UX-05 | "A new girl, Kavya, joined Std 1. Her mother's phone is 98xxxxxx10. Add her." | 2 min | Saved with phone | ❌ No phone field in add form |
| TC-UX-06 | "Find Kavya and add her photo." | 90 s | Photo shown | ⚠️ |
| TC-UX-07 | "Write today's class note 'Learned numbers 1–20' with a photo for everyone present." | 2 min | Note on each present child | ⚠️ Bulk needs subject selection, reloads |
| TC-UX-08 | "Mark the Maths topic 'Addition' as taught today." | 60 s | Topic done | ⚠️ Deep accordions |
| TC-UX-09 | (Admin) "Which classes have not taken attendance today?" | 60 s | Correct answer | ❌ No such view |
| TC-UX-10 | (Admin) "Print last month's attendance register for Std 1." | 2 min | Printable grid | ❌ No register |
| TC-UX-11 | (Admin) "Start the new academic year 2026-27 and move Std 1 children to Std 2." | 15 min | Done correctly | ❌ Hours of manual work |
| TC-UX-12 | (Admin) "Show me Ravi's attendance from last year." | 60 s | Correct | ❌ Impossible from UI |
| TC-UX-13 | (Admin) "Add a new teacher and tell her how to log in." | 3 min | Teacher can log in | ⚠️ Password handling unclear |
| TC-UX-14 | (Admin) "Rename class 'Std 3' to 'Std 3A'." | 60 s | Renamed | ❌ No rename |

**Satisfaction questionnaire after the session** (1–5): easy to learn · confidence that data is saved · language understood · would use daily · plus: "What was the most confusing thing?" and "What one thing should we change first?"

---

## 3. Future regression cases (for features introduced by the plan)

These are written now so that each new feature has acceptance tests on day one.

| ID | Feature | Test |
|---|---|---|
| TC-ROLL-01 | Rollover wizard | Create 2026-27 from 2025-26 with copy classes+subjects+syllabus; verify counts equal, completions reset, teachers assigned |
| TC-ROLL-02 | Promotion | 40 students Std 1 → Std 2 except 2 detained, 1 left; verify enrollments, statuses, and single student identity |
| TC-ROLL-03 | Idempotency | Run the wizard twice (double click / network retry) → no duplicates |
| TC-ROLL-04 | Read-only past year | After switch, editing 2025-26 attendance is blocked for teachers, allowed for admin with logged "unlock" |
| TC-ROLL-05 | Year switcher | Switch header to 2025-26 → every list/report shows 2025-26 data, banner visible; switch back |
| TC-ROLL-06 | Student history | Student profile shows both years with class, attendance %, reports |
| TC-ATT2-01 | New attendance screen | All present by default; tap 2 → Save; counter matches; one request; < 45 s |
| TC-ATT2-02 | Offline queue | Save offline → reconnect → synced once; indicator clears |
| TC-ATT2-03 | Lock window | Day 8 edit blocked for teacher, allowed for admin |
| TC-I18N-01 | No literal strings | ESLint i18n rule passes; i18next-parser reports 0 missing keys in all 4 locales |
| TC-I18N-02 | Pseudo-locale | `?lng=pseudo` shows no untranslated strings and no clipped layouts |
| TC-I18N-03 | Persisted preference | Change language on phone → log in on desktop → same language |
| TC-I18N-04 | PDF in Marathi | Register PDF shows Marathi labels and names correctly |
| TC-SEC2-01 | Scope matrix | Automated test: every endpoint × {other-org admin, teacher, no token} returns 401/403/404 |
