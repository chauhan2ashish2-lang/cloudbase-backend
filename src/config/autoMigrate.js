import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Runs database/schema.sql automatically on boot if the `agencies` table
 * doesn't exist yet. This removes the need to manually run the schema via
 * a SQL console when deploying for the first time.
 */
export async function autoMigrate() {
  const check = await pool.query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'agencies')`
  );
  if (check.rows[0].exists) {
    console.log('[migrate] Schema already present, skipping.');
    return;
  }

  console.log('[migrate] No schema found — running database/schema.sql...');
  const schemaPath = path.join(__dirname, '../../../database/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('[migrate] Schema applied successfully.');
}
