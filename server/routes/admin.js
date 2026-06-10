const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const db = require('../db/pool');
const { requireAdmin } = require('../auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.use(requireAdmin);

// ── Students ─────────────────────────────────────────────────────────────
const listStudents = db.prepare(`SELECT id, nis, examinee_no, name, class_name, created_at FROM students ORDER BY class_name, name`);
const upsertStudent = db.prepare(`
  INSERT INTO students (nis, examinee_no, name, class_name) VALUES (?, ?, ?, ?)
  ON CONFLICT(nis) DO UPDATE SET examinee_no=excluded.examinee_no, name=excluded.name, class_name=excluded.class_name
`);
const existsStudent = db.prepare(`SELECT id FROM students WHERE nis = ?`);
const delStudent = db.prepare(`DELETE FROM students WHERE id = ?`);

router.get('/students', (req, res) => {
  res.json({ students: listStudents.all() });
});

router.post('/students/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File CSV wajib' });
  let records;
  try {
    records = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    return res.status(400).json({ error: 'CSV tidak valid: ' + err.message });
  }
  let inserted = 0, updated = 0;
  const txn = db.transaction(() => {
    for (const r of records) {
      const nis = r.nis || r.NIS;
      const ex  = r.examinee_no || r.examinee || r['nomor peserta'];
      const name = r.name || r.nama;
      const cls = r.class_name || r.kelas || null;
      if (!nis || !ex || !name) continue;
      const exists = existsStudent.get(String(nis).trim());
      upsertStudent.run(String(nis).trim(), String(ex).trim(), String(name).trim(), cls);
      if (exists) updated++; else inserted++;
    }
  });
  txn();
  res.json({ ok: true, inserted, updated, total: records.length });
});

router.delete('/students/:id', (req, res) => {
  delStudent.run(req.params.id);
  res.json({ ok: true });
});

// Reset a single student's progress: wipe all responses and reset their session pointer.
const delStudentResponses = db.prepare(`DELETE FROM responses WHERE student_id = ?`);
const resetStudentSession = db.prepare(`
  UPDATE sessions
     SET completed_sims = '[]',
         current_sim = 'newton',
         current_stage = 'tutorial',
         last_seen_at = datetime('now')
   WHERE student_id = ?
`);
router.post('/students/:id/reset', (req, res) => {
  const txn = db.transaction((id) => {
    const r = delStudentResponses.run(id);
    resetStudentSession.run(id);
    return r.changes;
  });
  const deleted = txn(req.params.id);
  res.json({ ok: true, deleted });
});

// Reset ALL students (nuclear option for re-running the whole exam).
router.post('/responses/reset-all', (req, res) => {
  const txn = db.transaction(() => {
    const r = db.prepare(`DELETE FROM responses`).run();
    db.prepare(`UPDATE sessions SET completed_sims='[]', current_sim='newton', current_stage='tutorial', last_seen_at=datetime('now')`).run();
    return r.changes;
  });
  const deleted = txn();
  res.json({ ok: true, deleted });
});

// ── Settings ─────────────────────────────────────────────────────────────
const getSetting = db.prepare(`SELECT value FROM settings WHERE key = ?`);
const setSetting = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);

router.get('/settings', (req, res) => {
  const tm = getSetting.get('test_mode');
  const eu = getSetting.get('exam_unlock_at');
  res.json({
    test_mode: tm ? tm.value === 'true' : false,
    exam_unlock_at: (eu && eu.value) ? eu.value : null
  });
});

router.post('/settings/test-mode', (req, res) => {
  const { enabled } = req.body || {};
  setSetting.run('test_mode', enabled ? 'true' : 'false');
  res.json({ ok: true, test_mode: !!enabled });
});

router.post('/settings/exam-unlock', (req, res) => {
  const { unlock_at } = req.body || {};
  // unlock_at: ISO datetime string, or null/empty to remove the lock
  setSetting.run('exam_unlock_at', unlock_at ? String(unlock_at).trim() : '');
  res.json({ ok: true, exam_unlock_at: unlock_at || null });
});

// ── Questions ────────────────────────────────────────────────────────────
const listQuestionsBySim = db.prepare(`SELECT id, sim_key, stage, type, order_index, payload FROM questions WHERE sim_key = ? ORDER BY order_index, id`);
const listAllQuestions = db.prepare(`SELECT id, sim_key, stage, type, order_index, payload FROM questions ORDER BY sim_key, order_index, id`);
const insertQuestion = db.prepare(`INSERT INTO questions (sim_key, stage, type, order_index, payload) VALUES (?, ?, ?, ?, ?)`);
const getQuestion = db.prepare(`SELECT id, sim_key, stage, type, order_index, payload FROM questions WHERE id = ?`);
const updateQuestion = db.prepare(`UPDATE questions SET stage=?, type=?, order_index=?, payload=?, updated_at=datetime('now') WHERE id=?`);
const delQuestion = db.prepare(`DELETE FROM questions WHERE id = ?`);

