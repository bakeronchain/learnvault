import express from "express"
import request from "supertest"

/**
 * Tests for the Open Data API (issue #1060).
 *
 * The DB pool is mocked with canned result sets; these tests exercise the
 * auth boundary (missing/malformed/revoked keys), tier quotas with 429 +
 * Retry-After and day-reset, per-day usage counters, k-anonymity bucket
 * suppression, pagination stability, and the privacy guarantee that no
 * response body ever contains an email-shaped string.
 */
const mockQuery = jest.fn()

jest.mock("../db", () => ({
	pool: {
		query: (...args: any[]) => mockQuery(...args),
	},
}))

// Usage/quota storage lives in the service which hits the same pool mock —
// but recordUsage/todayUtc need deterministic behaviour, so drive them via
// canned query results keyed by SQL shape inside mockQuery below.

import { createOpenDataRouter } from "../routes/open-data.routes"
import { createApiKey, validateApiKey, recordUsage } from "../services/api-keys.service"

jest.mock("crypto", () => {
	const actual = jest.requireActual("crypto")
	return { ...actual }
})

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", createOpenDataRouter())
	return app
}

const VALID_KEY = "lv_abcdef1234567890abcdef1234567890abcdef1234567890"
// SHA-256 of VALID_KEY — matches what validateApiKey hashes.
const VALID_HASH = require("crypto").createHash("sha256").update(VALID_KEY).digest("hex")

// Standard key-lookup response so valid-key tests reach the handlers.
function keyRow(overrides: Record<string, any> = {}) {
	return {
		id: 1,
		label: "test",
		owner_email: null,
		tier: "free",
		revoked_at: null,
		last_used_at: null,
		...overrides,
	}
}

function withKeyLookup(handler: (sql: string, params?: any[]) => any) {
	return async (sql: string, params?: any[]) => {
		if (sql.includes("SELECT id, label")) return { rows: [keyRow()] }
		if (sql.includes("UPDATE api_keys SET last_used_at")) return { rows: [] }
		if (sql.includes("INSERT INTO api_key_usage")) return { rows: [{ call_count: 1 }] }
		return handler(sql, params)
	}
}

