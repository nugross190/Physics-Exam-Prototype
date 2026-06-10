-- Physics Exam Platform schema (SQLite)

CREATE TABLE IF NOT EXISTS students (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nis          TEXT NOT NULL UNIQUE,
  examinee_no  TEXT NOT NULL,
  name         TEXT NOT NULL,
  class_name   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_students_examinee ON students(examinee_no);

CREATE TABLE IF NOT EXISTS sessions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_sims  TEXT NOT NULL DEFAULT '[]',   -- JSON array of sim_keys
  current_sim     TEXT,
  current_stage   TEXT
);

CREATE TABLE IF NOT EXISTS sims (
  sim_key      TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  order_index  INTEGER NOT NULL,
  embed_path   TEXT NOT NULL
);

-- stage ∈ ('tutorial','var_test','inquiry','true_false','conclusion')
-- type  ∈ ('tutorial_step','var_test','simple_mc','complex_mc','true_false','word_bank')
CREATE TABLE IF NOT EXISTS questions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sim_key      TEXT NOT NULL REFERENCES sims(sim_key) ON DELETE CASCADE,
  stage        TEXT NOT NULL,
  type         TEXT NOT NULL,
  order_index  INTEGER NOT NULL DEFAULT 0,
  payload      TEXT NOT NULL,                  -- JSON
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_questions_sim_stage ON questions(sim_key, stage, order_index);

CREATE TABLE IF NOT EXISTS responses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  question_id   INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  sim_key       TEXT NOT NULL,
  stage         TEXT NOT NULL,
  answer        TEXT NOT NULL,                 -- JSON
  is_correct    INTEGER,                       -- 1, 0, or NULL
  score         REAL,                          -- partial score (NULL for var_test)
  time_spent_ms INTEGER,
  submitted_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (session_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_responses_student ON responses(student_id);
CREATE INDEX IF NOT EXISTS idx_responses_sim ON responses(sim_key, stage);

CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
