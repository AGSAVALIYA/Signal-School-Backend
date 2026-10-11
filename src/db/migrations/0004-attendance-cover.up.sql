-- The dashboard's "children who often miss school" reads 30 days of a whole school's attendance on every visit.
-- Carrying the needed columns in the (school_id, date) index lets Postgres answer from the index alone
-- (34 ms -> 9 ms for 1,200 children); it replaces the plain index on the same columns.
CREATE INDEX attendance_school_date_cover ON attendance (school_id, date) INCLUDE (academic_year_id, student_id, class_section_id, status);
DROP INDEX IF EXISTS attendance_school_id_date_idx;
