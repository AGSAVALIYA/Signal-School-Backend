# 04 — Walkthrough as a Non-Technical User, and UX Recommendations

This is a simulated walkthrough. The current app is reviewed through the eyes of **Sunita** (teacher, P1) and **Mrs. Kulkarni** (principal, P3), screen by screen, as they would really use it. Each step records what they see, what they feel, and what to change. In the next round, a real teacher repeats these journeys (TC-UX-01…14) to confirm or correct these notes.

---

## 1. Journey A: Sunita's first morning (teacher, Android phone, Marathi speaker)

| # | Step / screen | What Sunita sees | What she feels or says | Recommendation |
|---|---|---|---|---|
| A1 | Opens link | Logo + spinner for about 1 s | "Is it loading or stuck?" | Remove the artificial delay. Show the login immediately. |
| A2 | Login screen | "Admin Login" heading, tabs Teacher / **Admin** (Admin selected), "Username", "Password", Login | "Admin? I'm not an admin. What's my username — is it my email?" Everything is in English. | One login form. Language choice in big native-script buttons at the top. Field "Email or mobile number". Big Login button. Enter submits. |
| A3 | Wrong password | Red English message at the top, gone after 2 s | "Something red flashed. What did it say?" | Message under the field, in her language, stays until she types again. |
| A4 | After login | 2 s "Login successful", then the **My Info** profile page | "Why am I seeing my own name? Where are my children?" | Land on **Today**: "Good morning Sunita · Std 1A · Attendance: not taken · [Take attendance]". |
| A5 | Looks for Marathi | Has to find "Translate" inside My Info. Taps Marathi → page reloads → Google translation | "Some words are odd: 'वर्ग' sometimes, 'क्लास' elsewhere. My students' names changed spelling!" | Real translations reviewed by teachers. Names never translated. No reload. |
| A6 | Bottom tabs | Syllabus · Class · My Info | "'Class' must be my class." | Tabs: **Today · Classes · Syllabus · Me**, with icons + labels in her language. |
| A7 | Class list | Class names with two icons each (✔ circle, person cards) | "Which one is attendance? I'll try the first… oh, it's coloured names." | Replace icons with two labelled buttons, "Attendance" and "Students". Show status "✔ 38/40 done" or "Not taken". |
| A8 | Attendance (chips) | Grey name chips + search + "Bulk" button | "Grey means what? Do I tap every name?" | New Take Attendance screen (see §4.2). |
| A9 | Taps a chip | "Daily Report" dialog: big "What did the student learn today?" box, Upload Photo, Select Date, Select Subjects, then Cancel/Present/Absent at the bottom | "I only want to say she's here. Do I have to write something? Is the date already today?" 40 children × this dialog = frustration. | Attendance = one tap per child. The learning note is a separate optional step after saving. |
| A10 | Presses Present | Dialog closes. Chip turns green. | "Did it save? What if the network failed?" (Failures are silent.) | Batch save with a clear "Saved ✔ 10:42 · 38 present, 2 absent" banner + vibration. A failure shows a red banner with "Try again". |
| A11 | Tries "Bulk" | Full-screen form: note, photo, date, Select Subjects (required), Select All, list with checkboxes, Save | "Why must I pick subjects for attendance? I selected the ones present — what happens to the absent ones?" (Nothing is recorded for them.) After Save: message, then the whole page reloads. | Remove "Bulk" when the new screen exists. |
| A12 | Adds a new student (FAB +) | Round + button. Dialog tabs "New Student / From Previous A.Y.", fields Name, Class, Age, DOB, Address, Submit | "What is A.Y.? Why age and birth date both? She doesn't know her birth date. Where do I put her mother's phone?" | "Add student" form: Name*, Class*, Gender, Guardian name, Guardian phone, Birth date **or** approx. age, Address (optional). "From last year" isn't needed (promotion handles it). |
| A13 | Student detail | Coloured header with photo, tabs Details/Timeline, table of fields, pencil to edit | "The pencil means edit? I pressed Save and it closed, so I think it saved." | Labelled "Edit" button. A sticky "Save changes" bar. Stay in edit mode if it fails. Group fields into cards. |
| A14 | Syllabus tab | Accordion of **all** classes → subjects → chapters → topics with blue "Mark Done" | "I teach only Std 1. Too many folders. Undo is a strange icon." | "My classes" first. Subject cards with a progress bar. A topic checklist with a date and a clear "Mark not done". |
| A15 | Network drops in class | Requests fail silently | "It showed green but was it saved?" | Offline mode with a queue and an indicator (Phase 6). Until then, clear failure messages. |
| A16 | Logout | Red Logout at the bottom of My Info | OK | Keep, plus "Are you sure?" |

