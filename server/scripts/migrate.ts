#!/usr/bin/env ts-node
/**
 * Migration runner — executes *.sql files in src/db/migrations/ in order.
 * Tracks applied migrations in a `schema_migrations` table so each file runs
 * exactly once.
 *
 * Usage:
 *   npm run migrate            — apply all pending migrations
 *   npm run migrate:rollback   — revert the last applied migration (requires a
 *                                matching *.undo.sql file alongside the migration)
 */

import fs from "node:fs"
import path from "node:path"
import dotenv from "dotenv"
import { Pool, type PoolClient } from "pg"

dotenv.config({ path: path.resolve(__dirname, "../.env") })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
	console.error("ERROR: DATABASE_URL is not set in server/.env")
	process.exit(1)
}

const pool = new Pool({ connectionString: DATABASE_URL })
const MIGRATIONS_DIR = path.resolve(__dirname, "../src/db/migrations")
const command = process.argv[2] ?? "up"

async function ensureTrackingTable(client: PoolClient): Promise<void> {
	await client.query(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename   TEXT PRIMARY KEY,
			applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`)
}

async function migrateUp(): Promise<void> {
	const client = await pool.connect()
	try {
		await ensureTrackingTable(client)

		const { rows: applied } = await client.query<{ filename: string }>(
			"SELECT filename FROM schema_migrations ORDER BY filename",
		)
		const appliedSet = new Set(
			applied.map((r: { filename: string }) => r.filename),
		)

		const files = fs
			.readdirSync(MIGRATIONS_DIR)
			.filter((f: string) => f.endsWith(".sql") && !f.endsWith(".undo.sql"))
			.sort()

		let ran = 0
		for (const file of files) {
			if (appliedSet.has(file)) {
				console.log(`  skip  ${file}`)
				continue
			}

			const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")
			console.log(`  apply ${file}`)

			await client.query("BEGIN")
			try {
				// Non-parameterized query uses the simple query protocol,
				// which supports multiple statements in a single call.
				await client.query(sql)
				await client.query(
					"INSERT INTO schema_migrations (filename) VALUES ($1)",
					[file],
				)
				await client.query("COMMIT")
				ran++
			} catch (err) {
				await client.query("ROLLBACK")
				console.error(`  FAILED ${file}:`, err)
				process.exit(1)
			}
		}

		console.log(`\nMigrations complete. ${ran} new migration(s) applied.`)
	} finally {
		client.release()
		await pool.end()
	}
}

async function migrateDown(): Promise<void> {
	const client: PoolClient = await pool.connect()
	try {
		await ensureTrackingTable(client)

		const { rows } = await client.query<{ filename: string }>(
			"SELECT filename FROM schema_migrations ORDER BY filename DESC LIMIT 1",
		)

		if (rows.length === 0) {
			console.log("Nothing to roll back.")
			return
		}

		const last = rows[0].filename
		const undoFile = last.replace(/\.sql$/, ".undo.sql")
		const undoPath = path.join(MIGRATIONS_DIR, undoFile)

		if (!fs.existsSync(undoPath)) {
			console.error(
				`  ERROR: No undo file found for ${last} (expected ${undoFile})`,
			)
			process.exit(1)
		}

		const sql = fs.readFileSync(undoPath, "utf8")
		console.log(`  rollback ${last}`)

		await client.query("BEGIN")
		try {
			await client.query(sql)
			await client.query("DELETE FROM schema_migrations WHERE filename = $1", [
				last,
			])
			await client.query("COMMIT")
			console.log(`\nRolled back: ${last}`)
		} catch (err) {
			await client.query("ROLLBACK")
			console.error(`  FAILED rollback of ${last}:`, err)
			process.exit(1)
		}
	} finally {
		client.release()
		await pool.end()
	}
}

if (command === "down") {
	migrateDown().catch((err) => {
		console.error(err)
		process.exit(1)
	})
} else {
	migrateUp().catch((err) => {
		console.error(err)
		process.exit(1)
	})
}
