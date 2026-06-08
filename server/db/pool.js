const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn('[db] DATABASE_URL not set. Using default localhost connection.');
}

const pool = new Pool({
  connectionString: connectionString || 'postgres://postgres:postgres@localhost:5432/physics_exam',
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error', err);
});

module.exports = pool;
