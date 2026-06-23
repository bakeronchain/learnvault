/**
 * Unit tests for the certificates controller.
 *
 * Covers:
 *  - Unauthenticated request → 401
 *  - Course not found → 404
 *  - Course not completed → 403 with progress summary
 *  - Happy path (course completed) → 200 PDF + stored metadata
 *  - Duplicate request → 200 PDF using existing certificate row
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("../db/index", () => ({
	pool: { query: jest.fn() },
}))

// pdfkit writes async chunks; stub it so tests run synchronously.
// We use a plain class (not jest.fn) so resetAllMocks() doesn't wipe it out.
jest.mock("pdfkit", () => {
	const { EventEmitter } = require("events")
	function MockPDFDocument() {
		const doc = new EventEmitter() as any
		doc.fontSize = () => doc
		doc.font = () => doc
		doc.text = () => doc
		doc.moveDown = () => doc
		doc.fillColor = () => doc
		doc.pipe = () => doc
		doc.end = () => {
			doc.emit("data", Buffer.from("PDF_CONTENT"))
			doc.emit("end")
		}
		return doc
	}
	return MockPDFDocument
})

// ── Imports ───────────────────────────────────────────────────────────────────

import express, { type Express } from "express"
import jwt from "jsonwebtoken"
import request from "supertest"

import { pool } from "../db/index"
import { createCoursesRouter } from "../routes/courses.routes"

const mockedQuery = pool.query as jest.Mock

// ── Test helpers ──────────────────────────────────────────────────────────────

const TEST_SECRET = "learnvault-test-secret"
const ALICE = "GALICE1234567890ABCDEFGH"
const COURSE_SLUG = "stellar-basics"

const testJwtService = {
	signWalletToken: (address: string) =>
		jwt.sign({ sub: address, jti: "jti-test" }, TEST_SECRET),
	verifyWalletToken: async (token: string) => {
		const decoded = jwt.verify(token, TEST_SECRET) as {
			sub?: string
			jti?: string
		}
		if (!decoded.sub) throw new Error("Invalid token")
		return { sub: decoded.sub, jti: decoded.jti ?? "jti-test" }
	},
	revokeToken: async (_token: string) => {},
}

const makeToken = (address: string) =>
	`Bearer ${jwt.sign({ sub: address, jti: "jti-test" }, TEST_SECRET)}`

function buildApp(): Express {
	const app = express()
	app.use(express.json())
	app.use("/api", createCoursesRouter(testJwtService as any))
	return app
}

beforeEach(() => {
	jest.resetAllMocks()
})

// ── Unauthenticated ───────────────────────────────────────────────────────────

describe("GET /api/courses/:courseId/certificate — unauthenticated", () => {
	it("returns 401 when no Authorization header is sent", async () => {
		const res = await request(buildApp()).get(
			`/api/courses/${COURSE_SLUG}/certificate`,
		)
		expect(res.status).toBe(401)
		expect(mockedQuery).not.toHaveBeenCalled()
	})

	it("returns 401 when the JWT is invalid", async () => {
		const res = await request(buildApp())
			.get(`/api/courses/${COURSE_SLUG}/certificate`)
			.set("Authorization", "Bearer not-a-real-jwt")
		expect(res.status).toBe(401)
		expect(mockedQuery).not.toHaveBeenCalled()
	})
})

// ── Course not found ──────────────────────────────────────────────────────────

describe("GET /api/courses/:courseId/certificate — course not found", () => {
	it("returns 404 when the course does not exist", async () => {
		// course lookup returns no rows
		mockedQuery.mockResolvedValueOnce({ rows: [] })

		const res = await request(buildApp())
			.get(`/api/courses/nonexistent-course/certificate`)
			.set("Authorization", makeToken(ALICE))

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({ error: "Course not found" })
	})
})

// ── Course not completed ──────────────────────────────────────────────────────

describe("GET /api/courses/:courseId/certificate — course not completed", () => {
	it("returns 403 with progress summary when milestones are not all approved", async () => {
		// 1. course lookup
		mockedQuery.mockResolvedValueOnce({
			rows: [{ slug: COURSE_SLUG, title: "Stellar Basics", lrn_reward: "50" }],
		})
		// 2. total milestones
		mockedQuery.mockResolvedValueOnce({ rows: [{ total: "3" }] })
		// 3. approved milestones
		mockedQuery.mockResolvedValueOnce({ rows: [{ approved: "1" }] })

		const res = await request(buildApp())
			.get(`/api/courses/${COURSE_SLUG}/certificate`)
			.set("Authorization", makeToken(ALICE))

		expect(res.status).toBe(403)
		expect(res.body).toMatchObject({
			error: "Course not completed",
			progress: {
				milestones_total: 3,
				milestones_approved: 1,
				milestones_remaining: 2,
				percent_complete: 33,
			},
		})
	})

	it("returns 403 when the user has zero approved milestones", async () => {
		mockedQuery.mockResolvedValueOnce({
			rows: [{ slug: COURSE_SLUG, title: "Stellar Basics", lrn_reward: "50" }],
		})
		mockedQuery.mockResolvedValueOnce({ rows: [{ total: "4" }] })
		mockedQuery.mockResolvedValueOnce({ rows: [{ approved: "0" }] })

		const res = await request(buildApp())
			.get(`/api/courses/${COURSE_SLUG}/certificate`)
			.set("Authorization", makeToken(ALICE))

		expect(res.status).toBe(403)
		expect(res.body.progress.percent_complete).toBe(0)
	})
})

// ── Happy path ────────────────────────────────────────────────────────────────

describe("GET /api/courses/:courseId/certificate — happy path", () => {
	function setupCompletedCourse() {
		// 1. course lookup
		mockedQuery.mockResolvedValueOnce({
			rows: [
				{ slug: COURSE_SLUG, title: "Stellar Basics", lrn_reward: "100" },
			],
		})
		// 2. total milestones
		mockedQuery.mockResolvedValueOnce({ rows: [{ total: "2" }] })
		// 3. approved milestones
		mockedQuery.mockResolvedValueOnce({ rows: [{ approved: "2" }] })
		// 4. completion date
		mockedQuery.mockResolvedValueOnce({
			rows: [{ completed_at: new Date("2025-03-01T12:00:00Z") }],
		})
		// 5. existing certificate lookup — not found (first time)
		mockedQuery.mockResolvedValueOnce({ rows: [] })
		// 6. INSERT into certificates
		mockedQuery.mockResolvedValueOnce({
			rows: [{ id: 42, issued_at: new Date("2025-03-01T12:05:00Z") }],
		})
	}

	it("responds with a PDF for a fully completed course", async () => {
		setupCompletedCourse()

		const res = await request(buildApp())
			.get(`/api/courses/${COURSE_SLUG}/certificate`)
			.set("Authorization", makeToken(ALICE))

		expect(res.status).toBe(200)
		expect(res.headers["content-type"]).toMatch(/application\/pdf/)
		expect(res.headers["x-certificate-id"]).toBe("42")
		expect(res.headers["x-certificate-hash"]).toMatch(/^[a-f0-9]{64}$/)
	})

	it("persists certificate metadata to the database", async () => {
		setupCompletedCourse()

		await request(buildApp())
			.get(`/api/courses/${COURSE_SLUG}/certificate`)
			.set("Authorization", makeToken(ALICE))

		// The 6th call is the INSERT
		const insertCall = mockedQuery.mock.calls[5]
		expect(insertCall[0]).toMatch(/INSERT INTO certificates/)
		expect(insertCall[1][0]).toBe(ALICE) // user_id
		expect(insertCall[1][1]).toBe(COURSE_SLUG) // course_id
		expect(typeof insertCall[1][2]).toBe("string") // pdf_hash (hex)
		expect(insertCall[1][2]).toHaveLength(64)
	})
})

// ── Duplicate request ─────────────────────────────────────────────────────────

describe("GET /api/courses/:courseId/certificate — duplicate request", () => {
	it("returns the existing certificate without re-inserting", async () => {
		// 1. course lookup
		mockedQuery.mockResolvedValueOnce({
			rows: [
				{ slug: COURSE_SLUG, title: "Stellar Basics", lrn_reward: "100" },
			],
		})
		// 2. total milestones
		mockedQuery.mockResolvedValueOnce({ rows: [{ total: "2" }] })
		// 3. approved milestones
		mockedQuery.mockResolvedValueOnce({ rows: [{ approved: "2" }] })
		// 4. completion date
		mockedQuery.mockResolvedValueOnce({
			rows: [{ completed_at: new Date("2025-03-01T12:00:00Z") }],
		})
		// 5. existing certificate IS found (duplicate scenario)
		mockedQuery.mockResolvedValueOnce({
			rows: [
				{
					id: 99,
					issued_at: new Date("2025-03-01T11:00:00Z"),
					pdf_hash:
						"aabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd",
				},
			],
		})

		const res = await request(buildApp())
			.get(`/api/courses/${COURSE_SLUG}/certificate`)
			.set("Authorization", makeToken(ALICE))

		expect(res.status).toBe(200)
		expect(res.headers["content-type"]).toMatch(/application\/pdf/)
		expect(res.headers["x-certificate-id"]).toBe("99")
		// The stored hash is returned, not a freshly computed one
		expect(res.headers["x-certificate-hash"]).toBe(
			"aabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd",
		)

		// Only 5 DB calls — no INSERT on a duplicate
		expect(mockedQuery).toHaveBeenCalledTimes(5)
	})
})

// ── Verify endpoint ───────────────────────────────────────────────────────────

describe("GET /api/certificates/:certificateId/verify", () => {
	it("returns certificate details for a valid id", async () => {
		mockedQuery.mockResolvedValueOnce({
			rows: [
				{
					id: 42,
					user_id: ALICE,
					course_id: COURSE_SLUG,
					course_title: "Stellar Basics",
					issued_at: new Date("2025-03-01T12:05:00Z"),
					pdf_hash: "abc123",
					pdf_url: null,
				},
			],
		})

		const res = await request(buildApp()).get("/api/certificates/42/verify")

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			certificate_id: 42,
			verified: true,
			user_id: ALICE,
			course_id: COURSE_SLUG,
		})
	})

	it("returns 404 when the certificate does not exist", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [] })

		const res = await request(buildApp()).get("/api/certificates/9999/verify")

		expect(res.status).toBe(404)
	})

	it("returns 400 for a non-numeric certificate id", async () => {
		const res = await request(buildApp()).get(
			"/api/certificates/not-a-number/verify",
		)
		expect(res.status).toBe(400)
	})
})
