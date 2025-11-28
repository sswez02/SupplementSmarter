import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../src/db/index.js';

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: tsx src/SQL/runSQL.ts <path-to-sql>');
    process.exit(1);
  }
  const abs = path.resolve(file);
  const sql = await fs.readFile(abs, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`Applied: ${abs}`);
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('SQL apply failed:', e?.message || e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}
main();
