const express = require('express');
const db = require('../db/pool');
const { requireStudent } = require('../auth');
const { gradeAnswer } = require('../grading');

const router = express.Router();
router.use(requireStudent);

const getSettingStmt = db.prepare(`SELECT value FROM settings WHERE key = ?`);

function isTestMode() {
  const row = getSettingStmt.get('test_mode');
  return row && row.value === 'true';
}

function getExamUnlockAt() {
  const row = getSettingStmt.get('exam_unlock_at');
  return (row && row.value) ? row.value : null;
}

function isExamLocked() {
  const unlockStr = getExamUnlockAt();
  if (!unlockStr) return false;
  const t = new Date(unlockStr);
  return !isNaN(t.getTime()) && Date.now() < t.getTime();
}

const listSims = db.prepare(`SELECT sim_key, title, order_index, embed_path FROM sims ORDER BY order_index`);
const getSession = db.prepare(`SELECT completed_sims FROM sessions WHERE id = ?`);
const getSim = db.prepare(`SELECT sim_key, title, embed_path FROM sims WHERE sim_key = ?`);
const listQuestions = db.prepare(`SELECT id, stage, type, order_index, payload FROM questions WHERE sim_key = ? ORDER BY order_index ASC, id ASC`);
const listResponses = db.prepare(`SELECT question_id, answer, is_correct, score FROM responses WHERE session_id = ? AND sim_key = ?`);
const getQuestion = db.prepare(`SELECT id, sim_key, stage, type, payload FROM questions WHERE id = ?`);
const upsertResponse = db.prepare(`
  INSERT INTO responses (session_id, student_id, question_id, sim_key, stage, answer, is_correct, score, time_spent_ms)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(session_id, question_id) DO UPDATE
    SET answer=excluded.answer, is_correct=excluded.is_correct, score=excluded.score,
        time_spent_ms=excluded.time_spent_ms, submitted_at=datetime('now')
`);
const updateCursor = db.prepare(`UPDATE sessions SET last_seen_at=datetime('now'), current_sim=?, current_stage=? WHERE id=?`);
const countQuestionsBySim = db.prepare(`SELECT sim_key, COUNT(*) AS n FROM questions GROUP BY sim_key`);
const countAnsweredBySim = db.prepare(`SELECT sim_key, COUNT(DISTINCT question_id) AS n FROM responses WHERE session_id = ? GROUP BY sim_key`);
const countQuestions = db.prepare(`SELECT COUNT(*) AS n FROM questions WHERE sim_key = ?`);
const countResponses = db.prepare(`SELECT COUNT(DISTINCT question_id) AS n FROM responses WHERE session_id = ? AND sim_key = ?`);
const updateCompletedSims = db.prepare(`UPDATE sessions SET completed_sims = ?, last_seen_at = datetime('now') WHERE id = ?`);

function parseCompleted(row) {
  try { return new Set(JSON.parse((row && row.completed_sims) || '[]')); }
  catch { return new Set(); }
}

// All sims are open from the start: students pick any sim in any order.
// The dashboard reports per-sim progress (answered/total) instead of locks.
router.get('/dashboard', (req, res) => {
  const { sid, studentId } = req.student;
  const testMode = isTestMode();
  const examLocked = !testMode && isExamLocked();
  const examUnlockAt = getExamUnlockAt();
  const sims = listSims.all();

  const totals = Object.fromEntries(countQuestionsBySim.all().map(r => [r.sim_key, r.n]));
  const answered = Object.fromEntries(countAnsweredBySim.all(sid).map(r => [r.sim_key, r.n]));

  let grandTotal = 0, grandAnswered = 0;
  const list = sims.map((s) => {
    const total = totals[s.sim_key] || 0;
    const done = Math.min(answered[s.sim_key] || 0, total);
    grandTotal += total;
    grandAnswered += done;
    return {
      sim_key: s.sim_key,
      title: s.title,
      order_index: s.order_index,
      embed_path: s.embed_path,
      total_questions: total,
      answered: done,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
      completed: total > 0 && done >= total,
      unlocked: testMode || !examLocked
    };
  });

  res.json({
    student: { id: studentId, name: req.student.name, nis: req.student.nis },
    sims: list,
    test_mode: testMode,
    exam_locked: examLocked,
    exam_unlock_at: examLocked ? examUnlockAt : null,
    progress: {
      total: grandTotal,
      answered: grandAnswered,
      percent: grandTotal > 0 ? Math.round((grandAnswered / grandTotal) * 100) : 0
    }
  });
});

