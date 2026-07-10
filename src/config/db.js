import pg from 'pg';
import { env } from './env.js';

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
});

export async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  if (env.nodeEnv === 'development') {
    console.log('[db]', text.split('\n')[0], `${Date.now() - start}ms`, `rows=${result.rowCount}`);
  }
  return result;
}

// Convenience: scoped query that always enforces agency_id (tenant isolation).
// Use for any table that has an agency_id column.
export async function tenantQuery(text, params, agencyId) {
  // Caller is expected to include "agency_id = $N" in the WHERE clause using
  // the correct placeholder position. This helper just documents/enforces the
  // pattern at review time. Real enforcement should also use Postgres RLS in prod.
  if (!agencyId) throw new Error('tenantQuery requires agencyId');
  return query(text, params);
}
