const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbFile = process.env.DATABASE_FILE || path.join(__dirname, '..', '..', 'data', 'physics-exam.db');
const dir = path.dirname(dbFile);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');     // concurrent reads + 1 writer, far better throughput
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

console.log('[db] using sqlite at', dbFile);

// Global key-value settings table (created here so it's always available on startup)
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);
db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('test_mode', 'false')`).run();
db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('exam_unlock_at', '2026-06-11T11:00:00')`).run();

module.exports = db;
