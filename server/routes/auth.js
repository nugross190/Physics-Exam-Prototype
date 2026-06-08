const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { setAuthCookie, clearAuthCookie, readToken } = require('../auth');

const router = express.Router();

router.post('/student/login', async (req, res) => {
  const { nis, examinee_no } = req.body || {};
  if (!nis || !examinee_no) return res.status(400).json({ error: 'NIS dan Nomor Peserta wajib diisi' });

  const { rows } = await pool.query(
    `SELECT id, nis, examinee_no, name, class_name FROM students WHERE nis=$1 AND examinee_no=$2`,
    [String(nis).trim(), String(examinee_no).trim()]
  );
  if (rows.length === 0) return res.status(401).json({ error: 'NIS atau Nomor Peserta salah' });
  const s = rows[0];

  // Ensure a session exists for this student
  const existing = await pool.query(`SELECT id FROM sessions WHERE student_id=$1`, [s.id]);
  let sessionId;
  if (existing.rows.length === 0) {
    const ins = await pool.query(
      `INSERT INTO sessions (student_id, current_sim, current_stage) VALUES ($1,$2,$3) RETURNING id`,
      [s.id, 'newton', 'tutorial']
    );
    sessionId = ins.rows[0].id;
  } else {
    sessionId = existing.rows[0].id;
    await pool.query(`UPDATE sessions SET last_seen_at=NOW() WHERE id=$1`, [sessionId]);
  }

  setAuthCookie(res, { role: 'student', sid: sessionId, studentId: s.id, name: s.name, nis: s.nis });
  res.json({ ok: true, student: { name: s.name, nis: s.nis, class_name: s.class_name } });
});

router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi' });
  const { rows } = await pool.query(`SELECT id, username, password_hash FROM admins WHERE username=$1`, [username]);
  if (rows.length === 0) return res.status(401).json({ error: 'Kredensial salah' });
  const ok = bcrypt.compareSync(password, rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: 'Kredensial salah' });
  setAuthCookie(res, { role: 'admin', id: rows[0].id, username });
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const claims = readToken(req);
  if (!claims) return res.json({ authenticated: false });
  res.json({ authenticated: true, ...claims });
});

module.exports = router;
