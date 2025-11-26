import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
console.log('Debug: DATABASE_URL:', process.env.DATABASE_URL);

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

const pool = connectionString
  ? new Pool({ connectionString })
  : new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || '5432'),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      database: process.env.PGDATABASE || 'supplements',
    });

// Debugging the database connection
pool
  .connect()
  .then(() => {
    console.log('Database connected successfully');
  })
  .catch((err) => {
    console.error('Database connection failed:', err);
  });

export { pool };
