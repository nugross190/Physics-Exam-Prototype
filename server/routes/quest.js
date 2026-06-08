const express = require('express');
const pool = require('../db/pool');
const { requireStudent } = require('../auth');
const { gradeAnswer, STAGES } = require('../grading');

const router = express.Router();

router.use(requireStudent);

// Dashboard data: sims in order, completed flags, current sim
router.get('/dashboard', async (req, res) => {
  const { sid, studentId } = req.student;
  const sims = await pool.query(`SELECT sim_key, title, order_index, embed_path FROM sims ORDER BY order_index`);
  const sess = await pool.query(`SELECT completed_sims, current_sim, current_stage FROM sessions WHERE id=$1`, [sid]);
  const session = sess.rows[0] || { completed_sims: [], current_sim: 'newton', current_stage: 'tutorial' };

  const completed = new Set(session.completed_sims || []);
  // The "active" sim is the first non-completed in order.
  const ordered = sims.rows;
  let activeKey = null;
  for (const s of ordered) {
    if (!completed.has(s.sim_key)) { activeKey = s.sim_key; break; }
  }

  const list = ordered.map((s) => ({
    sim_key: s.sim_key,
    title: s.title,
    order_index: s.order_index,
    embed_path: s.embed_path,
    completed: completed.has(s.sim_key),
    unlocked: completed.has(s.sim_key) || s.sim_key === activeKey
  }));

  res.json({
    student: { id: studentId, name: req.student.name, nis: req.student.nis },
    sims: list,
    active_sim: activeKey,
    current_stage: session.current_stage || 'tutorial'
  });
});

// Get the quest (questions + state) for a sim, gated by order.
router.get('/sim/:simKey', async (req, res) => {
  const { sid } = req.student;
  const simKey = req.params.simKey;

  const sess = await pool.query(`SELECT completed_sims, current_sim, current_stage FROM sessions WHERE id=$1`, [sid]);
  const session = sess.rows[0];
  const sims = await pool.query(`SELECT sim_key, title, embed_path FROM sims ORDER BY order_index`);
  const completed = new Set(session.completed_sims || []);
  const ordered = sims.rows.map(r => r.sim_key);
  const firstIncomplete = ordered.find(k => !completed.has(k));

  // Allowed if completed OR is the active (first incomplete).
  if (!completed.has(simKey) && simKey !== firstIncomplete) {
    return res.status(403).json({ error: 'Selesaikan simulasi sebelumnya terlebih dahulu' });
  }

  const meta = sims.rows.find(s => s.sim_key === simKey);
  if (!meta) return res.status(404).json({ error: 'Simulasi tidak ditemukan' });

  const qs = await pool.query(
    `SELECT id, stage, type, order_index, payload FROM questions WHERE sim_key=$1 ORDER BY order_index ASC, id ASC`,
    [simKey]
  );

  // Strip answer keys for client.
  const stripped = qs.rows.map((q) => {
    const p = { ...q.payload };
    delete p.answer;
    delete p.answers;
    delete p.blanks;
    return { id: q.id, stage: q.stage, type: q.type, order_index: q.order_index, payload: p };
  });

  // Prior responses
  const resp = await pool.query(
    `SELECT question_id, answer, is_correct FROM responses WHERE session_id=$1 AND sim_key=$2`,
    [sid, simKey]
  );

  res.json({
    sim: { sim_key: simKey, title: meta.title, embed_path: meta.embed_path },
    stages: STAGES,
    questions: stripped,
    responses: resp.rows,
    completed: completed.has(simKey),
    current_stage: session.current_sim === simKey ? session.current_stage : 'tutorial'
  });
});

// Submit a single answer
router.post('/response', async (req, res) => {
  const { sid, studentId } = req.student;
  const { question_id, answer, time_spent_ms } = req.body || {};
  if (!question_id) return res.status(400).json({ error: 'question_id wajib' });

  const { rows } = await pool.query(`SELECT id, sim_key, stage, type, payload FROM questions WHERE id=$1`, [question_id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Soal tidak ditemukan' });
  const q = rows[0];

  const { isCorrect, normalized } = gradeAnswer(q, answer);

  await pool.query(
    `INSERT INTO responses (session_id, student_id, question_id, sim_key, stage, answer, is_correct, time_spent_ms)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
     ON CONFLICT (session_id, question_id) DO UPDATE
       SET answer=EXCLUDED.answer, is_correct=EXCLUDED.is_correct, time_spent_ms=EXCLUDED.time_spent_ms, submitted_at=NOW()`,
    [sid, studentId, q.id, q.sim_key, q.stage, JSON.stringify(normalized), isCorrect, time_spent_ms || null]
  );

  await pool.query(
    `UPDATE sessions SET last_seen_at=NOW(), current_sim=$1, current_stage=$2 WHERE id=$3`,
    [q.sim_key, q.stage, sid]
  );

  res.json({ ok: true, is_correct: isCorrect });
});

// Mark a sim complete (all stages answered at least once)
router.post('/sim/:simKey/complete', async (req, res) => {
  const { sid } = req.student;
  const simKey = req.params.simKey;

  const qCount = await pool.query(`SELECT COUNT(*)::int AS n FROM questions WHERE sim_key=$1`, [simKey]);
  const rCount = await pool.query(
    `SELECT COUNT(DISTINCT question_id)::int AS n FROM responses WHERE session_id=$1 AND sim_key=$2`,
    [sid, simKey]
  );
  if (rCount.rows[0].n < qCount.rows[0].n) {
    return res.status(400).json({ error: 'Belum semua tahap dijawab', need: qCount.rows[0].n, have: rCount.rows[0].n });
  }

  await pool.query(
    `UPDATE sessions
       SET completed_sims = (
         SELECT ARRAY(SELECT DISTINCT UNNEST(completed_sims || ARRAY[$2]::text[]))
       ),
       last_seen_at = NOW()
     WHERE id=$1`,
    [sid, simKey]
  );

  // Move pointer to next sim
  const sims = await pool.query(`SELECT sim_key FROM sims ORDER BY order_index`);
  const sess = await pool.query(`SELECT completed_sims FROM sessions WHERE id=$1`, [sid]);
  const completed = new Set(sess.rows[0].completed_sims || []);
  const next = sims.rows.map(r => r.sim_key).find(k => !completed.has(k));
  if (next) {
    await pool.query(`UPDATE sessions SET current_sim=$1, current_stage='tutorial' WHERE id=$2`, [next, sid]);
  }

  res.json({ ok: true, next_sim: next || null });
});

module.exports = router;
