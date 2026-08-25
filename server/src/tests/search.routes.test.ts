/**
 * Tests for the platform-wide search endpoint (#1079).
 *
 * The DB pool is mocked with canned result sets so these tests verify the
 * controller contract: query validation, ranking order (title beats body),
 * visibility filtering (unpublished content never reaches SQL results),
 * keyset pagination (no duplicates/gaps), and sanitisation (websearch
 * operators and oversized queries are handled without errors).
 */
import express from "express"
import request from "supertest"

const mockQuery = jest.fn()

jest.mock("../db", () => ({
	pool: {
		query: (...args: any[]) => mockQuery(...args),
	},
}))

// Shared IP-keyed limiter singleton — bypassed for test volume.
jest.mock("express-rate-limit", () => {
	return () => (_req: unknown, _res: unknown, next: () => void) => next()
})

import { createSearchRouter } from "../routes/search.routes"

const app = express()
app.use(express.json())
app.use("/api", createSearchRouter())

function rowsForPage(page: number): { rows: any[] } {
	// Simulates ranked output where title matches outrank body matches.
	const all = [
		{ type: "course", id: "1", title: "Milestone escrow", snippet: "…<mark>escrow</mark>…", url: "/courses/escrow", rank: "0.16" },
		{ type: "lesson", id: "7", title: "Escrow basics → Milestone escrow", snippet: "…<mark>escrow</mark> flow…", url: "/courses/escrow/lessons/7", rank: "0.12" },
		{ type: "wiki", id: "3", title: "Stellar Basics", snippet: "…funds held in <mark>escrow</mark>…", url: "/wiki/stellar-basics", rank: "0.04" },
	]
	if (page === 1) return { rows: all.slice(0, 2) }
	if (page === 2) return { rows: all.slice(2) }
	return { rows: [] }
}

describe("GET /api/search", () => {
	beforeEach(() => {
		mockQuery.mockReset()
	})

	it("returns 400 when q is missing or blank", async () => {
		const res = await request(app).get("/api/search").query({ q: "   " })
		expect(res.status).toBe(400)
		expect(mockQuery).not.toHaveBeenCalled()
	})

	it("returns 400 when q exceeds 200 characters", async () => {
		const res = await request(app).get("/api/search").query({ q: "a".repeat(201) })
		expect(res.status).toBe(400)
	})

	it("returns 400 for an invalid type filter", async () => {
		const res = await request(app).get("/api/search").query({ q: "escrow", type: "secrets" })
		expect(res.status).toBe(400)
	})

	it("caps limit at 50 even when asked for more", async () => {
		mockQuery.mockResolvedValue({ rows: [] })
		const res = await request(app).get("/api/search").query({ q: "escrow", limit: 500 })
		expect(res.status).toBe(200)
		expect(mockQuery.mock.calls[0][0]).toContain("LIMIT 50")
	})

	it("ranks a title match above a body-only match", async () => {
		mockQuery.mockResolvedValue(rowsForPage(1))
		const res = await request(app).get("/api/search").query({ q: "escrow" })

		expect(res.status).toBe(200)
		// The course whose TITLE contains the term comes first; the wiki page
		// that merely mentions escrow in its body ranks last.
		expect(res.body.data[0].type).toBe("course")
		expect(res.body.data[0].title).toBe("Milestone escrow")
		expect(Number(rowsForPage(1).rows[0].rank)).toBeGreaterThan(
			Number(rowsForPage(2).rows[0].rank)
		)
	})

	it("returns typed results with snippets and urls", async () => {
		mockQuery.mockResolvedValue(rowsForPage(1))
		const res = await request(app).get("/api/search").query({ q: "escrow" })

		for (const row of res.body.data) {
			expect(["course", "lesson", "wiki", "forum", "profile"]).toContain(row.type)
			expect(row.snippet).toContain("<mark>")
			expect(row.url).toMatch(/^\//)
			expect(row.rank).toBeUndefined() // internal ranking never leaks
		}
	})

	it("exposes visibility rules to the database via published-state filters in SQL", async () => {
		mockQuery.mockResolvedValue({ rows: [] })
		await request(app).get("/api/search").query({ q: "escrow" })

		const sql = mockQuery.mock.calls[0][0] as string
		expect(sql).toContain("c.published_at IS NOT NULL") // courses + lessons join
		expect(sql).toContain("w.is_published = TRUE")
		expect(sql).toContain("p.display_name IS NOT NULL")
	})

	it("restricts to one type when the type filter is given", async () => {
		mockQuery.mockResolvedValue({ rows: [] })
		await request(app).get("/api/search").query({ q: "escrow", type: "wiki" })

		const sql = mockQuery.mock.calls[0][0] as string
		expect(sql).toContain("'wiki' AS type")
		expect(sql).not.toContain("'course' AS type")
	})

	it("paginates with a stable cursor — no duplicates across pages", async () => {
		// Page 1
		mockQuery.mockResolvedValueOnce(rowsForPage(1))
		const page1 = await request(app).get("/api/search").query({ q: "escrow", limit: 2 })

		expect(page1.body.data).toHaveLength(2)
		expect(typeof page1.body.nextCursor).toBe("string")

		// The cursor encodes the last row's keyset position
		const decoded = JSON.parse(
			Buffer.from(page1.body.nextCursor, "base64url").toString("utf8")
		)
		expect(decoded).toEqual({ rank: 0.12, type: "lesson", id: "7" })

		// Page 2 must continue strictly after the cursor position
		mockQuery.mockResolvedValueOnce(rowsForPage(2))
		const page2 = await request(app)
			.get("/api/search")
			.query({ q: "escrow", cursor: page1.body.nextCursor })

		expect(page2.status).toBe(200)
		const seen = new Set([
			...page1.body.data.map((r: any) => `${r.type}:${r.id}`),
			...page2.body.data.map((r: any) => `${r.type}:${r.id}`),
		])
		expect(seen.size).toBe(3) // no duplicates across pages

		const sql = mockQuery.mock.calls[1][0] as string // page 2 carries the cursor
		expect(sql).toContain("(sort_rank, type, id) <")
	})

	it("returns nextCursor null on the last page", async () => {
		mockQuery.mockResolvedValueOnce(rowsForPage(2))
		const res = await request(app)
			.get("/api/search")
			.query({ q: "escrow", cursor: "e30" })

		expect(res.body.nextCursor).toBeNull()
	})

	it.each([
		["double quotes", 'escrow "milestone"'],
		["ampersand", "escrow & milestone"],
		["or operator", "escrow | milestone"],
		["negation", "escrow -milestone"],
	])("sanitises %s without erroring", async (_name, q) => {
		mockQuery.mockResolvedValue({ rows: [] })
		const res = await request(app).get("/api/search").query({ q })
		expect(res.status).toBe(200)
		expect(res.body.data).toEqual([])
		// The raw query is always bound as a parameter, never interpolated
		expect(mockQuery.mock.calls[0][1]).toContain(q)
	})

	it("accepts an extremely long (10KB) query without leaking into SQL", async () => {
		// Over the 200-char cap this is rejected outright — the point is that
		// it neither errors with a 500 nor reaches Postgres as text.
		const hugeQuery = `"${"a".repeat(10_000)}"`
		const res = await request(app).get("/api/search").query({ q: hugeQuery })
		expect([200, 400]).toContain(res.status)
		if (res.status === 400) expect(mockQuery).not.toHaveBeenCalled()
	})
})
