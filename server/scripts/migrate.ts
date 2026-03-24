#!/usr/bin/env ts-node
/**
 * Migration runner — executes all *.sql files in src/db/migrations/ in order.
 * Tracks applied migrations in a `schema_migrations` table so each file runs
 * exactly once.
 *
 * Usage:  npm run db:migrate
 */

import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set in server/.env");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const MIGRATIONS_DIR = path.resolve(__dirname, "../src/db/migrations");

async function run(): Promise<void> {
  const client = await pool.connect();
  try {
    // Ensure tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const { rows: applied } = await client.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations ORDER BY filename"
    );
    const appliedSet = new Set(applied.map((r) => r.filename));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  skip  ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`  apply ${file}`);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        ran++;
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`  FAILED ${file}:`, err);
        process.exit(1);
      }
    }

    console.log(`\nMigrations complete. ${ran} new migration(s) applied.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