**Estimated time for Sunita's daily core task (attendance for 40 children):** 4–6 minutes today, with uncertainty about whether it saved. **Target:** under 45 seconds, with certainty.

---

## 2. Journey B: Mrs. Kulkarni sets up a school and runs the year (admin, laptop)

| # | Step / screen | Observation | Feedback | Recommendation |
|---|---|---|---|---|
| B1 | Register | Admin tab → "Need to register?" | "Anyone can do this?" | Invite-only. A super-admin creates the org owner. |
| B2 | Create organization | Simple form | OK | Merge into an onboarding wizard with progress steps. |
| B3 | Create school | Simple form; then the School page | "Now what?" | Setup checklist (Year → Classes → Subjects → Teachers → Students). |
| B4 | Academic year | At the bottom of the School page: Add Academic Year modal with HTML date inputs | "Dates show 06/01/2025, is that 6 January?" Delete is right next to "Set Current Year". | Own "Academic Years" page. DD/MM/YYYY. Delete hidden under ⋮ with confirmation, and blocked if data exists. |
| B5 | Settings | Vertical tabs "Class Form / Subject Form / Common Subject Form" | "Form? I want to *see* my classes." Lists can't be edited. | One "Classes & Subjects" page as a table, with inline add/rename/delete and drag to order. |
| B6 | Add teachers | Teachers → floating + → name/email/password | "If I leave the password empty, what is it?" (It's the email.) | Generate a temporary password, show it once with "Copy / Share on WhatsApp". Force a change on first login. |
| B7 | Teacher list filter | "Class: 1st Grade…" | Page goes white (crash). | Remove. Add Active/Inactive tabs and search. |
| B8 | Add students | Same dialog as teacher; no import button | "I have 300 children in Excel." | Import page with preview. |
| B9 | Student list | Table with photo, name, class, **Absent** for everyone (morning), Edit icon | "Everyone absent? Oh, teachers haven't marked yet." | "Not marked" status. Summary bar "Present 210 · Absent 12 · Not marked 3 classes". |
| B10 | Student profile | Tabs Info/Timeline/Academics. Academics shows Maths A, Science B… for every child | "These grades are wrong!" | Remove the dummy data now. Real reports later. |
| B11 | Attendance page | Pick start/end date + class + "Get Attendance" → tables per day; Export PDF | "I need the monthly register like the paper one, with totals." | Register grid (students × days), totals, %, PDF/Excel in the school's language. |
| B12 | Syllabus page | Select class, subject; tabs Add / View-Manage | Delete doesn't work. Editing a chapter wiped ticks. "Mark Topic Completed" says error. | Fix bugs. Single page with a chapter list, inline topics and a progress column. |
| B13 | Dashboard | 4 number cards + "Topic-Attendance" bar chart | "'Total Courses' means? What should I act on?" | Today's attendance status per class, absentees, syllabus progress, birthdays, setup checklist. |
| B14 | **End of year** | No feature. She must create a year, set it current, recreate classes, subjects and syllabus, then re-add every student via "From Previous A.Y." one by one (copying only name, age, DOB, address, GR) | "This will take me two days, and last year's data vanishes from view." | **Rollover wizard + promotion screen + year switcher** ([07](07-academic-year-design.md)). |
| B15 | Looking at last year | No year selector anywhere except Settings class list | "Parents ask about last year's attendance. I can't show it." | Global year switcher with a read-only banner. Student History tab. |

---

## 3. Cross-cutting UX findings

| ID | Finding | Where | Why it matters for non-technical users | Recommendation |
|---|---|---|---|---|
| UX-01 | **Icon-only actions** | Class list, syllabus undo, edit pencils, photo buttons, FABs | Icons mean nothing to first-time users and don't translate. | Icon + text label everywhere on teacher screens. Tooltips on desktop. |
| UX-02 | **Messages vanish in 2 s** | 44 alert blocks | Slow readers miss them. | Snackbar 6 s+ with close for success. Errors persist inline. |
| UX-03 | **No "did it save?" certainty** | Attendance, student edit, reports | Teachers lose trust and redo work. | Explicit saved state with time. Disable the button while saving. Show errors with retry. |
| UX-04 | **English technical words** | "A.Y.", "Common Subject", "Bulk", "Timeline", "Form", "GR Number" | Confusing even in English. | Glossary of plain terms ([06 §5](06-multilingual-design.md)): "Last year's student", "Activities", "Whole class", "Daily diary", "Register number". |
| UX-05 | **Too many fields at once** | Add student, daily report dialog | Overwhelming. | Progressive disclosure: essentials first, "More details" collapsed. |
| UX-06 | **Full page reloads** | Bulk attendance, teacher deactivate, CSV upload, login | Lost context, slow on 3G. | Update in place. |
| UX-07 | **Colour-only status** | Attendance chips | Colour-blind users or sunlight glare. | Letters P/A/L + icons + colour. |
| UX-08 | **Desktop-only admin** | Drawer, 650 px tables, 1000 px chart | Principals check on phones. | Responsive admin: bottom nav or hamburger on mobile. Card lists instead of tables. |
| UX-09 | **Inconsistent patterns** | Teacher vs admin forms (gender select vs text), different delete behaviours | Learning one screen doesn't help with the next. | One design system: shared components, consistent placement (primary action bottom-right/full-width on mobile). |
| UX-10 | **Small text and touch targets** | Chips 15 px, small icons | Older teachers, cheap screens. | Base 16–17 px, targets ≥ 48 px, high contrast, no translucent cards over images. |
| UX-11 | **No empty-state guidance** | Lists with "No students" | Users don't know the next step. | Empty states with an illustration + "Add first student" button. |
| UX-12 | **Destructive actions too easy** | Delete year (no confirm), delete timeline (no confirm), red Delete next to Edit | Data loss. | Confirm dialogs naming the item, soft delete, undo toast. |
| UX-13 | **Misspellings** | "Attendence", "Subjectes" | Hurts credibility. | Fix. |
| UX-14 | **Hidden language switch** | Teacher My Info only | Users who need it most can't find it. | On login + in header/Me + remembered per user. |
| UX-15 | **No help** | Everywhere | Nobody to ask in the classroom. | A short "How to" card on each main screen + a 60-second video per task in each language (link from Me → Help). |

---

## 4. Redesign sketches for the key teacher screens

These are low-fidelity wireframes. Strings are shown in English, but every one goes through i18n.

### 4.1 Teacher "Today" (new home)
```
┌─────────────────────────────────────┐
│  नमस्कार, सुनिता 👋   [मराठी ▾]      │
│  Thursday, 2 Oct 2026 · 2026-27      │
├─────────────────────────────────────┤
│  MY CLASSES                          │
│ ┌─────────────────────────────────┐ │
│ │ Std 1 A  (Class teacher)        │ │
│ │ Attendance:  ● Not taken        │ │
│ │ [  ✔ Take attendance  ]          │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Std 3 B · Maths                 │ │
│ │ Attendance: ✔ Done 31/33 (Rahul)│ │
│ │ Syllabus 42% ▓▓▓▓░░░░░          │ │
│ └─────────────────────────────────┘ │
│  [ + Add student ]  [ ✎ Class note ] │
├─────────────────────────────────────┤
│ 🏠 Today  👥 Classes  📖 Syllabus  👤 Me │
└─────────────────────────────────────┘
```

### 4.2 Take attendance (core screen)
```
┌─────────────────────────────────────┐
│ ← Std 1 A · Attendance   📅 Today ▾  │
│ Present 38   Absent 2   Leave 0      │
│ [All present]  🔍 Search             │
├─────────────────────────────────────┤
│ 01 (photo) Aarav Pawar        [ P ] │  ← tap toggles P → A → L → P
│ 02 (photo) Bhakti Shinde      [ P ] │
│ 03 (photo) Chetan More        [ A ] │  (red, letter A)
│ …                                    │
├─────────────────────────────────────┤
│ [        💾 Save attendance        ] │  ← sticky, 56 px
└─────────────────────────────────────┘
After save: green banner "Saved ✔ 10:42 · 38 present · 2 absent"
            [ Add today's class note ]  (optional next step)
Offline:    amber banner "No internet – saved on phone, will upload automatically"
```
Rules: one network call (`PUT /attendance/class-sections/:id/dates/:date`), idempotent; reopening shows saved statuses; future dates are disabled; editable for 7 days.

### 4.3 Add student (shared by teacher and admin)
```
Add student                                   ✕
 Name *                [                    ]
 Class *               [ Std 1 A          ▾ ]
 Gender                ( ) Girl ( ) Boy ( ) Other
 Guardian name         [                    ]
 Guardian mobile       [ +91                ]
 Birth date            [ DD/MM/YYYY ] or  ☐ Not known → Approx. age [  ]
 ▸ More details (address, Aadhaar last 4, blood group, photo, GR number)
 [ Cancel ]                         [ Save student ]
```

### 4.4 Admin header with year switcher
```
[≡] Signal Trust › Thane School   Academic year: [2026-27 (current) ▾]   [मराठी ▾] (👤)
Viewing past year → yellow bar: "You are viewing 2025-26 (read-only). [Back to 2026-27]"
```

### 4.5 Rollover wizard: promotion step
```
Step 5 of 6 · Promote students
 Std 1 A → Std 2 A                      40 students
 [✔ Select all]  Action for selected: [Promote ▾]
 ☑ Aarav Pawar      [Promote → Std 2 A ▾]
 ☑ Bhakti Shinde    [Promote → Std 2 A ▾]
 ☐ Chetan More      [Detain (stay in Std 1) ▾]
 ☐ Dipali Jadhav    [Left school ▾]  Reason: [Migrated ▾]
 Summary: 37 promote · 2 detain · 1 left           [Back] [Next]
```

---

## 5. UX principles to adopt (the "teacher-first" checklist)

Every new or changed screen must pass all of these before merge:

1. **One primary action per screen**, full width on mobile, labelled with a verb ("Save attendance").
2. **Every icon has a text label** on teacher screens.
3. **All text from i18n.** No literal strings (lint enforced).
4. **Defaults do the work**: today's date, current year, the teacher's own class, "all present".
5. **Certainty**: show saving, saved (with time), and failed with retry. Never a silent failure.
6. **Forgiving**: confirm destructive actions, undo where possible, keep form data on error.
7. **Readable**: ≥ 16 px text, ≥ 48 px targets, WCAG AA contrast, works with Android "Large" font.
8. **Fast on 3G**: interactive within 3 s, no artificial waits, images ≤ 200 KB.
9. **Plain words** from the glossary, no jargon or abbreviations.
10. **Tested with a real teacher**: at least one TC-UX session per major feature.
