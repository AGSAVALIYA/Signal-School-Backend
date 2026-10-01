# 02 — Personas and User Stories

Each story has acceptance criteria that can be tested, a **current status** taken from the code review, and links to inventory/issue IDs. Stories marked 🚫 are new features needed for a school management system focused on attendance and the academic year.

Status: ✅ meets the story · ⚠️ partly / buggy · ❌ broken · 🚫 missing.
Priority (MoSCoW): **M** must · **S** should · **C** could · **W** won't now.

---

## 1. Personas

| ID | Persona | Profile | Device and context | What they need most |
|---|---|---|---|---|
| P1 | **Sunita, class teacher** | 45 years old, studied in Marathi, uses WhatsApp and YouTube, nervous about "apps". Class of 35–45 children. | Low-end Android (5.5", 2–3 GB RAM), patchy 3G/4G, sometimes no signal in class. | Take attendance in under 1 minute, in Marathi, with big buttons, and be sure it saved. |
| P2 | **Rahul, subject teacher** | 28, comfortable with phones. Teaches Maths to 4 classes. Hindi/English. | Mid-range Android. | Mark syllabus topics done across classes quickly. Write the day's learning note once for the whole class. |
| P3 | **Mrs. Kulkarni, principal / school admin** | 50, uses a laptop for reports, a phone for checks. Answers to trustees and the education department. | Laptop (Chrome) + phone. | Know which classes took attendance today. Monthly registers. Start the new academic year without re-typing everything. |
| P4 | **Office clerk** | Does admissions, keeps the GR register in Excel. | Desktop. | Bulk import, Excel export, correct GR numbers. |
| P5 | **Trust / organization owner** | Runs several schools (e.g., schools for children living near traffic signals, where many children lack documents and attendance is irregular). | Laptop / phone. | Compare schools. Keep data safe and private. Control who is admin. |
| P6 | **Parent / guardian** (future) | Often low literacy, has a basic phone. | SMS/WhatsApp. | Know if the child was absent and how they are progressing. |

> Context note: in schools serving migrant or street-connected children, many children **don't know their exact date of birth** and have no Aadhaar. Forms must allow "approximate age / birth year" and treat documents as optional. This explains why the current model stores `age`; the new model keeps an *estimated birth year* instead of a stale age number.

---

## 2. Epics and stories

### E1 — Access, language and session

| ID | Story | Acceptance criteria | Pri | Status | Links |
|---|---|---|---|---|---|
| US-101 | As **Sunita**, I want to pick my language on the login screen so that I understand the app from the first screen. | Language buttons in native script (English, हिंदी, मराठी, ગુજરાતી) are visible before login. • The choice persists on this device. • After login it is saved to my profile and used on any device. | M | ❌ | M21, BUG-067 |
| US-102 | As **Sunita**, I want every label, button, message, date and number in my language so that I never guess. | 100% of UI strings come from translation files (lint rule passes). • Server errors arrive as codes and are translated. • Dates show DD/MM/YYYY with local month names. • Student names are never machine-translated. | M | ❌ | §06 |
| US-103 | As a **teacher**, I want one simple login (email or mobile + password) without choosing "Teacher/Admin" so that I can't pick the wrong tab. | A single form. The server works out the role. • Enter key submits. • Show/hide password. • Wrong password shows a persistent message in my language. | M | ⚠️ | PG-02, M01 |
| US-104 | As a **teacher**, I want to stay logged in on my phone for a long time but be told clearly when I must log in again. | Session lasts ≥ 30 days on a trusted device (refresh token). • On expiry: redirect to login with "Your session ended, please log in again". • No empty screens. | M | ❌ | BUG-044 |
| US-105 | As a **teacher**, I want to change my own password, and be forced to on first login with a temporary password. | "Change password" in Me. • First-login screen if `mustChangePassword`. • Rule: ≥ 8 chars, shown in my language. | M | 🚫 | BUG-009 |
| US-106 | As an **admin**, I want to reset a teacher's password and get a temporary one I can share on WhatsApp. | "Reset password" → shows a temp password once + "Copy"/"Share" button. • Teacher must change it at next login. | S | ⚠️ | API-23 |
| US-107 | As a **teacher who forgot my password**, I want to recover access without calling the office. | "Forgot password" → OTP to registered mobile/email → set new password. (Could: admin-assisted reset only in v1.) | C | 🚫 | — |
| US-108 | As the **org owner**, I want only invited people to become admins so that strangers can't register. | No public register link. • Invite by email/mobile with role. • Invite expires in 7 days. | M | ❌ | BUG-005 |

### E2 — Onboarding and school setup

| ID | Story | Acceptance criteria | Pri | Status | Links |
|---|---|---|---|---|---|
| US-201 | As a **new admin**, I want a step-by-step setup checklist (Organization → School → Academic year → Classes → Subjects → Teachers → Students) so that I know what to do next. | Checklist card on dashboard with ticks and "Do this next" buttons. • Disappears when complete. | S | 🚫 | M03, M04 |
| US-202 | As an **admin**, I want to view and edit my organization and school profiles (with logo) so that the details stay correct. | Profile pages with edit. • Logo upload used in header and PDFs. | S | ⚠️ | PG-11, PG-12 |
| US-203 | As the **org owner**, I want to manage several schools and switch between them easily, seeing only my own organization's schools. | School switcher lists only own-org schools. • Cross-org access is impossible (tested). | M | ❌ | BUG-004 |
| US-204 | As an **admin**, I want to archive a school instead of deleting it so that history is preserved. | "Archive" hides it from switchers. • Data kept. • Restore possible. | C | 🚫 | API-16 |

### E3 — Academic year lifecycle (focus area)

| ID | Story | Acceptance criteria | Pri | Status | Links |
|---|---|---|---|---|---|
| US-301 | As the **principal**, I want a "Start new academic year" wizard so that next year is ready in minutes, not days. | The wizard pre-fills name/dates (+1 year). • Copies grades/sections, subjects, syllabus (completion reset) and teacher assignments with checkboxes. • Runs in one transaction. • Can be saved as "planned" before switching. | M | 🚫 | §07, M05 |
| US-302 | As the **principal**, I want to promote all students of a class to the next class in one go, and mark only the exceptions (detained / left / graduated). | Per class: list with default "Promote to <next grade>". • Per-student override. • Bulk select. • Summary counts before confirm. • Each student keeps one identity with a new enrollment row. | M | 🚫 | DM09, CMP-21 |
| US-303 | As the **principal**, I want to choose the day the new year becomes current, and have last year become read-only. | "Make current now / on start date". • Closed year: edits blocked except for admins after "Unlock for corrections" (logged). | M | ⚠️ | API-43 |
| US-304 | As **any user**, I want a year selector in the header so that I can look at last year's classes, students, attendance and syllabus. | Selector lists years (current first). • Past year shows a yellow banner "Viewing 2025-26 – read only · Back to current". • All lists and reports respect it. | M | 🚫 | M05 |
| US-305 | As a **teacher**, I want to open a student and see their full history across years (classes, attendance %, reports, notes). | "History" tab grouped by year with class, attendance %, report grades, link to timeline. | S | 🚫 | DM09 |
| US-306 | As an **admin**, I want to correct a year's name/dates, and be stopped from deleting a year that has data. | Edit works. • Delete shows the reason "Year has 12 classes / 410 students – archive instead". • Confirm dialog for empty years. | M | ❌ | BUG-015, BUG-016 |
| US-307 | As an **admin**, I want new admissions during the year to go into the current year automatically. | Add-student form defaults to the current year and an active class section. | M | ✅ | API-27 |
| US-308 | As an **admin**, I want to take in mid-year transfers and record children who leave (with date and reason) without deleting them. | "Mark as left" with date + reason (migrated, dropped out, transferred, TC issued). • They disappear from attendance lists from that date. • They stay in reports. | M | ❌ | BUG-014 |

### E4 — Classes and subjects

| ID | Story | Acceptance criteria | Pri | Status | Links |
|---|---|---|---|---|---|
| US-401 | As an **admin**, I want to see all classes of the year with their subjects on one screen and add/rename/delete/reorder them inline. | Table: class → subjects chips. • Inline rename. • Delete blocked if students exist (shows count). • Drag to reorder. | M | ❌ | PG-15, BUG-020/021 |
| US-402 | As an **admin**, I want permanent grades (e.g., "Balwadi, Std 1 … Std 10") with a defined "next grade" so that promotion is automatic. | Grades page with order + next grade + final grade flag. | M | 🚫 | DM06 |
| US-403 | As an **admin**, I want class/subject names to optionally have translations so that Marathi users see "इयत्ता ५" while English users see "Std 5". | Optional translation fields per language. • Falls back to the base name. | C | 🚫 | §06 |
| US-404 | As an **admin**, I want "Activities" (old "common subjects") like Dance or Computer, assigned to many students at once. | Rename in UI. • Bulk assign by class with checkboxes. | C | ⚠️ | M08 |

### E5 — Teachers, roles and assignments

| ID | Story | Acceptance criteria | Pri | Status | Links |
|---|---|---|---|---|---|
| US-501 | As an **admin**, I want to add a teacher with name + mobile/email and get a temporary password to share. | Validation of email/mobile format + uniqueness with a friendly message. • Temp password shown once. | M | ⚠️ | API-19 |
| US-502 | As an **admin**, I want to assign a class teacher and subject teachers to each class so that teachers see their own classes first. | Assignment screen per class or per teacher. • Teacher home shows assigned classes on top, then "Other classes". | M | 🚫 | M24 |
| US-503 | As an **admin**, I want to deactivate and later reactivate a teacher, and see the inactive list. | Tabs Active/Inactive. • Reactivate button. • Inactive users can't log in (existing tokens rejected). | M | ⚠️ | API-26 |
| US-504 | As the **org owner**, I want roles (Owner, Admin/Principal, Clerk, Teacher) with sensible permissions. | Permission matrix enforced in the API. • Clerk can manage students but not teachers/years. | S | 🚫 | M25 |
| US-505 | As an **admin**, I want to see what each user did (who marked attendance, who edited a student). | Audit page with filters by user/date/action. • Before/after for edits. | S | ⚠️ | M19 |
| US-506 | As a **teacher working in two schools of the trust**, I want to switch school from my profile with the same login. | Switch works. • Data reloads for that school. | C | ❌ | BUG-055, BUG-061 |

### E6 — Students

| ID | Story | Acceptance criteria | Pri | Status | Links |
|---|---|---|---|---|---|
| US-601 | As **Sunita**, I want to add a new child with only the essentials (name, class, gender, guardian name, guardian mobile) and fill the rest later. | Required: name, class. • Optional: everything else. • DOB **or** approximate age. • Saves in < 2 s. • Friendly field errors. | M | ⚠️ | CMP-21/44 |
| US-602 | As the **clerk**, I want GR numbers generated automatically in the school's format, or to type an existing GR, and never get duplicates. | Unique per school (DB constraint). • Format from school settings (prefix + number). • Duplicate shows "GR 1234 already belongs to <name>". | M | ❌ | BUG-012 |
| US-603 | As the **clerk**, I want to import students from Excel/CSV with a preview and errors per row before saving. | Download template (all fields, instructions in my language). • Upload → preview table with ✔/✖ per row and reasons. • Import only valid rows. • Report downloadable. | M | ❌ | BUG-013, M12 |
| US-604 | As a **teacher**, I want to view and edit a student's profile in clear sections (Child, Parents, Documents, Health). | Card sections. • Edit/Save buttons with labels. • Validation. • Stays in edit mode on error. | M | ⚠️ | BUG-043 |
| US-605 | As a **teacher**, I want to add a photo from the camera, and have it upload quickly even on slow internet. | Camera capture on mobile. • Compressed to ≤ 200 KB before upload. • Progress indicator. • HEIC supported. | S | ⚠️ | PERF-12 |
| US-606 | As an **admin**, I want to search and filter students by name, GR, class and status, and export the list to Excel. | Server-side search (debounced). • Exact class filter. • Export .xlsx in UTF-8 (Devanagari safe). | M | ❌ | BUG-041, M26 |
| US-607 | As the **principal**, I want sensitive data (Aadhaar) masked and photos private. | Aadhaar shown as XXXX-XXXX-1234. • Full number visible only to admin with a reason. • Photos via signed URLs. | S | 🚫 | BUG-064 |

### E7 — Attendance (focus area)

| ID | Story | Acceptance criteria | Pri | Status | Links |
|---|---|---|---|---|---|
| US-701 | As **Sunita**, I want to open the app and see "Take attendance – Std 3A (not done yet)" as the first thing. | Teacher home "Today" shows assigned classes with status Not taken / Done 38/40. • One tap opens attendance. | M | 🚫 | PG-30, PG-31 |
| US-702 | As **Sunita**, I want all children marked **Present** by default and to tap only the absent ones, then press one big **Save**. | Big rows with photo + name + roll no. • Tap toggles P → A (→ Leave optional). • Live counter "Present 38 · Absent 2". • Save button always visible. • Confirmation "Saved ✔ 10:42" + vibration. • Takes ≤ 45 s for 40 children. | M | ⚠️ | M13, BUG-025 |
| US-703 | As **Sunita**, I want to fix today's attendance if I made a mistake. | Re-opening shows saved statuses. • Saving again updates (no duplicates). • Edit history kept. | M | ⚠️ | BUG-026 |
| US-704 | As **Sunita**, I want to take attendance with no network and have it sync later. | Offline banner. • Save stores locally. • Auto-sync when online. • "Waiting to upload (1)" indicator. • Conflict rule: latest edit wins + audit. | S | 🚫 | PERF-13 |
| US-705 | As the **principal**, I want to stop attendance for future dates and lock it after N days. | Future dates disabled. • Past edits allowed for the class teacher up to 7 days (configurable). • Admin can always edit (logged). | S | 🚫 | — |
| US-706 | As the **principal**, I want to set holidays and Sundays so that they don't count as absent. | School calendar with weekly offs + holidays. • Attendance screen says "Holiday – Diwali". • Excluded from %. | S | 🚫 | FG-03 |
| US-707 | As the **principal**, I want a monthly attendance register (students × days) per class, with totals and % that I can print or export. | Grid with P/A/L/H. • Totals per student and per day. • % column. • PDF (Indic fonts) and Excel. • Unmarked days are visible. | M | ⚠️ | M14, BUG-056, BUG-068 |
| US-708 | As the **principal**, I want today's school-wide view: which classes have not taken attendance, overall %, list of absentees. | Dashboard card with each class status. • Click a class to see absentees with guardian phone. | M | 🚫 | M18 |
| US-709 | As the **principal**, I want to see children with low attendance (e.g., < 75% this month or 3+ consecutive absences). | "At-risk" list with filters. • Export. | S | 🚫 | FG-05 |
| US-710 | As a **parent**, I want an SMS/WhatsApp when my child is absent. | Opt-in per school. • Template in parent's language. • Sent once per day after attendance closes. | C | 🚫 | FG-12 |
| US-711 | As the **principal**, I want "Late" and "On leave" statuses as well as Present/Absent. | Status enum. • Shown with distinct colours **and** letters (colour-blind safe). | C | 🚫 | DM12 |

### E8 — Daily learning log (timeline)

| ID | Story | Acceptance criteria | Pri | Status | Links |
|---|---|---|---|---|---|
| US-801 | As **Rahul**, I want to write what the class learned today once, attach one photo, and have it appear on every present child's timeline. | "Class note" form (subjects optional). • Saved once (class-level). • Shown on each child's timeline. | S | ⚠️ | M15, DM11 |
| US-802 | As a **teacher**, I want to add a personal note for one child (e.g., "read a full paragraph today"). | Per-student note. • One per child per day per author, editable. | S | ⚠️ | API-54 |
| US-803 | As a **teacher**, I want to edit or delete my own note. | Author can edit/delete within the year. • Admin can delete any (confirm). | S | ❌ | BUG-027 |

### E9 — Syllabus and progress

| ID | Story | Acceptance criteria | Pri | Status | Links |
|---|---|---|---|---|---|
| US-901 | As an **admin**, I want to create chapters and topics per subject quickly (paste a list, one topic per line). | Multi-line paste → topics. • Reorder by drag. • Rename without losing progress. • Delete with confirm. | M | ❌ | BUG-030, BUG-031 |
| US-902 | As **Rahul**, I want to see my classes → subjects with a progress bar, and tick topics as done with today's date (changeable). | Progress % per subject. • Checklist. • Date picker defaults to today. • Undo with a clear "Mark not done" label. | M | ⚠️ | PG-35 |
| US-903 | As the **principal**, I want a syllabus progress report by class/subject/teacher. | Table with % and last-updated date. • Export. | S | ⚠️ | PG-16 |
| US-904 | As the **principal**, I want next year's syllabus copied from this year automatically. | Part of rollover (US-301). | M | 🚫 | §07 |

### E10 — Assessments and report cards

| ID | Story | Acceptance criteria | Pri | Status | Links |
|---|---|---|---|---|---|
| US-1001 | As a **teacher**, I want to enter term grades/remarks for all students of a class subject in one grid. | Grid: students × (grade, remark). • Saves per row. • Shows existing values. | S | ❌ | M16, BUG-028 |
| US-1002 | As the **principal**, I want printable report cards per student/term in the school's language. | PDF with logo, grades, attendance %, remarks. • Indic fonts. | C | 🚫 | FG-08 |
| US-1003 | As an **admin**, I want the student profile's Academics tab to show real grades only. | Dummy data removed. • Real entries per year. | M | ❌ | BUG-029 |

### E11 — Dashboard, reports and exports

| ID | Story | Acceptance criteria | Pri | Status | Links |
|---|---|---|---|---|---|
| US-1101 | As the **principal**, I want a dashboard with today's attendance, classes pending, syllabus progress and recent admissions. | Cards + mini charts. • Responsive. • Correct labels. | S | ⚠️ | PG-10, BUG-053 |
| US-1102 | As the **org owner**, I want to compare schools (students, attendance %, syllabus %). | Org dashboard across schools. | C | 🚫 | FG-10 |
| US-1103 | As the **clerk**, I want exports for government formats (student list, register, UDISE-style fields). | Excel exports with configurable columns. | S | 🚫 | M26 |

### E12 — Reliability, safety and audit

| ID | Story | Acceptance criteria | Pri | Status | Links |
|---|---|---|---|---|---|
| US-1201 | As the **org owner**, I want our children's data protected from other organizations and the public. | All endpoints authenticated + scoped (automated tests per endpoint). • No password hashes in any response. | M | ❌ | BUG-001..005 |
| US-1202 | As **everyone**, I want the app to stay up even if someone submits a bad form. | No unhandled rejections. • Global error handler. • Uptime monitor. | M | ❌ | BUG-006 |
| US-1203 | As the **org owner**, I want daily backups and the ability to restore. | Automated daily DB backup kept 30 days. • Restore runbook tested quarterly. | M | 🚫 | FG-14 |
| US-1204 | As an **admin**, I want every destructive action to ask for confirmation and to be undoable where possible. | Confirm dialogs naming the item. • Soft deletes. • "Undo" toast for 10 s on deletes. | M | ⚠️ | BUG-015, BUG-014 |

---

## 3. Coverage summary

| Epic | Stories | ✅ | ⚠️ | ❌ | 🚫 |
|---|---|---|---|---|---|
| E1 Access & language | 8 | 0 | 2 | 4 | 2 |
| E2 Onboarding | 4 | 0 | 1 | 1 | 2 |
| E3 Academic year | 8 | 1 | 1 | 2 | 4 |
| E4 Classes & subjects | 4 | 0 | 1 | 1 | 2 |
| E5 Teachers & roles | 6 | 0 | 3 | 1 | 2 |
| E6 Students | 7 | 0 | 3 | 3 | 1 |
| E7 Attendance | 11 | 0 | 3 | 0 | 8 |
| E8 Daily log | 3 | 0 | 2 | 1 | 0 |
| E9 Syllabus | 4 | 0 | 2 | 1 | 1 |
| E10 Assessments | 3 | 0 | 0 | 2 | 1 |
| E11 Dashboard & exports | 3 | 0 | 1 | 0 | 2 |
| E12 Reliability | 4 | 0 | 1 | 2 | 1 |
| **Total** | **65** | **1** | **20** | **18** | **26** |

The core "must" path for a non-technical teacher is US-101, 102, 103, 104, 701, 702, 703 and 601. Today none of them fully meets its acceptance criteria. That is the main reason to prioritize Phases 1–3 of the plan.
