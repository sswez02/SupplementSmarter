import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

export const pool = connectionString
  ? new Pool({ connectionString })
  : new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || '5432'),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      database: process.env.PGDATABASE || 'supplements',
    });