router.get('/sim/:simKey', (req, res) => {
  const { sid } = req.student;
  const simKey = req.params.simKey;
  const testMode = isTestMode();

  const meta = getSim.get(simKey);
  if (!meta) return res.status(404).json({ error: 'Simulasi tidak ditemukan' });

  if (testMode) {
    return res.json({
      sim: { sim_key: simKey, title: meta.title, embed_path: meta.embed_path },
      questions: [],
      responses: [],
      test_mode: true
    });
  }

  if (isExamLocked()) {
    return res.status(423).json({ error: 'exam_locked', exam_unlock_at: getExamUnlockAt() });
  }

  const rawQs = listQuestions.all(simKey);
  const stripped = rawQs.map((q) => {
    const payload = JSON.parse(q.payload);
    delete payload.answer;
    delete payload.answers;
    delete payload.blanks;
    delete payload.trap;
    if (Array.isArray(payload.rows)) {
      payload.rows = payload.rows.map(r => ({ label: r.label }));
    }
    return { id: q.id, stage: q.stage, type: q.type, order_index: q.order_index, payload };
  });

  const resp = listResponses.all(sid, simKey).map(r => ({
    question_id: r.question_id,
    answer: JSON.parse(r.answer),
    is_correct: r.is_correct === null ? null : !!r.is_correct,
    score: r.score
  }));

  res.json({
    sim: { sim_key: simKey, title: meta.title, embed_path: meta.embed_path },
    questions: stripped,
    responses: resp
  });
});

router.post('/response', (req, res) => {
  if (!isTestMode() && isExamLocked()) {
    return res.status(423).json({ error: 'exam_locked', exam_unlock_at: getExamUnlockAt() });
  }
  const { sid, studentId } = req.student;
  const { question_id, answer, time_spent_ms } = req.body || {};
  if (!question_id) return res.status(400).json({ error: 'question_id wajib' });

  const row = getQuestion.get(question_id);
  if (!row) return res.status(404).json({ error: 'Soal tidak ditemukan' });
  const q = { id: row.id, sim_key: row.sim_key, stage: row.stage, type: row.type, payload: JSON.parse(row.payload) };

  const { isCorrect, score, normalized } = gradeAnswer(q, answer);
  const correctVal = isCorrect === null ? null : (isCorrect ? 1 : 0);

  upsertResponse.run(sid, studentId, q.id, q.sim_key, q.stage, JSON.stringify(normalized), correctVal, score ?? null, time_spent_ms || null);
  updateCursor.run(q.sim_key, q.stage, sid);

  res.json({ ok: true, is_correct: isCorrect, score });
});

// Marks a sim as fully answered (kept for the admin summary). Only valid
// once every question in the sim has a stored response.
router.post('/sim/:simKey/complete', (req, res) => {
  if (!isTestMode() && isExamLocked()) {
    return res.status(423).json({ error: 'exam_locked', exam_unlock_at: getExamUnlockAt() });
  }
  const { sid } = req.student;
  const simKey = req.params.simKey;

  const need = countQuestions.get(simKey).n;
  const have = countResponses.get(sid, simKey).n;
  if (have < need) {
    return res.status(400).json({ error: 'Masih ada soal yang belum dijawab', need, have });
  }

  const completedSet = parseCompleted(getSession.get(sid));
  completedSet.add(simKey);
  updateCompletedSims.run(JSON.stringify([...completedSet]), sid);

  res.json({ ok: true });
});

module.exports = router;
