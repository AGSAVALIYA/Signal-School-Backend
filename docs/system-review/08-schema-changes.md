# 08 — Proposed Database Schema (v2), Indexes, Permissions, Migrations

PostgreSQL 15+. Sequelize with `underscored: true` (snake_case columns), `paranoid` only where noted. All tables have `id BIGSERIAL PK`, `created_at`, `updated_at`. **Every school-owned table carries `school_id`** so scope checks and indexes are simple.

Legend: **PK** primary key · **FK** foreign key · **UQ** unique · **NN** not null · **IX** index.

---

## 1. Tenancy and people

### organizations
| column | type | notes |
|---|---|---|
| name | text NN | |
| head_office, contact_number | text | |
| settings | jsonb NN default `{}` | e.g., `{ "defaultLanguage": "mr" }` |

### schools
| column | type | notes |
|---|---|---|
| organization_id | FK organizations NN, IX | |
| name | text NN | |
| address, contact_number, location, udise_code | text | `location` becomes nullable |
| logo_url | text | |
| current_academic_year_id | FK academic_years NULL | replaces int `currentAcademicYear` |
| default_language | varchar(5) NN default `'en'` | |
| timezone | text NN default `'Asia/Kolkata'` | |
| gr_prefix | text NN default `''` | e.g., `"TSS/"` |
| next_gr_number | int NN default 1 | incremented with `SELECT … FOR UPDATE` |
| attendance_edit_days | int NN default 7 | lock window |
| status | enum(`active`,`archived`) NN default `active` | |

### users (replaces `Admins` + `Teachers`)
| column | type | notes |
|---|---|---|
| organization_id | FK organizations NN, IX | |
| name | text NN | |
| email | citext UQ NULL | email **or** phone required (CHECK) |
| phone | varchar(15) UQ NULL | E.164 |
| password_hash | text NN | **excluded by default scope** |
| must_change_password | bool NN default true | |
| status | enum(`active`,`inactive`) NN default `active` | |
| preferred_language | varchar(5) NULL | |
| photo_url | text | |
| token_version | int NN default 0 | bump to revoke all tokens |
| last_login_at | timestamptz | |
| failed_login_count, locked_until | int, timestamptz | brute-force protection |

### user_schools (membership + role per school)
| column | type | notes |
|---|---|---|
| user_id | FK users NN | |
| school_id | FK schools NN | |
| role | enum(`owner`,`admin`,`clerk`,`teacher`) NN | `owner` = org-level, implicitly all schools |
| is_default | bool NN default false | the school opened at login |
| UQ (user_id, school_id) · IX (school_id, role) | | |

### invites
`organization_id, school_id NULL, email/phone, role, token_hash UQ, expires_at, accepted_at, invited_by FK users`.

---

## 2. Academic structure

### academic_years
| column | type | notes |
|---|---|---|
| school_id | FK NN | |
| name | text NN | UQ (school_id, name) |
| start_date, end_date | date NN | CHECK start_date < end_date |
| status | enum(`planned`,`active`,`closed`) NN default `planned` | partial UQ: one `active` per school |
| closed_at, closed_by | | |
| EXCLUDE overlapping ranges per school (btree_gist) — optional | | |

### grades (permanent levels)
| column | type | notes |
|---|---|---|
| school_id | FK NN | |
| name | text NN | UQ (school_id, name) |
| name_translations | jsonb NN default `{}` | `{ "mr": "इयत्ता ५" }` |
| sort_order | int NN | |
| next_grade_id | FK grades NULL | null + is_final → graduate |
| is_final | bool NN default false | |
| status | enum(`active`,`archived`) | |

### class_sections (replaces `Classes`)
| column | type | notes |
|---|---|---|
| school_id | FK NN | |
| academic_year_id | FK NN | |
| grade_id | FK NN | |
| name | text NN | e.g., "Std 1 A" (default = grade name) |
| section_label | varchar(10) NULL | "A", "B" |
| sort_order | int NN | |
| class_teacher_id | FK users NULL | |
| copied_from_id | FK class_sections NULL | rollover lineage |
| UQ (academic_year_id, name) · IX (school_id, academic_year_id) | | |

### subjects
| column | type | notes |
|---|---|---|
| school_id, academic_year_id | FK NN | denormalized for scoping |
| class_section_id | FK NN | |
| name | text NN | UQ (class_section_id, name) |
| name_translations | jsonb default `{}` | |
| sort_order | int NN | |
| copied_from_id | FK subjects NULL | |

### teacher_assignments
`school_id, academic_year_id, user_id FK, class_section_id FK, subject_id FK NULL, role enum('class_teacher','subject_teacher')` · UQ (user_id, class_section_id, subject_id) · IX (user_id, academic_year_id).

### activity_groups (replaces `CommonSubjects`)
`school_id, academic_year_id, name, name_translations` + `enrollment_activity_groups(enrollment_id, activity_group_id)` UQ pair.

---

## 3. Students and enrollment

