const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  user: process.env.DATABASE_URL ? undefined : process.env.DB_USER,
  host: process.env.DATABASE_URL ? undefined : process.env.DB_HOST,
  database: process.env.DATABASE_URL ? undefined : process.env.DB_NAME,
  password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
  port: process.env.DATABASE_URL ? undefined : process.env.DB_PORT,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Database auto-migration helper
const ensureUnitColumn = async () => {
  try {
    await pool.query(`
      ALTER TABLE inventory ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'kg';
    `);
    console.log("Database migration: 'unit' column ensured in inventory table.");
  } catch (err) {
    console.error("Database migration error:", err);
  }
};
ensureUnitColumn();

module.exports = {
  query: (text, params) => pool.query(text, params),
};
