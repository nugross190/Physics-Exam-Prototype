require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const questRoutes = require('./routes/quest');
const adminRoutes = require('./routes/admin');
const { requireUser } = require('./auth');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Static: public site (homepage, login, dashboard, admin, sim wrapper, shared assets)
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, {
  maxAge: '1h',
  etag: true,
  setHeaders: (res, file) => {
    if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
  }
}));

// Map sim folders into /sims/* with cache headers. We rename for clean URLs.
const SIM_MOUNTS = [
  ['/sims/newton',   'Newton Laws of Motion'],
  ['/sims/energy',   'Energy Skate Park'],
  ['/sims/buoyancy', 'Buoyancy Lab'],
  ['/sims/pressure', 'Under Pressure'],
  ['/sims/fluid',    'Fluid flow'],
  ['/sims/rotation', 'Rotational Motion']
];
for (const [route, folder] of SIM_MOUNTS) {
  app.use(route, requireUser, express.static(path.join(__dirname, '..', folder), {
    maxAge: '1d',
    etag: true
  }));
}

app.use('/api/auth', authRoutes);
app.use('/api/quest', questRoutes);
app.use('/api/admin', adminRoutes);

app.get('/healthz', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Fallback to homepage
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'internal_error' });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