function parseQ(q) { return { ...q, payload: JSON.parse(q.payload) }; }

router.get('/questions', (req, res) => {
  const rows = req.query.sim_key ? listQuestionsBySim.all(req.query.sim_key) : listAllQuestions.all();
  res.json({ questions: rows.map(parseQ) });
});

router.post('/questions', (req, res) => {
  const { sim_key, stage, type, order_index, payload } = req.body || {};
  if (!sim_key || !stage || !type || !payload) return res.status(400).json({ error: 'field wajib' });
  const info = insertQuestion.run(sim_key, stage, type, order_index || 0, JSON.stringify(payload));
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/questions/:id', (req, res) => {
  const current = getQuestion.get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Soal tidak ditemukan' });
  const { stage, type, order_index, payload } = req.body || {};
  updateQuestion.run(
    stage || current.stage,
    type || current.type,
    order_index ?? current.order_index,
    payload ? JSON.stringify(payload) : current.payload,
    req.params.id
  );
  res.json({ ok: true });
});

router.delete('/questions/:id', (req, res) => {
  delQuestion.run(req.params.id);
  res.json({ ok: true });
});

// Persist a new question order: body { ids: [questionId, ...] } in desired order.
const setOrder = db.prepare(`UPDATE questions SET order_index = ?, updated_at = datetime('now') WHERE id = ?`);
router.post('/questions/reorder', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids wajib' });
  const txn = db.transaction(() => {
    ids.forEach((id, i) => setOrder.run(i, id));
  });
  txn();
  res.json({ ok: true });
});

const listSims = db.prepare(`SELECT sim_key, title, order_index, embed_path FROM sims ORDER BY order_index`);
router.get('/sims', (req, res) => res.json({ sims: listSims.all() }));

// Admin preview: load a sim + its questions without student gating or response recording.
const getSimByKey = db.prepare(`SELECT sim_key, title, embed_path FROM sims WHERE sim_key = ?`);
const getSimQuestions = db.prepare(`SELECT id, sim_key, stage, type, order_index, payload FROM questions WHERE sim_key = ? ORDER BY order_index, id`);
router.get('/sim/:simKey/preview', (req, res) => {
  const sim = getSimByKey.get(req.params.simKey);
  if (!sim) return res.status(404).json({ error: 'Sim tidak ditemukan' });
  const questions = getSimQuestions.all(req.params.simKey).map(parseQ);
  res.json({ sim, questions, responses: [] });
});

// ── Responses ────────────────────────────────────────────────────────────
const responsesJoinSql = `
  SELECT r.id, r.submitted_at, r.sim_key, r.stage, r.is_correct, r.answer,
         s.nis, s.examinee_no, s.name, s.class_name, q.type, q.payload, r.time_spent_ms
  FROM responses r
  JOIN students s ON s.id = r.student_id
  JOIN questions q ON q.id = r.question_id
  ORDER BY s.class_name, s.name, r.submitted_at
`;
const listResponses = db.prepare(responsesJoinSql + ' LIMIT 5000');
const listResponsesAll = db.prepare(responsesJoinSql);

router.get('/responses', (req, res) => {
  const rows = listResponses.all().map(r => ({
    ...r,
    is_correct: r.is_correct === null ? null : !!r.is_correct,
    answer: JSON.parse(r.answer),
    payload: JSON.parse(r.payload)
  }));
  res.json({ responses: rows });
});

router.get('/responses.csv', (req, res) => {
  const rows = listResponsesAll.all();
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const str = String(v).replace(/"/g, '""');
    return /[",\n]/.test(str) ? `"${str}"` : str;
  };
  const headers = ['nis','examinee_no','name','class_name','sim_key','stage','type','is_correct','answer_json','time_spent_ms','submitted_at'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      esc(r.nis), esc(r.examinee_no), esc(r.name), esc(r.class_name),
      esc(r.sim_key), esc(r.stage), esc(r.type),
      esc(r.is_correct === null ? '' : (r.is_correct ? 'true' : 'false')),
      esc(r.answer), esc(r.time_spent_ms), esc(r.submitted_at)
    ].join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="responses.csv"');
  res.send(lines.join('\n'));
});

const summaryStmt = db.prepare(`
  SELECT s.id, s.nis, s.name, s.class_name,
         (SELECT completed_sims FROM sessions WHERE student_id = s.id) AS completed_sims,
         (SELECT COUNT(*) FROM responses WHERE student_id=s.id) AS answers,
         (SELECT COUNT(*) FROM responses WHERE student_id=s.id AND is_correct=1) AS correct
  FROM students s
  ORDER BY s.class_name, s.name
`);
router.get('/summary', (req, res) => {
  const rows = summaryStmt.all().map(r => {
    let n = 0;
    try { n = JSON.parse(r.completed_sims || '[]').length; } catch {}
    return { id: r.id, nis: r.nis, name: r.name, class_name: r.class_name, sims_completed: n, answers: r.answers, correct: r.correct };
  });
  res.json({ students: rows });
});

module.exports = router;
