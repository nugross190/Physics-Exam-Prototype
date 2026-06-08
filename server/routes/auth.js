const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/pool');
const { setAuthCookie, clearAuthCookie, readToken } = require('../auth');

const router = express.Router();

const getStudent = db.prepare(`SELECT id, nis, examinee_no, name, class_name FROM students WHERE nis = ? AND examinee_no = ?`);
const getSession = db.prepare(`SELECT id FROM sessions WHERE student_id = ?`);
const insertSession = db.prepare(`INSERT INTO sessions (student_id, current_sim, current_stage) VALUES (?, 'newton', 'tutorial')`);
const touchSession = db.prepare(`UPDATE sessions SET last_seen_at = datetime('now') WHERE id = ?`);
const getAdmin = db.prepare(`SELECT id, username, password_hash FROM admins WHERE username = ?`);

router.post('/student/login', (req, res) => {
  const { nis, examinee_no } = req.body || {};
  if (!nis || !examinee_no) return res.status(400).json({ error: 'NIS dan Nomor Peserta wajib diisi' });

  const s = getStudent.get(String(nis).trim(), String(examinee_no).trim());
  if (!s) return res.status(401).json({ error: 'NIS atau Nomor Peserta salah' });

  let row = getSession.get(s.id);
  let sessionId;
  if (!row) {
    const info = insertSession.run(s.id);
    sessionId = info.lastInsertRowid;
  } else {
    sessionId = row.id;
    touchSession.run(sessionId);
  }

  setAuthCookie(res, { role: 'student', sid: sessionId, studentId: s.id, name: s.name, nis: s.nis });
  res.json({ ok: true, student: { name: s.name, nis: s.nis, class_name: s.class_name } });
});

router.post('/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi' });
  const row = getAdmin.get(username);
  if (!row) return res.status(401).json({ error: 'Kredensial salah' });
  if (!bcrypt.compareSync(password, row.password_hash)) return res.status(401).json({ error: 'Kredensial salah' });
  setAuthCookie(res, { role: 'admin', id: row.id, username });
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
