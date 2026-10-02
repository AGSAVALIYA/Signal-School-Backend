CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  head_office TEXT,
  contact_number TEXT,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE schools (
  id SERIAL PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  contact_number TEXT,
  location TEXT,
  udise_code TEXT,
  logo_key TEXT,
  default_language TEXT NOT NULL DEFAULT 'en',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  gr_prefix TEXT NOT NULL DEFAULT '',
  next_gr_number INT NOT NULL DEFAULT 1,
  attendance_edit_days INT NOT NULL DEFAULT 7,
  weekly_offs INT[] NOT NULL DEFAULT '{0}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON schools (organization_id);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email CITEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  preferred_language TEXT,
  photo_key TEXT,
  token_version INT NOT NULL DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE TABLE user_schools (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'clerk', 'teacher')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, school_id)
);
CREATE INDEX ON user_schools (school_id, role);

CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON refresh_tokens (user_id);

CREATE TABLE academic_years (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'closed')),
  unlocked_until TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, name),
  CHECK (start_date < end_date)
);
CREATE UNIQUE INDEX one_active_year_per_school ON academic_years (school_id) WHERE status = 'active';

CREATE TABLE grades (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_translations JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  next_grade_id INT REFERENCES grades(id) ON DELETE SET NULL,
  is_final BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE TABLE class_sections (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  grade_id INT NOT NULL REFERENCES grades(id),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  copied_from_id INT REFERENCES class_sections(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, name)
);
CREATE INDEX ON class_sections (school_id, academic_year_id);

CREATE TABLE subjects (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  class_section_id INT NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_translations JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  copied_from_id INT REFERENCES subjects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_section_id, name)
);

CREATE TABLE teacher_assignments (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_section_id INT NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('class_teacher', 'subject_teacher')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_class_teacher ON teacher_assignments (class_section_id) WHERE role = 'class_teacher';
CREATE UNIQUE INDEX unique_assignment ON teacher_assignments (user_id, class_section_id, COALESCE(subject_id, 0));
CREATE INDEX ON teacher_assignments (user_id, academic_year_id);

CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  gr_number TEXT NOT NULL,
  name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('F', 'M', 'O')),
  dob DATE,
  dob_is_approximate BOOLEAN NOT NULL DEFAULT false,
  estimated_birth_year SMALLINT,
  blood_group TEXT,
  address TEXT,
  father_name TEXT,
  mother_name TEXT,
  guardian_name TEXT,
  guardian_relation TEXT,
  guardian_phone TEXT,
  guardian_phone_2 TEXT,
  guardian_language TEXT,
  aadhaar_last4 CHAR(4),
  photo_key TEXT,
  admission_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left', 'graduated')),
  left_on DATE,
  left_reason TEXT CHECK (left_reason IN ('migrated', 'dropped_out', 'transferred', 'tc_issued', 'other')),
  left_note TEXT,
  left_to_school TEXT,
  consent_photo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, gr_number)
);
CREATE INDEX students_name_trgm ON students USING gin (name gin_trgm_ops);

CREATE INDEX students_school_status ON students (school_id, status);

-- Health camp / check-up records (growth, follow-up needed).
CREATE TABLE health_checks (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  checked_on DATE NOT NULL,
  height_cm NUMERIC(5, 1) CHECK (height_cm IS NULL OR height_cm BETWEEN 30 AND 250),
  weight_kg NUMERIC(5, 1) CHECK (weight_kg IS NULL OR weight_kg BETWEEN 2 AND 200),
  needs_follow_up BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON health_checks (student_id, checked_on DESC);

CREATE TABLE enrollments (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_section_id INT NOT NULL REFERENCES class_sections(id),
  roll_number INT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'promoted', 'detained', 'left', 'graduated', 'transferred')),
  enrolled_on DATE,
  exited_on DATE,
  previous_enrollment_id INT REFERENCES enrollments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, academic_year_id)
);
CREATE INDEX ON enrollments (class_section_id, status);

CREATE TABLE attendance (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  enrollment_id INT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_section_id INT NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('P', 'A', 'L', 'LATE')),
  remark TEXT,
  marked_by INT REFERENCES users(id) ON DELETE SET NULL,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
CREATE INDEX ON attendance (class_section_id, date);
CREATE INDEX ON attendance (school_id, date);

CREATE TABLE attendance_sessions (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  class_section_id INT NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  submitted_by INT REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  present_count INT NOT NULL DEFAULT 0,
  absent_count INT NOT NULL DEFAULT 0,
  leave_count INT NOT NULL DEFAULT 0,
  late_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_section_id, date)
);
CREATE INDEX ON attendance_sessions (school_id, date);

CREATE TABLE holidays (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'holiday' CHECK (type IN ('holiday', 'exam', 'event')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, date)
);

CREATE TABLE daily_logs (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  enrollment_id INT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  note TEXT,
  photo_key TEXT,
  subject_ids INT[] NOT NULL DEFAULT '{}',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date, created_by)
);
CREATE INDEX ON daily_logs (student_id, date DESC);

CREATE TABLE class_daily_logs (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  class_section_id INT NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  note TEXT,
  photo_key TEXT,
  subject_ids INT[] NOT NULL DEFAULT '{}',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_section_id, date, created_by)
);
CREATE INDEX ON class_daily_logs (class_section_id, date DESC);

CREATE TABLE chapters (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  copied_from_id INT REFERENCES chapters(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON chapters (subject_id, sort_order);

CREATE TABLE topics (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  chapter_id INT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  copied_from_id INT REFERENCES topics(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON topics (chapter_id, sort_order);

CREATE TABLE topic_completions (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  topic_id INT NOT NULL UNIQUE REFERENCES topics(id) ON DELETE CASCADE,
  completed_by INT REFERENCES users(id) ON DELETE SET NULL,
  completed_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE report_entries (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  enrollment_id INT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  term TEXT NOT NULL CHECK (term IN ('S1', 'S2', 'ANNUAL')),
  grade TEXT,
  marks NUMERIC(6, 2),
  max_marks NUMERIC(6, 2),
  remarks TEXT,
  entered_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, subject_id, term)
);

CREATE TABLE activity_groups (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_translations JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, name)
);

CREATE TABLE activity_members (
  activity_group_id INT NOT NULL REFERENCES activity_groups(id) ON DELETE CASCADE,
  enrollment_id INT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_group_id, enrollment_id)
);

CREATE TABLE rollover_runs (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL UNIQUE,
  academic_year_id INT REFERENCES academic_years(id) ON DELETE CASCADE,
  summary JSONB NOT NULL DEFAULT '{}',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  school_id INT REFERENCES schools(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INT,
  summary TEXT,
  before JSONB,
  after JSONB,
  ip TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_logs (school_id, created_at DESC);
CREATE INDEX ON audit_logs (entity_type, entity_id);
CREATE INDEX ON audit_logs (user_id, created_at DESC);
