import pg from "pg";

const { Pool } = pg;

/**
 * @param {string} connectionString
 * @returns {pg.Pool}
 */
export function createPool(connectionString) {
  return new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX || 10),
    // Neon / managed Postgres typically require TLS
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: true },
  });
}

/** @param {pg.Pool} pool */
export async function ensureSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS capsules (
      id TEXT PRIMARY KEY,
      ciphertext TEXT NOT NULL,
      open_at_iso TEXT NOT NULL,
      target_round BIGINT NOT NULL,
      has_password BOOLEAN NOT NULL,
      created_at BIGINT NOT NULL
    );
  `);
}

/**
 * @param {pg.Pool} pool
 * @param {{
 *   id: string
 *   ciphertext: string
 *   open_at_iso: string
 *   target_round: number
 *   has_password: boolean
 *   created_at: number
 * }} row
 */
export async function insertCapsule(pool, row) {
  await pool.query(
    `INSERT INTO capsules (id, ciphertext, open_at_iso, target_round, has_password, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      row.id,
      row.ciphertext,
      row.open_at_iso,
      row.target_round,
      row.has_password,
      row.created_at,
    ],
  );
}

/**
 * @param {pg.Pool} pool
 * @param {string} id
 */
export async function getCapsule(pool, id) {
  const { rows } = await pool.query(
    `SELECT id, ciphertext, open_at_iso AS "openAtIso", target_round AS "targetRound",
            has_password AS "hasPassword", created_at AS "createdAt"
     FROM capsules WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    ...row,
    targetRound: Number(row.targetRound),
    hasPassword: Boolean(row.hasPassword),
    createdAt: Number(row.createdAt),
  };
}