### students (permanent identity)
| column | type | notes |
|---|---|---|
| school_id | FK NN | |
| gr_number | text NN | **UQ (school_id, gr_number)** |
| name | text NN | any script. IX gin trigram for search |
| gender | enum(`F`,`M`,`O`) NULL | |
| dob | date NULL | |
| dob_is_approximate | bool NN default false | |
| estimated_birth_year | smallint NULL | when DOB unknown; age shown = this year − value |
| blood_group | varchar(5) NULL | |
| address | text | |
| father_name, mother_name | text | |
| guardian_name, guardian_relation | text | |
| guardian_phone, guardian_phone_2 | varchar(15) | |
| guardian_language | varchar(5) | for SMS |
| aadhaar_last4 | char(4) NULL | full number **not stored** (or `aadhaar_enc bytea` with a KMS key if legally required) |
| photo_url | text | private bucket key, served via signed URL |
| admission_date | date | |
| status | enum(`active`,`left`,`graduated`) NN default `active` | |
| left_on, left_reason | date, enum(`migrated`,`dropped_out`,`transferred`,`tc_issued`,`other`) + text | |
| consent_photo, consent_data | bool | DPDP consent flags |
| ~~age~~, ~~panCardNumber~~, ~~AcademicYearId~~, ~~ClassId~~ | removed | age is derived. Year/class move to enrollments |

### enrollments
| column | type | notes |
|---|---|---|
| school_id, academic_year_id | FK NN | |
| student_id | FK NN | **UQ (student_id, academic_year_id)** |
| class_section_id | FK NN, IX | |
| roll_number | int NULL | UQ (class_section_id, roll_number) where not null |
| status | enum(`active`,`promoted`,`detained`,`left`,`graduated`,`transferred`) NN default `active` | |
| enrolled_on, exited_on | date | |
| previous_enrollment_id | FK enrollments NULL | promotion chain |
| IX (class_section_id, status) | | |

---

## 4. Attendance, diary, syllabus, reports

### attendance
| column | type | notes |
|---|---|---|
| school_id, academic_year_id | FK NN | |
| enrollment_id | FK NN | |
| student_id | FK NN | denormalized |
| class_section_id | FK NN | |
| date | date NN | CHECK within year range (trigger or app) |
| status | enum(`P`,`A`,`L`,`LATE`) NN | holidays come from `holidays`, not stored per student |
| remark | text | |
| marked_by | FK users NN | |
| marked_at | timestamptz NN | |
| **UQ (student_id, date)** · **IX (class_section_id, date)** · IX (school_id, date) | | |

### attendance_sessions (one per class per day: "was attendance taken?")
`school_id, academic_year_id, class_section_id, date, submitted_by, submitted_at, present_count, absent_count, leave_count, source enum('online','offline_sync')` · **UQ (class_section_id, date)**. Powers "classes not marked today" and the lock window.

### holidays
`school_id, academic_year_id, date, name, type enum('holiday','weekly_off','exam','event')` · UQ (school_id, date). Plus `schools.settings.weeklyOffs = [0]` (Sunday).

### daily_logs (replaces StudentTimelines, per-student note)
`school_id, academic_year_id, enrollment_id, student_id, date, note text, photo_url, created_by FK users` · UQ (student_id, date, created_by) · IX (student_id, date DESC) · join `daily_log_subjects(daily_log_id, subject_id)`.

### class_daily_logs (whole-class note with one photo)
`school_id, academic_year_id, class_section_id, date, note, photo_url, created_by` + `class_daily_log_subjects`. A child's diary view = their `daily_logs` ∪ `class_daily_logs` for days they were present.

### chapters / topics / topic_completions
| table | columns | constraints |
|---|---|---|
| chapters | `school_id, subject_id FK, name, sort_order, copied_from_id` | IX (subject_id, sort_order) |
| topics | `school_id, chapter_id FK ON DELETE CASCADE, content text NN, sort_order, copied_from_id` | IX (chapter_id, sort_order) |
| topic_completions | `school_id, topic_id FK ON DELETE CASCADE, completed_by FK users, completed_on date NN, note` | UQ (topic_id) for v1 (one completion per topic per section; topics are already per-section via subject) |

Editing a chapter **updates topics in place by id**. New topics are inserted, removed topics deleted (with a confirmation if they have completions).

### report_entries (replaces Reports)
`school_id, academic_year_id, enrollment_id FK, subject_id FK, term enum('S1','S2','ANNUAL'), grade varchar(5), marks numeric(5,2) NULL, max_marks numeric(5,2) NULL, remarks text, entered_by FK users` · **UQ (enrollment_id, subject_id, term)**.

---

## 5. Audit, files, imports

### audit_logs (replaces Logs)
`school_id, user_id, action varchar(50) (e.g., 'attendance.save'), entity_type, entity_id, summary text, before jsonb, after jsonb, ip inet, user_agent, request_id` · IX (school_id, created_at DESC) · IX (entity_type, entity_id). Retention: 2 years (monthly partitioning optional).

### files
`school_id, owner_type, owner_id, s3_key UQ, content_type, size_bytes, width, height, uploaded_by` for photos and documents. The S3 key is a UUID (no locale-dependent names).

