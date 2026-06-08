-- Physics Exam Platform schema

CREATE TABLE IF NOT EXISTS students (
  id            SERIAL PRIMARY KEY,
  nis           VARCHAR(64)  NOT NULL UNIQUE,
  examinee_no   VARCHAR(64)  NOT NULL,
  name          VARCHAR(255) NOT NULL,
  class_name    VARCHAR(64),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_examinee ON students(examinee_no);

CREATE TABLE IF NOT EXISTS sessions (
  id            SERIAL PRIMARY KEY,
  student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_sims TEXT[] NOT NULL DEFAULT '{}',
  current_sim   VARCHAR(64),
  current_stage VARCHAR(32)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id);

-- Sims catalog (fixed order). sim_key matches static folder name slug.
CREATE TABLE IF NOT EXISTS sims (
  sim_key       VARCHAR(64) PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,
  order_index   INTEGER NOT NULL,
  embed_path    VARCHAR(255) NOT NULL
);

-- Questions per sim per stage.
-- stage ∈ ('tutorial','var_test','inquiry','true_false','conclusion')
-- type  ∈ ('tutorial_step','var_test','simple_mc','complex_mc','true_false','word_bank')
CREATE TABLE IF NOT EXISTS questions (
  id            SERIAL PRIMARY KEY,
  sim_key       VARCHAR(64) NOT NULL REFERENCES sims(sim_key) ON DELETE CASCADE,
  stage         VARCHAR(32) NOT NULL,
  type          VARCHAR(32) NOT NULL,
  order_index   INTEGER NOT NULL DEFAULT 0,
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_sim_stage ON questions(sim_key, stage, order_index);

-- Student answers
CREATE TABLE IF NOT EXISTS responses (
  id            SERIAL PRIMARY KEY,
  session_id    INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  question_id   INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  sim_key       VARCHAR(64) NOT NULL,
  stage         VARCHAR(32) NOT NULL,
  answer        JSONB NOT NULL,
  is_correct    BOOLEAN,
  time_spent_ms INTEGER,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_responses_student ON responses(student_id);
CREATE INDEX IF NOT EXISTS idx_responses_sim ON responses(sim_key, stage);

CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
