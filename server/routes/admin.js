const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const pool = require('../db/pool');
const { requireAdmin } = require('../auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(requireAdmin);

// ── Students ─────────────────────────────────────────────────────────────
router.get('/students', async (req, res) => {
  const { rows } = await pool.query(`SELECT id, nis, examinee_no, name, class_name, created_at FROM students ORDER BY class_name, name`);
  res.json({ students: rows });
});

// CSV columns: nis,examinee_no,name,class_name
router.post('/students/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File CSV wajib' });
  let records;
  try {
    records = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    return res.status(400).json({ error: 'CSV tidak valid: ' + err.message });
  }
  let inserted = 0, updated = 0;
  for (const r of records) {
    const nis = r.nis || r.NIS;
    const ex  = r.examinee_no || r.examinee || r['nomor peserta'];
    const name = r.name || r.nama;
    const cls = r.class_name || r.kelas || null;
    if (!nis || !ex || !name) continue;
    const result = await pool.query(
      `INSERT INTO students (nis, examinee_no, name, class_name)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (nis) DO UPDATE SET examinee_no=EXCLUDED.examinee_no, name=EXCLUDED.name, class_name=EXCLUDED.class_name
       RETURNING (xmax = 0) AS inserted`,
      [String(nis).trim(), String(ex).trim(), String(name).trim(), cls]
    );
    if (result.rows[0].inserted) inserted++; else updated++;
  }
  res.json({ ok: true, inserted, updated, total: records.length });
});

router.delete('/students/:id', async (req, res) => {
  await pool.query(`DELETE FROM students WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

// ── Questions ────────────────────────────────────────────────────────────
router.get('/questions', async (req, res) => {
  const sim = req.query.sim_key;
  let rows;
  if (sim) {
    rows = (await pool.query(
      `SELECT id, sim_key, stage, type, order_index, payload FROM questions WHERE sim_key=$1 ORDER BY order_index, id`,
      [sim]
    )).rows;
  } else {
    rows = (await pool.query(
      `SELECT id, sim_key, stage, type, order_index, payload FROM questions ORDER BY sim_key, order_index, id`
    )).rows;
  }
  res.json({ questions: rows });
});

router.post('/questions', async (req, res) => {
  const { sim_key, stage, type, order_index, payload } = req.body || {};
  if (!sim_key || !stage || !type || !payload) return res.status(400).json({ error: 'field wajib' });
  const r = await pool.query(
    `INSERT INTO questions (sim_key, stage, type, order_index, payload)
     VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id`,
    [sim_key, stage, type, order_index || 0, JSON.stringify(payload)]
  );
  res.json({ ok: true, id: r.rows[0].id });
});

router.put('/questions/:id', async (req, res) => {
  const { stage, type, order_index, payload } = req.body || {};
  await pool.query(
    `UPDATE questions
       SET stage=COALESCE($1, stage),
           type=COALESCE($2, type),
           order_index=COALESCE($3, order_index),
           payload=COALESCE($4::jsonb, payload),
           updated_at=NOW()
     WHERE id=$5`,
    [stage || null, type || null, order_index ?? null, payload ? JSON.stringify(payload) : null, req.params.id]
  );
  res.json({ ok: true });
});

router.delete('/questions/:id', async (req, res) => {
  await pool.query(`DELETE FROM questions WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

router.get('/sims', async (req, res) => {
  const { rows } = await pool.query(`SELECT sim_key, title, order_index, embed_path FROM sims ORDER BY order_index`);
  res.json({ sims: rows });
});

// ── Responses ────────────────────────────────────────────────────────────
router.get('/responses', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT r.id, r.submitted_at, r.sim_key, r.stage, r.is_correct, r.answer,
           s.nis, s.name, s.class_name, q.type, q.payload
    FROM responses r
    JOIN students s ON s.id = r.student_id
    JOIN questions q ON q.id = r.question_id
    ORDER BY s.class_name, s.name, r.submitted_at
    LIMIT 5000
  `);
  res.json({ responses: rows });
});

router.get('/responses.csv', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT s.nis, s.examinee_no, s.name, s.class_name,
           r.sim_key, r.stage, q.type,
           r.is_correct, r.answer::text AS answer_json,
           r.time_spent_ms, r.submitted_at
    FROM responses r
    JOIN students s ON s.id = r.student_id
    JOIN questions q ON q.id = r.question_id
    ORDER BY s.class_name, s.name, r.submitted_at
  `);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const str = String(v).replace(/"/g, '""');
    return /[",\n]/.test(str) ? `"${str}"` : str;
  };
  const headers = ['nis','examinee_no','name','class_name','sim_key','stage','type','is_correct','answer_json','time_spent_ms','submitted_at'];
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map(h => esc(r[h])).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="responses.csv"');
  res.send(lines.join('\n'));
});

router.get('/summary', async (req, res) => {
  const totals = await pool.query(`
    SELECT s.id, s.nis, s.name, s.class_name,
           COALESCE(array_length(sess.completed_sims, 1), 0) AS sims_completed,
           (SELECT COUNT(*) FROM responses WHERE student_id=s.id) AS answers,
           (SELECT COUNT(*) FROM responses WHERE student_id=s.id AND is_correct=true) AS correct
    FROM students s
    LEFT JOIN sessions sess ON sess.student_id = s.id
    ORDER BY s.class_name, s.name
  `);
  res.json({ students: totals.rows });
});

module.exports = router;