### import_jobs
`school_id, type ('students'), status ('preview','applied','failed'), file_key, total_rows, valid_rows, error_rows, report jsonb, created_by, applied_at`.

---

## 6. Indexes (performance must-haves)

```sql
CREATE INDEX ON class_sections (school_id, academic_year_id);
CREATE INDEX ON enrollments (class_section_id, status);
CREATE UNIQUE INDEX ON enrollments (student_id, academic_year_id);
CREATE INDEX ON attendance (class_section_id, date);
CREATE INDEX ON attendance (school_id, date);
CREATE UNIQUE INDEX ON attendance (student_id, date);
CREATE UNIQUE INDEX ON attendance_sessions (class_section_id, date);
CREATE INDEX ON daily_logs (student_id, date DESC);
CREATE INDEX ON subjects (class_section_id, sort_order);
CREATE INDEX ON chapters (subject_id, sort_order);
CREATE INDEX ON topics (chapter_id, sort_order);
CREATE UNIQUE INDEX ON topic_completions (topic_id);
CREATE UNIQUE INDEX ON students (school_id, gr_number);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX students_name_trgm ON students USING gin (name gin_trgm_ops);
CREATE INDEX ON teacher_assignments (user_id, academic_year_id);
CREATE INDEX ON audit_logs (school_id, created_at DESC);
CREATE INDEX ON user_schools (school_id, role);
```

---

## 7. Permission matrix (enforced by `authorize()` + scope middleware)

| Action | owner | admin (principal) | clerk | teacher |
|---|---|---|---|---|
| Manage org, schools, invite admins | ✅ | ❌ | ❌ | ❌ |
| Manage academic years, rollover, unlock closed year | ✅ | ✅ | ❌ | ❌ |
| Grades, sections, subjects, holidays | ✅ | ✅ | ❌ | ❌ |
| Teachers: invite, deactivate, reset password, assign | ✅ | ✅ | ❌ | ❌ |
| Students: add/edit/import/mark left | ✅ | ✅ | ✅ | add/edit in **assigned** sections |
| Students: purge (hard delete) | ✅ | ❌ | ❌ | ❌ |
| Attendance: take/edit within lock window | ✅ | ✅ | ❌ | assigned sections (class teacher; subject teachers if the school enables it) |
| Attendance: edit after lock / closed year | ✅ | ✅ (audited) | ❌ | ❌ |
| Daily logs | ✅ | ✅ | ❌ | create; edit/delete own |
| Syllabus content (chapters/topics) | ✅ | ✅ | ❌ | assigned subjects (optional setting) |
| Mark topic done/undone | ✅ | ✅ (choose teacher) | ❌ | assigned subjects, as self |
| Reports/grades entry | ✅ | ✅ | ❌ | assigned subjects |
| View reports, registers, dashboard | ✅ | ✅ | ✅ | own sections |
| Audit log | ✅ | ✅ | ❌ | ❌ |

Teachers can **read** all sections of their school (to look up a child) but write only to assigned ones. This is a school setting, `teachersCanWriteAllSections` (default false).

---

## 8. Migrations instead of `sync({ alter: true })`

1. Add `sequelize-cli` (or `umzug`) with a `db/migrations/` folder. One file per change: `YYYYMMDDHHmm-description.js` with `up`/`down`.
2. Remove `sequelize.sync({ alter: true })` from `models/index.js`. In development only, keep `npm run db:reset` (drop, migrate, seed).
3. **Baseline migration:** generate from the current production schema (`pg_dump --schema-only`) so the existing DB is marked as migrated at v1.
4. **v2 migrations** create the new tables alongside the legacy ones. `scripts/migrate-legacy-to-v2.js` ([07 §6](07-academic-year-design.md)) copies the data. A final migration renames legacy tables to `legacy_*`.
5. CI: spin up Postgres, run all migrations up, run tests, run `down` for the latest migration (reversibility check).
6. Deploy order: back up the DB, `npm run db:migrate`, start the app. Never run migrations from app boot.

---

## 9. Mapping old → new (quick reference)

| Old | New |
|---|---|
| `Admins`, `Teachers`, `TeacherSchool` | `users`, `user_schools` |
| `Organizations`, `Schools` | same + new columns |
| `AcademicYears` | `academic_years` (+status) |
| `Classes` | `grades` + `class_sections` |
| `Subjects` | `subjects` (section-scoped) |
| `CommonSubjects`, `StudentCommonSubject` | `activity_groups`, `enrollment_activity_groups` |
| `Students` (per year) | `students` (identity) + `enrollments` (per year) |
| `Attendances` | `attendance` (+ `attendance_sessions`, `holidays`) |
| `StudentTimelines`, `SubjectStudentTimeline` | `daily_logs` (+ `class_daily_logs`) |
| `Chapters`, `Topics` (with completion columns) | `chapters`, `topics`, `topic_completions` |
| `Reports` | `report_entries` |
| `Logs` | `audit_logs` |
| `StudentSubject` | dropped |
