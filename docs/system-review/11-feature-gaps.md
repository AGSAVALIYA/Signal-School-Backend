# 11 — Missing Features (School Management, Attendance, Academic Year)

These are features a school management system needs and Signal School doesn't have yet, looked at from the point of view of daily attendance, school administration and the academic year. They're ranked by value to non-technical teachers and principals.

Priority: **M** must · **S** should · **C** could · **W** won't now. Phase is from [10-implementation-plan.md](10-implementation-plan.md).

| ID | Feature | Who benefits | Why it matters | Pri | Phase |
|---|---|---|---|---|---|
| FG-01 | **Teacher "Today" home + teacher↔class assignments** | Teachers | The app opens on the teacher's own work, not a profile page. It's the foundation for permissions and "my classes". | M | 3 |
| FG-02 | **Fast class attendance screen** (all present by default, tap absentees, one save, counts) | Teachers | The core daily task drops from about 5 min to under 45 s, with certainty that it saved. | M | 3 |
| FG-03 | **School calendar**: weekly offs, holidays, exam days | Principal, teachers | Correct attendance % (holidays aren't counted as absent), and teachers are warned on holidays. | S | 3 |
| FG-04 | **Monthly attendance register** (students × days, totals, %), PDF/Excel in local language | Principal, clerk | Replaces the paper register. Needed for inspections and government returns. | M | 3 |
| FG-05 | **At-risk list**: < 75% monthly attendance, 3+ consecutive absences | Principal, class teacher | Early follow-up on dropouts. Especially important for migrant or street-connected children. | S | 5 |
| FG-06 | **Attendance lock window + edit history** | Principal | Stops silent back-dating while allowing corrections in N days. Shows who changed what. | S | 3 |
| FG-07 | **Offline attendance** (PWA + sync queue) | Teachers in low-signal areas | The app becomes usable in classrooms with no network. | S | 6 |
| FG-08 | **Report cards** (term PDF with grades, attendance %, remarks, school logo) in local language | Principal, parents | Turns grade entry into a document parents receive. | C | 5 |
| FG-09 | **Marks/grade entry grid** per class subject | Teachers | Replaces the one-at-a-time report dialog. | S | 5 |
| FG-10 | **Organization dashboard** comparing schools | Trust owner | Oversight across schools (enrolment, attendance %, syllabus %). | C | 5 |
| FG-11 | **Student import (preview + validation) and Excel export** | Clerk | Onboard schools quickly and share lists with the government or donors. | M | 3 |
| FG-12 | **Parent absence SMS/WhatsApp** (opt-in, local language) | Parents, principal | Same-day follow-up on absence. | C | 7 |
| FG-13 | **Leaving certificate / transfer certificate** generation when marking "left" | Clerk | Common administrative need, tied to the "left school" flow. | C | 7 |
| FG-14 | **Automated daily backups + tested restore** | Owner | Protection against data loss (deletes, bad migrations, provider issues). | M | 1 |
| FG-15 | **Roles (owner/admin/clerk/teacher) + invites** | Owner | Least privilege. Replaces open admin registration. | S | 2 |
| FG-16 | **Audit log viewer** with filters | Principal, owner | Accountability for edits and deletes. | S | 5 |
| FG-17 | **Student ID cards** (photo, GR, QR) print sheet | Clerk | Identification for children without documents. QR can speed attendance later. | C | 7 |
| FG-18 | **In-app help**: tip cards per screen + 60-second videos per language | Teachers | Self-learning without training sessions. | S | 4 |
| FG-19 | **Onboarding checklist** for new schools | New admin | Guides setup (year → classes → subjects → teachers → students). | S | 4 |
| FG-20 | **Class diary** (one note + photo per class per day) | Teachers | Replaces bulk timeline duplication. Shows on each present child's diary. | S | 3 |
| FG-21 | **Syllabus progress report** (% per class/subject/teacher, last updated) | Principal | See pace and lagging subjects. | S | 4 |
| FG-22 | **Birthdays & milestones** on the teacher home/dashboard | Teachers | Small delight that builds engagement. | C | 7 |
| FG-23 | **Data-quality report** (missing guardian phone, DOB, photo, duplicates) | Clerk, principal | Keeps records usable, and especially helps where documents are missing. | S | 5 |
| FG-24 | **Mid-day meal count** from attendance (daily present count per class, export) | Principal | Common reporting duty in Indian schools, derived from attendance at no extra effort. | C | 7 |
| FG-25 | **Staff attendance** (teacher check-in) | Principal | Management view of teacher presence. | C | 7 |
| FG-26 | **Student documents** (birth certificate, Aadhaar copy, previous school TC), private storage | Clerk | Central document record with access control. | C | 7 |
| FG-27 | **Timetable** (periods per class/teacher) | Principal | Enables period-wise attendance later. The `/schedule` placeholder exists. | W | — |
| FG-28 | **Fees** | — | Out of scope unless the trust needs it. | W | — |
| FG-29 | **Government formats** (UDISE+ style student export fields) | Clerk | Saves re-typing for annual returns. | C | 5 |
| FG-30 | **Self-service password reset by OTP** | Teachers | Fewer "I forgot my password" calls to the office. | C | 5 |
| FG-31 | **Rollover wizard, promotion, year switcher, student history** | Principal, all | See [07](07-academic-year-design.md). The top request in the brief. | M | 4 |
| FG-32 | **Real multi-language** (en/hi/mr/gu) | All | See [06](06-multilingual-design.md). The second top request in the brief. | M | 2 |

## Deliberately *not* recommended now
- **Biometric or face-recognition attendance:** cost, privacy risk for minors, connectivity. Revisit after the core flows are smooth.
- **Native mobile apps:** a PWA covers the needs (install to home screen, offline, camera) with one codebase.
- **AI features** (auto-summaries of diary notes, etc.): only after the basics are reliable and translated.
