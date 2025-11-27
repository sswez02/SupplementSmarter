import 'dotenv/config'; // Loads environment variables from .env
import fs from 'node:fs/promises'; // Filesystem module for reading files
import path from 'node:path'; // Path module for resolving file paths
import { pool } from '../src/db/index.js'; // Database connection pool

async function main() {
  const file = process.argv[2]; // Retrieve the SQL file path from the command line arguments
  if (!file) {
    console.error('Usage: tsx src/SQL/runSQL.ts <path-to-sql>');
    process.exit(1); // Exit if the file path is not provided
  }

  const abs = path.resolve(file); // Resolve the absolute path of the SQL file
  const sql = await fs.readFile(abs, 'utf8'); // Read the SQL file content

  const client = await pool.connect(); // Get a database client from the connection pool
  try {
    await client.query('BEGIN'); // Begin the transaction
    await client.query(sql); // Execute the SQL script
    await client.query('COMMIT'); // Commit the transaction if successful
    console.log(`Applied: ${abs}`); // Log the success
  } catch (e: any) {
    await client.query('ROLLBACK'); // Rollback the transaction on error
    console.error('SQL apply failed:', e?.message || e); // Log the error message
    process.exitCode = 1; // Set the exit code to indicate failure
  } finally {
    client.release(); // Release the client back to the pool
    await pool.end(); // End the pool (close all database connections)
  }
}

main(); // Run the main function
