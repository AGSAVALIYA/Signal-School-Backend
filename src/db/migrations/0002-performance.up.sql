-- Indexes found by profiling with 1,200 children and ~470,000 attendance rows (scripts/perf-seed.js).

-- History, report card and per-enrollment totals read attendance by enrollment (was a full table scan).
CREATE INDEX IF NOT EXISTS attendance_enrollment ON attendance (enrollment_id) INCLUDE (status);
-- Absence streaks: only children absent recently are candidates.
CREATE INDEX IF NOT EXISTS attendance_recent_absent ON attendance (school_id, date) WHERE status = 'A';
-- Dashboard / year counts by status.
CREATE INDEX IF NOT EXISTS enrollments_year_status ON enrollments (academic_year_id, status);
CREATE INDEX IF NOT EXISTS subjects_year ON subjects (academic_year_id);
-- Marks grid reads one subject and term.
CREATE INDEX IF NOT EXISTS report_entries_subject_term ON report_entries (subject_id, term);
-- Health follow-up list per school.
CREATE INDEX IF NOT EXISTS health_checks_school ON health_checks (school_id, student_id, checked_on DESC);
