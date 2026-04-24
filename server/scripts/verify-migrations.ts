#!/usr/bin/env ts-node
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
const schemaName = `migration_verify_${Date.now()}_${Math.floor(Math.random() * 10_000)}`

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(message)
	}
}

function listUpMigrations(): string[] {
	return fs
		.readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith(".sql") && !f.endsWith(".undo.sql"))
		.sort()
}

function listDownMigrations(): string[] {
	return fs
		.readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith(".undo.sql"))
		.sort()
}

async function setSearchPath(client: PoolClient): Promise<void> {
	await client.query(`SET search_path TO "${schemaName}", public`)
}

async function applyMigration(
	client: PoolClient,
	filename: string,
): Promise<void> {
	const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8")
	await client.query("BEGIN")
	try {
		await setSearchPath(client)
		await client.query(sql)
		await client.query("COMMIT")
		console.log(`  apply ${filename}`)
	} catch (err) {
		await client.query("ROLLBACK")
		throw new Error(`Failed applying ${filename}: ${String(err)}`)
	}
}

async function rollbackMigration(
	client: PoolClient,
	filename: string,
): Promise<void> {
	const undoFile = filename.replace(/\.sql$/, ".undo.sql")
	const undoPath = path.join(MIGRATIONS_DIR, undoFile)
	if (!fs.existsSync(undoPath)) {
		throw new Error(`Missing undo file for ${filename} (${undoFile})`)
	}

	const sql = fs.readFileSync(undoPath, "utf8")
	await client.query("BEGIN")
	try {
		await setSearchPath(client)
		await client.query(sql)
		await client.query("COMMIT")
		console.log(`  rollback ${filename}`)
	} catch (err) {
		await client.query("ROLLBACK")
		throw new Error(`Failed rollback for ${filename}: ${String(err)}`)
	}
}

async function verifyConstraints(client: PoolClient): Promise<void> {
	await setSearchPath(client)

	const notNullResult = await client.query(
		`SELECT is_nullable
		 FROM information_schema.columns
		 WHERE table_schema = $1
		   AND table_name = 'lessons'
		   AND column_name = 'estimated_minutes'`,
		[schemaName],
	)
	assert(notNullResult.rows[0]?.is_nullable === "NO", "lessons.estimated_minutes must be NOT NULL")

	const uniqueResult = await client.query(
		`SELECT 1
		 FROM pg_constraint c
		 JOIN pg_class t ON t.oid = c.conrelid
		 JOIN pg_namespace n ON n.oid = t.relnamespace
		 WHERE n.nspname = $1
		   AND t.relname = 'enrollments'
		   AND c.contype = 'u'
		   AND pg_get_constraintdef(c.oid) ILIKE '%(learner_address, course_id)%'`,
		[schemaName],
	)
	assert(uniqueResult.rows.length > 0, "Expected UNIQUE(learner_address, course_id) on enrollments")

	const fkResult = await client.query(
		`SELECT 1
		 FROM pg_constraint c
		 JOIN pg_class t ON t.oid = c.conrelid
		 JOIN pg_namespace n ON n.oid = t.relnamespace
		 WHERE n.nspname = $1
		   AND t.relname = 'lessons'
		   AND c.contype = 'f'
		   AND pg_get_constraintdef(c.oid) ILIKE '%REFERENCES courses(id)%'`,
		[schemaName],
	)
	assert(fkResult.rows.length > 0, "Expected lessons.course_id foreign key to courses(id)")

	console.log("  constraints validated")
}

async function verifyIndexes(client: PoolClient): Promise<void> {
	await setSearchPath(client)
	const expectedIndexes = [
		"idx_lessons_course_id",
		"idx_milestones_course_id",
		"idx_quiz_questions_quiz_id",
		"idx_proposals_status_created_at",
		"idx_votes_proposal_id",
		"idx_enrollments_learner_address",
		"idx_events_contract_event_ledger",
		"idx_milestone_reports_scholar_status_submitted",
		"idx_milestone_audit_report_decided_at",
	]

	const result = await client.query(
		`SELECT indexname
		 FROM pg_indexes
		 WHERE schemaname = $1`,
		[schemaName],
	)
	const indexSet = new Set<string>(
		result.rows.map((row) => String(row.indexname)),
	)

	for (const indexName of expectedIndexes) {
		assert(indexSet.has(indexName), `Missing expected index: ${indexName}`)
	}
	console.log("  indexes validated")
}

async function verifyRollbackReachedCleanSchema(
	client: PoolClient,
): Promise<void> {
	await setSearchPath(client)
	const result = await client.query(
		`SELECT COUNT(*)::int AS count
		 FROM information_schema.tables
		 WHERE table_schema = $1`,
		[schemaName],
	)
	const tableCount = Number(result.rows[0]?.count ?? 0)
	assert(tableCount === 0, `Expected empty schema after full rollback, found ${tableCount} table(s)`)
	console.log("  rollback validated (schema clean)")
}

async function main(): Promise<void> {
	const client = await pool.connect()
	try {
		console.log(`Creating verification schema: ${schemaName}`)
		await client.query(`CREATE SCHEMA "${schemaName}"`)
		await setSearchPath(client)

		const upMigrations = listUpMigrations()
		const downMigrations = listDownMigrations()
		assert(upMigrations.length > 0, "No migration files found")
		assert(downMigrations.length > 0, "No undo migration files found")

		console.log("\nStep 1: apply all migrations")
		for (const file of upMigrations) {
			await applyMigration(client, file)
		}

		console.log("\nStep 2: idempotency check (re-apply all migrations)")
		for (const file of upMigrations) {
			await applyMigration(client, file)
		}

		console.log("\nStep 3: validate constraints and indexes")
		await verifyConstraints(client)
		await verifyIndexes(client)

		console.log("\nStep 4: rollback each migration in reverse order")
		for (const file of [...upMigrations].reverse()) {
			await rollbackMigration(client, file)
		}
		await verifyRollbackReachedCleanSchema(client)

		console.log("\nStep 5: re-apply all migrations after rollback")
		for (const file of upMigrations) {
			await applyMigration(client, file)
		}

		console.log("\nMigration verification complete.")
	} finally {
		try {
			await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
		} finally {
			client.release()
			await pool.end()
		}
	}
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
