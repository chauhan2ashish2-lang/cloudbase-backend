import fs from 'fs';
import path from 'path';
import { pool } from './db.js';

/**
 * Runs database/schema.sql automatically on boot if the `agencies` table
 * doesn't exist yet. This removes the need to manually run the schema via
 * a SQL console when deploying for the first time.
 *
 * Tries multiple candidate paths since deploy folder structure can vary
 * (root directory settings, nested vs flattened repo layout, etc).
 */
export async function autoMigrate() {
  const check = await pool.query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'agencies')`
  );
  if (check.rows[0].exists) {
    console.log('[migrate] Schema already present, skipping.');
    return;
  }

  console.log('[migrate] No schema found — looking for database/schema.sql...');

  const candidates = [
    path.join(process.cwd(), 'database', 'schema.sql'),
    path.join(process.cwd(), '..', 'database', 'schema.sql'),
    path.join(process.cwd(), 'src', '..', 'database', 'schema.sql'),
  ];

  let schemaPath = candidates.find((p) => fs.existsSync(p));

  if (!schemaPath) {
    console.error('[migrate] Could not find schema.sql in any expected location. Tried:', candidates);
    console.error('[migrate] Current working directory:', process.cwd());
    return;
  }

  console.log('[migrate] Found schema at:', schemaPath);
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('[migrate] Schema applied successfully.');
}
