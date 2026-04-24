#!/usr/bin/env ts-node
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

const OUTPUT_PATH = path.resolve(
	__dirname,
	"../../docs/database/query-analysis.md",
)

const queries: Array<{ name: string; sql: string; params: unknown[] }> = [
	{
		name: "Courses list with enrollments",
		sql: `SELECT c.id, c.slug, c.title, COUNT(DISTINCT e.learner_address)::int AS students_count
		      FROM courses c
		      LEFT JOIN enrollments e ON e.course_id = c.slug
		      WHERE c.published_at IS NOT NULL
		      GROUP BY c.id, c.slug, c.title
		      ORDER BY c.created_at DESC
		      LIMIT $1 OFFSET $2`,
		params: [12, 0],
	},
	{
		name: "Course lessons with quiz payload",
		sql: `SELECT l.id, l.course_id, l.title, l.order_index,
		             BOOL_OR(m.id IS NOT NULL) AS is_milestone
		      FROM lessons l
		      LEFT JOIN milestones m ON m.lesson_id = l.id
		      LEFT JOIN quizzes q ON q.lesson_id = l.id
		      LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
		      WHERE l.course_id = $1
		      GROUP BY l.id
		      ORDER BY l.order_index ASC`,
		params: [1],
	},
	{
		name: "Milestone reports by scholar + status",
		sql: `SELECT *
		      FROM milestone_reports
		      WHERE scholar_address = $1 AND status = $2
		      ORDER BY submitted_at DESC`,
		params: [
			"GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
			"pending",
		],
	},
	{
		name: "Latest audit decision per report",
		sql: `SELECT DISTINCT ON (report_id) report_id, decided_at, contract_tx_hash
		      FROM milestone_audit_log
		      WHERE report_id = ANY($1::int[])
		      ORDER BY report_id, decided_at DESC`,
		params: [[1, 2, 3]],
	},
	{
		name: "Governance proposals listing",
		sql: `SELECT p.id, p.status, p.deadline, p.created_at
		      FROM proposals p
		      WHERE p.status = $1
		      ORDER BY p.created_at DESC
		      LIMIT $2 OFFSET $3`,
		params: ["pending", 20, 0],
	},
	{
		name: "Single proposal vote lookup",
		sql: `SELECT id FROM votes WHERE proposal_id = $1 AND voter_address = $2`,
		params: [1, "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"],
	},
	{
		name: "Leaderboard page",
		sql: `SELECT address, lrn_balance, courses_completed
		      FROM scholar_balances
		      ORDER BY lrn_balance DESC, address ASC
		      LIMIT $1 OFFSET $2`,
		params: [50, 0],
	},
	{
		name: "Enrollments by learner",
		sql: `SELECT id, learner_address, course_id, tx_hash, enrolled_at
		      FROM enrollments
		      WHERE learner_address = $1
		      ORDER BY enrolled_at DESC`,
		params: ["GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"],
	},
	{
		name: "Comments by proposal",
		sql: `SELECT id, author_address, content, created_at
		      FROM comments
		      WHERE proposal_id = $1
		      ORDER BY is_pinned DESC, created_at DESC
		      LIMIT $2 OFFSET $3`,
		params: ["1", 20, 0],
	},
	{
		name: "Recent events by contract",
		sql: `SELECT id, event_type, created_at
		      FROM events
		      WHERE contract = $1
		      ORDER BY created_at DESC
		      LIMIT $2`,
		params: ["sample_contract", 25],
	},
]

async function main(): Promise<void> {
	const pool = new Pool({ connectionString: DATABASE_URL })
	const client = await pool.connect()

	try {
		const lines: string[] = []
		lines.push("# Database Query Analysis")
		lines.push("")
		lines.push(
			`Generated: ${new Date().toISOString()} via \`npm run db:query:analyze\`.`,
		)
		lines.push("")

		for (const queryDef of queries) {
			lines.push(`## ${queryDef.name}`)
			lines.push("")
			lines.push("```sql")
			lines.push(queryDef.sql.trim())
			lines.push("```")
			lines.push("")

			try {
				const explainResult = await client.query(
					`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${queryDef.sql}`,
					queryDef.params,
				)
				lines.push("```text")
				for (const row of explainResult.rows) {
					lines.push(String(row["QUERY PLAN"]))
				}
				lines.push("```")
			} catch (err) {
				lines.push(
					"> Explain unavailable for this query in current environment.",
				)
				lines.push(`> Error: ${String(err)}`)
			}

			lines.push("")
		}

		try {
			const stats = await client.query(
				`SELECT
					LEFT(REGEXP_REPLACE(query, '\\s+', ' ', 'g'), 300) AS query,
					calls::int AS calls,
					total_exec_time::float8 AS total_exec_time_ms,
					mean_exec_time::float8 AS mean_exec_time_ms
				 FROM pg_stat_statements
				 ORDER BY mean_exec_time DESC
				 LIMIT 10`,
			)
			lines.push("## pg_stat_statements Top 10")
			lines.push("")
			lines.push("| mean_exec_time_ms | calls | total_exec_time_ms | query |")
			lines.push("| ---: | ---: | ---: | --- |")
			for (const row of stats.rows) {
				lines.push(
					`| ${Number(row.mean_exec_time_ms).toFixed(2)} | ${row.calls} | ${Number(row.total_exec_time_ms).toFixed(2)} | ${String(row.query).replace(/\|/g, "\\|")} |`,
				)
			}
			lines.push("")
		} catch {
			lines.push("## pg_stat_statements Top 10")
			lines.push("")
			lines.push(
				"> pg_stat_statements is not enabled on this PostgreSQL instance.",
			)
			lines.push("")
		}

		fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
		fs.writeFileSync(OUTPUT_PATH, lines.join("\n"))
		console.log(`Wrote query analysis report to ${OUTPUT_PATH}`)
	} finally {
		client.release()
		await pool.end()
	}
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
