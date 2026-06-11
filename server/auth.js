const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const COOKIE_NAME = 'pe_token';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 1000 * 60 * 60 * 8 // 8 hours
};

function sign(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '8h' });
}

function setAuthCookie(res, payload) {
  res.cookie(COOKIE_NAME, sign(payload), COOKIE_OPTS);
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTS);
}

function readToken(req) {
  const t = req.cookies && req.cookies[COOKIE_NAME];
  if (!t) return null;
  try { return jwt.verify(t, SECRET); } catch { return null; }
}

function requireStudent(req, res, next) {
  const claims = readToken(req);
  if (!claims || claims.role !== 'student') return res.status(401).json({ error: 'unauthorized' });
  req.student = claims;
  next();
}

function requireAdmin(req, res, next) {
  const claims = readToken(req);
  if (!claims || claims.role !== 'admin') return res.status(401).json({ error: 'unauthorized' });
  req.admin = claims;
  next();
}

// Any authenticated user (student or admin). Used for the /sims/* static
// mounts: students load sims during the exam, admins load them through the
// "Preview Sim" iframe — a student-only guard there breaks admin preview.
function requireUser(req, res, next) {
  const claims = readToken(req);
  if (!claims || (claims.role !== 'student' && claims.role !== 'admin')) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  req.user = claims;
  next();
}

module.exports = { sign, setAuthCookie, clearAuthCookie, readToken, requireStudent, requireAdmin, requireUser, COOKIE_NAME };
