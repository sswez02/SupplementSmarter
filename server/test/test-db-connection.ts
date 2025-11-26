import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });

pool
  .connect()
  .then(() => {
    console.log('Test: Database connected successfully');
  })
  .catch((err) => {
    console.error('Test: Database connection failed:', err);
  });
