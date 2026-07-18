const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const RETRY_DELAYS = [2000, 3000, 5000, 5000, 5000, 5000, 5000, 5000, 5000]; // ~45s total

async function query(text, params) {
  let lastErr;
  for (let i = 0; i <= RETRY_DELAYS.length; i++) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      const isWake = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' ||
                     err.message?.includes('endpoint is disabled') ||
                     err.message?.includes('connection') ||
                     err.message?.includes('timeout');
      if (!isWake || i === RETRY_DELAYS.length) throw err;
      lastErr = err;
      console.log(`DB not ready, retrying in ${RETRY_DELAYS[i] / 1000}s... (attempt ${i + 1})`);
      await new Promise(r => setTimeout(r, RETRY_DELAYS[i]));
    }
  }
  throw lastErr;
}

module.exports = { query };
