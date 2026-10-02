# User stories

Status: ✅ implemented and covered by automated tests (API tests in `tests/`, browser tests in the web app's `e2e/`).
🟡 implemented, manual check only. ⏭ not in v1 (see "Later" at the end).

## Personas

| Persona | Who | Device & skills | What matters most |
|---|---|---|---|
| **Sunita — class teacher** | Teaches Std 1 A, first-generation smartphone user | Cheap Android phone, mobile data that drops; reads Marathi best | Take attendance in under a minute, never lose it, no English jargon |
| **Rahul — subject teacher** | Teaches Maths in two classes | Phone | See his subjects, tick topics taught |
| **Meena — office clerk** | Admissions, records, certificates | Office desktop + phone | Add/import children quickly, print certificates, call absent children's families |
| **Principal / admin** | Runs one school | Laptop + phone | Today's status at a glance, set up classes and teachers, start the new year |
| **Trust owner** | Runs several schools for the NGO | Laptop | Compare schools, add a school, control who has owner rights |
| **Guardian** (indirect) | Parent, often migrant labourer | Basic phone with WhatsApp | Hear quickly, in their language, when the child is absent |

## Getting in

| ID | Story | Acceptance criteria | Status |
|---|---|---|---|
| US-01 | As a teacher I log in with my **mobile number or email** | Wrong details give one clear message (no hint which part was wrong); 10 wrong tries lock the account for 15 minutes | ✅ |
| US-02 | As a new teacher I **choose my own password** at first login | Temporary password from the office works once; app forces a new password (min 8 characters) | ✅ |
| US-03 | As a teacher I **choose my language** on the login screen | English / हिंदी / मराठी / ગુજરાતી buttons in their own script; choice remembered on the device and in my profile | ✅ |
| US-04 | As a teacher I **stay logged in** on my own phone | Sessions renew silently for 30 days; a stolen, replayed renewal token ends all my sessions | ✅ |
| US-05 | As an admin I **reset a teacher's password** and share it on WhatsApp | One-time readable password (no 0/O, 1/l), "copy message" button | ✅ |
| US-06 | As anyone on a **shared phone** I log out and leave no children's data behind | Logout clears offline copies; warns if attendance is still waiting to upload | ✅ |

## Daily teaching

| ID | Story | Acceptance criteria | Status |
|---|---|---|---|
| US-10 | As a teacher my **home screen shows today's classes** | Each class says "Attendance not taken" or "done: 12 of 12 present (09:10)"; holidays and weekly offs are shown | ✅ |
| US-11 | As a teacher I **take attendance in a few taps** | Everyone starts Present; each child has P / A / L buttons, so any status is one tap; one big Save; colour **and** letter for each status | ✅ |
| US-12 | As a teacher I take attendance **without internet** | Saved on the phone, uploaded automatically later; the newest mark wins; refused uploads (e.g. date locked) are shown, never silently lost | ✅ |
| US-13 | As a teacher I **correct attendance** for recent days | Allowed for N days (school setting, default 7); older dates locked for teachers, open for admins | ✅ |
| US-14 | As a teacher I am **warned before losing unsaved marks** | Leaving the page with changes asks first; screen says changes are not saved yet | ✅ |
| US-15 | As a teacher I write a **diary note with a photo** for the class or one child | Photo compressed on the phone (~200 KB); class notes appear in each present child's diary | ✅ |
| US-16 | As a teacher I **tick syllabus topics taught** | Tick with date; untick only my own (admins any); progress % per subject | ✅ |
| US-17 | As a teacher I **enter marks** for my subjects only | Only my subjects listed; grade or marks/max; marks above maximum blocked | ✅ |

## Children's records

| ID | Story | Acceptance criteria | Status |
|---|---|---|---|
| US-20 | As a clerk I **admit a child with only a name and class** | GR number auto-assigned (school prefix); everything else optional under "More details" | ✅ |
| US-20b | As a clerk I am **warned before admitting a child twice** | Similar name or same guardian phone → "Is this the same child?" with a link to the existing record (re-admit keeps history) | ✅ |
| US-21 | As a clerk I admit a child **without a birth certificate** | "Date of birth unknown" + approximate age stored as estimated birth year | ✅ |
| US-22 | As a clerk I **import a class list from Excel/CSV** | Template download; preview shows every row with its problems; only good rows imported; impossible dates (31/02) rejected | ✅ |
| US-23 | As anyone I **find a child** by name, GR number or guardian phone | Search as I type; filter by class/status; "show more" paging | ✅ |
| US-24 | As a clerk I **mark a child as left** with reason and the school they joined | Never deleted; history kept; can be re-admitted later | ✅ |
| US-25 | As a clerk I **print a school leaving certificate** | Printable A4 portrait in the selected language with last class, attendance, dates, destination school | ✅ |
| US-26 | As a teacher I record **health camp check-ups** | Height, weight, notes, "needs a doctor again"; growth history per child | ✅ |
| US-27 | As a principal I see **which children need a doctor** | Dashboard counts children whose latest check-up asks for a follow-up | ✅ |
| US-28 | As a clerk I **export the student list** to Excel | Ordered by class level, roll number | ✅ |
| US-29 | As anyone I see a child's **history across years** | Class, attendance %, results per year; open any past year | ✅ |
| US-29b | As a teacher I show a guardian **the child's month** | Calendar with each day's mark, holidays greyed, totals and % | ✅ |

## Reaching families

| ID | Story | Acceptance criteria | Status |
|---|---|---|---|
| US-30 | As the office I see **today's absent children with their guardian's phone** | Call and WhatsApp buttons next to each child | ✅ |
| US-31 | The WhatsApp message is **in the guardian's language** | Uses the guardian language saved on the child (falls back to the app language) | ✅ |
| US-32 | As a principal I see **children who often miss school** | Below 75% in the last 30 days (min. 5 marked days), with call/WhatsApp | ✅ |
| US-33 | As a principal I see **children absent several days in a row** | Absent on each of the latest 3+ marked school days (holidays don't break a streak), with call/WhatsApp in the guardian's language | ✅ |

## Running the school

| ID | Story | Acceptance criteria | Status |
|---|---|---|---|
| US-40 | As a principal I see a **setup checklist** on a new school | Year → class levels → classes → subjects → teachers → students, each with a "Do this" link | ✅ |
| US-41 | As a principal I see **today at a glance** | Classes done/pending (pending ones link to the sheet), absent count, meals to serve, 2-week trend, syllabus progress, birthdays | ✅ |
| US-42 | As an admin I **set up classes, subjects and class teachers** | Class levels ordered (Balwadi, Std 1, …) everywhere; deleting a class with children is refused | ✅ |
| US-43 | As an admin I **add staff** with a role (teacher / clerk / admin; owner only by owners) | Teacher in two schools of the same trust is linked, not duplicated | ✅ |
| US-44 | As an admin I **assign teachers** to classes and subjects per year | One class teacher per class; teachers can only write to their own classes | ✅ |
| US-45 | As an admin I mark **holidays and weekly offs** | Excluded from attendance %; shown on Today and attendance sheet | ✅ |
| US-46 | As an admin I print the **monthly attendance register** and download Excel | Students × days, totals, % below 75 highlighted | ✅ |
| US-47 | As a principal I print **report cards** | One page per child per term, A4 portrait, signatures | ✅ |
| US-48 | As an admin I see an **activity log** | Who did what and when (2-year retention); filter by person and kind of change; page through history | ✅ |

## New academic year

| ID | Story | Acceptance criteria | Status |
|---|---|---|---|
| US-50 | As an admin I **start the new year with a wizard** | Suggests name/dates; copy classes, subjects, syllabus (without ticks) and teachers; promote / keep back / left / completed per child; one transaction; safe to click twice | ✅ |
| US-51 | As anyone I **look at a past year** read-only | Year switcher in the header; banner "Viewing 2025-26"; writes refused by the server | ✅ |
| US-52 | As an admin I **unlock a closed year** briefly to fix a mistake | 5–240 minutes, reason required, logged | ✅ |
| US-53 | As an admin I **promote late joiners** after the wizard ran | Per-child promotion endpoint | ✅ |

## Trust (several schools)

| ID | Story | Acceptance criteria | Status |
|---|---|---|---|
| US-60 | As an owner I **compare my schools** | Students, teachers, 30-day attendance %, syllabus % per school | ✅ |
| US-61 | As an owner I **add a school** and switch between schools | Every owner gets access to the new school; data never mixes between schools or trusts | ✅ |

## Quality stories (apply to every screen)

| ID | Story | Acceptance criteria | Status |
|---|---|---|---|
| UQ-1 | Works on a 360 px wide phone | No sideways page scroll; touch targets ≥ 44 px; bottom tab bar for teachers | ✅ (e2e) |
| UQ-2 | Every word on screen is translated | Lint forbids literal text in JSX; tests fail if a language misses a key or placeholder | ✅ |
| UQ-3 | Errors are understandable | Server returns codes; app shows a translated sentence and keeps the user's input | ✅ |
| UQ-4 | A crash never shows a blank page | Friendly message with Reload; after a new deploy the page reloads itself once | ✅ |
| UQ-5 | Fast on slow networks | Code split per screen, photos compressed before upload, offline app shell (PWA) | ✅ |
| UQ-6 | Children's data is private | See [security](security.md) | ✅ |
| UQ-7 | Readable for weak eyesight | Me → Text size: Normal / Large / Extra large; screens still fit a 360 px phone at 130% | ✅ (e2e) |
| UQ-8 | Indian names display correctly | Avatar initials keep Devanagari/Gujarati syllables whole | ✅ (unit) |

## Later (not in v1)

- SMS to families without WhatsApp (needs an SMS provider and DLT registration in India).
- Staff attendance and leave.
- Mid-day meal stock register (v1 only shows how many meals to serve, from today's attendance).
- Learning-level assessments (e.g. reading level: letter / word / paragraph / story) tracked per term.
- ID cards with photo and QR code.
