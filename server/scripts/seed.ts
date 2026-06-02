#!/usr/bin/env ts-node
/**
 * Seed script — loads src/db/seed.sql into the dev database.
 *
 * Usage:  npm run db:seed
 *
 * Requires DATABASE_URL in server/.env and migrations to have been run first.
 */

import fs from "node:fs"
import path from "node:path"
import dotenv from "dotenv"
import { Pool } from "pg"

dotenv.config({ path: path.resolve(__dirname, "../.env") })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
	console.error("ERROR: DATABASE_URL is not set in server/.env")
	process.exit(1)
}

const pool = new Pool({ connectionString: DATABASE_URL })

const SEED_FILE = path.resolve(__dirname, "../src/db/seed.sql")

async function run(): Promise<void> {
	const sql = fs.readFileSync(SEED_FILE, "utf8")
	const client = await pool.connect()
	try {
		console.log("Seeding database...")
		await client.query(sql)
		console.log("Seed complete.")
	} finally {
		client.release()
		await pool.end()
	}
}

run().catch((err) => {
	console.error(err)
	process.exit(1)
})