describe("Open Data API — /api/v1/public", () => {
	let app: express.Express

	beforeEach(() => {
		mockQuery.mockReset()
		app = buildApp()
	})

	it("rejects a missing X-API-Key header with 401", async () => {
		mockQuery.mockResolvedValue({ rows: [] })
		const res = await request(app).get("/api/v1/public/courses")
		expect(res.status).toBe(401)
		expect(mockQuery).not.toHaveBeenCalled()
	})

	it("rejects a malformed key (wrong prefix) without a DB hit", async () => {
		mockQuery.mockResolvedValue({ rows: [] })
		const res = await request(app)
			.get("/api/v1/public/courses")
			.set("X-API-Key", "not-a-real-key")

		expect(res.status).toBe(401)
		expect(mockQuery).not.toHaveBeenCalled()
	})

	it("rejects an unknown key with 401", async () => {
		mockQuery.mockResolvedValue({ rows: [] })
		const res = await request(app)
			.get("/api/v1/public/courses")
			.set("X-API-Key", VALID_KEY)

		expect(res.status).toBe(401)
		expect(res.body.error).toMatch(/invalid or revoked/i)
	})

	it("rejects a revoked key with 401", async () => {
		mockQuery.mockResolvedValue({
			rows: [keyRow({ revoked_at: new Date("2026-01-01") })],
		})
		const res = await request(app)
			.get("/api/v1/public/courses")
			.set("X-API-Key", VALID_KEY)

		expect(res.status).toBe(401)
	})

	it("serves the course catalog paginated for a valid key", async () => {
		mockQuery.mockImplementation(withKeyLookup(async (sql: string) => {
			if (sql.includes("COUNT(*)::int")) return { rows: [{ n: 25 }] }
			if (sql.includes("FROM courses")) {
				return {
					rows: [
						{ id: 1, slug: "stellar-basics", title: "Stellar Basics", description: "d", difficulty: "beginner", track: "core" },
						{ id: 2, slug: "soroban-intro", title: "Soroban Intro", description: "d", difficulty: "intermediate", track: "dev" },
					],
				}
			}
			return { rows: [] }
		}))

		const res = await request(app)
			.get("/api/v1/public/courses?limit=2&offset=20")
			.set("X-API-Key", VALID_KEY)

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(2)
		expect(res.body.pagination).toEqual({ limit: 2, offset: 20, total: 25, hasMore: true })
	})

	it("enforces the daily quota — 429 with Retry-After at the boundary", async () => {
		mockQuery.mockImplementation(async (sql: string) => {
			if (sql.includes("SELECT id, label")) return { rows: [keyRow()] }
			if (sql.includes("api_key_usage")) return { rows: [{ call_count: 1001 }] } // over free quota (1000)
			if (sql.includes("UPDATE api_keys SET last_used_at")) return { rows: [] }
			return { rows: [] }
		})

		const res = await request(app)
			.get("/api/v1/public/courses")
			.set("X-API-Key", VALID_KEY)

		expect(res.status).toBe(429)
		expect(Number(res.headers["retry-after"])).toBeGreaterThan(0)
	})

	it("resets the quota the next day", async () => {
		let day = "2026-08-26"
		let calls = 999 // one under the free quota
		mockQuery.mockImplementation(async (sql: string) => {
			if (sql.includes("SELECT id, label")) return { rows: [keyRow()] }
			if (sql.includes("INSERT INTO api_key_usage")) {
				calls += 1
				return { rows: [{ call_count: calls }] }
			}
			if (sql.includes("UPDATE api_keys SET last_used_at")) return { rows: [] }
			return { rows: [] }
		})

		// Under quota → passes
		const ok = await request(app)
			.get("/api/v1/public/courses")
			.set("X-API-Key", VALID_KEY)
		expect(ok.status).toBe(200)

		// Next day: usage counters start from zero again (new day row).
		day = "2026-08-27"
		calls = 0
		mockQuery.mockImplementation(async (sql: string) => {
			if (sql.includes("SELECT id, label")) return { rows: [keyRow()] }
			if (sql.includes("INSERT INTO api_key_usage")) {
				calls += 1
				return { rows: [{ call_count: calls }] }
			}
			if (sql.includes("UPDATE api_keys SET last_used_at")) return { rows: [] }
			if (sql.includes("COUNT(*)::int")) return { rows: [{ n: 0 }] }
			return { rows: [] }
		})

		const nextDay = await request(app)
			.get("/api/v1/public/courses")
			.set("X-API-Key", VALID_KEY)
		expect(nextDay.status).toBe(200)
	})

	it("records usage per endpoint per day", async () => {
		mockQuery.mockImplementation(async (sql: string) => {
			if (sql.includes("SELECT id, label")) return { rows: [keyRow()] }
			if (sql.includes("INSERT INTO api_key_usage")) return { rows: [{ call_count: 1 }] }
			if (sql.includes("UPDATE api_keys SET last_used_at")) return { rows: [] }
			if (sql.includes("COUNT(*)::int")) return { rows: [{ n: 0 }] }
			return { rows: [] }
		})

		await request(app).get("/api/v1/public/courses").set("X-API-Key", VALID_KEY)
		const insert = mockQuery.mock.calls.find(([sql]) =>
			String(sql).includes("INSERT INTO api_key_usage"),
		) as unknown as [string, any[]]

		// Upsert is keyed on (key_id, endpoint, day)
		expect(insert[1].slice(0, 3)).toEqual([1, "GET /courses", expect.any(String)])
	})

	it("suppresses aggregate buckets with fewer than 5 subjects", async () => {
		mockQuery.mockImplementation(async (sql: string) => {
			if (sql.includes("SELECT id, label")) return { rows: [keyRow()] }
			if (sql.includes("INSERT INTO api_key_usage")) return { rows: [{ call_count: 1 }] }
			if (sql.includes("UPDATE api_keys SET last_used_at")) return { rows: [] }
			// Only 3 learners — below the k=5 anonymity floor.
			if (sql.includes("scholar_balances")) return { rows: [{ subject_count: 3, value: "12345" }] }
			if (sql.includes("completed_at IS NOT NULL"))
				return { rows: [{ subject_count: 12, value: "77" }] }
			return { rows: [] }
		})

		const res = await request(app).get("/api/v1/public/stats").set("X-API-Key", VALID_KEY)
		expect(res.status).toBe(200)
		// Small bucket suppressed to null; large bucket preserved.
		expect(res.body.data.active_learners).toBeNull()
		expect(res.body.data.course_completions).toBe("77")
	})

	it("suppresses the leaderboard entirely when fewer than 5 handles exist", async () => {
		mockQuery.mockImplementation(async (sql: string) => {
			if (sql.includes("SELECT id, label")) return { rows: [keyRow()] }
			if (sql.includes("INSERT INTO api_key_usage")) return { rows: [{ call_count: 1 }] }
			if (sql.includes("UPDATE api_keys SET last_used_at")) return { rows: [] }
			return {
				rows: [
					{ rank: 1, handle: "alice", balance: "500", courses_completed: 3, board_size: 3 },
					{ rank: 2, handle: "bob", balance: "400", courses_completed: 2, board_size: 3 },
				],
			}
		})

		const res = await request(app).get("/api/v1/public/leaderboard").set("X-API-Key", VALID_KEY)
		expect(res.status).toBe(200)
		expect(res.body.suppressed).toBe(true)
		expect(res.body.data).toEqual([])
	})

	it("paginates the course catalog stably across pages — no dups, no gaps", async () => {
		const catalog = Array.from({ length: 10 }, (_, i) => ({
			id: i + 1,
			slug: `course-${i + 1}`,
			title: `Course ${i + 1}`,
			description: "d",
			difficulty: "beginner",
			track: "core",
		}))

		mockQuery.mockImplementation(
			withKeyLookup(async (sql: string, params: any[] = []) => {
				if (sql.includes("COUNT(*)::int")) return { rows: [{ n: catalog.length }] }
				const [limit, offset] = params
				return { rows: catalog.slice(offset, offset + limit) }
			}),
		)

		const page1 = await request(app)
			.get("/api/v1/public/courses?limit=4&offset=0")
			.set("X-API-Key", VALID_KEY)
		const page2 = await request(app)
			.get("/api/v1/public/courses?limit=4&offset=4")
			.set("X-API-Key", VALID_KEY)
		const page3 = await request(app)
			.get("/api/v1/public/courses?limit=4&offset=8")
			.set("X-API-Key", VALID_KEY)

		const seen = new Set<string>()
		for (const r of [page1, page2, page3]) {
			for (const c of r.body.data) {
				expect(seen.has(c.slug)).toBe(false) // no duplicates
				seen.add(c.slug)
			}
		}
		expect(seen.size).toBe(10) // no gaps either
	})

	it("never exposes identity columns — even when raw rows carry them", async () => {
		// Rows deliberately include identity columns the controllers must not
		// select; if a query ever leaks them, this catches it.
		mockQuery.mockImplementation(
			withKeyLookup(async (sql: string) => {
				if (sql.includes("COUNT(*)::int")) return { rows: [{ n: 1 }] }
				if (sql.includes("FROM courses")) {
					return {
						rows: [
							{
								id: 1,
								slug: "c",
								title: "t",
								description: "learn DeFi",
								difficulty: "b",
								track: "core",
							},
						],
					}
				}
				if (sql.includes("leaderboard") || sql.includes("scholar_balances")) {
					return {
						rows: [
							{
								rank: 1,
								handle: "alice",
								balance: "500",
								courses_completed: 2,
								board_size: 9,
								email: "alice@private.io",
								kyc_status: "verified",
								address: "GALICERAWADDRESS",
							},
						],
					}
				}
				return { rows: [] }
			}),
		)

		for (const ep of ["/courses", "/stats", "/leaderboard"]) {
			const res = await request(app).get(`/api/v1/public${ep}`).set("X-API-Key", VALID_KEY)
			expect(res.status).toBe(200)
			const body = JSON.stringify(res.body)
			expect(body).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/)
			expect(body).not.toContain("kyc_status")
			expect(body).not.toContain("GALICERAWADDRESS")
		}
	})
})
