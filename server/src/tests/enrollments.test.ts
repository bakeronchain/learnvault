process.env.JWT_SECRET = "learnvault-secret"
delete process.env.COURSE_MILESTONE_CONTRACT_ID

jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
	},
}))

jest.mock("../services/stellar-contract.service", () => ({
	stellarContractService: {
		isEnrolled: jest.fn().mockResolvedValue(true),
	},
}))

import express, { type Express } from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { pool } from "../db/index"
import { errorHandler } from "../middleware/error.middleware"
import { createEnrollmentsRouter } from "../routes/enrollments.routes"
import { stellarContractService } from "../services/stellar-contract.service"

const mockedQuery = pool.query as jest.Mock
const mockedIsEnrolled = stellarContractService.isEnrolled as jest.Mock

const TEST_SECRET = "learnvault-secret"
const LEARNER = "GALICE1234567890ABCDE"
const OTHER_LEARNER = "GBOB9876543210ZYXWVU"
const COURSE_SLUG = "stellar-basics"
const TX_HASH = "abc123def4567890"

const makeToken = (address: string) =>
	`Bearer ${jwt.sign({ sub: address, jti: "test-jti" }, TEST_SECRET)}`

const testJwtService = {
	signWalletToken: (address: string) =>
		jwt.sign({ sub: address, jti: "test-jti" }, TEST_SECRET),
	verifyWalletToken: async (token: string) => {
		const decoded = jwt.verify(token, TEST_SECRET) as {
			sub?: string
			jti?: string
		}
		if (!decoded.sub) throw new Error("Invalid token")
		return { sub: decoded.sub, jti: decoded.jti ?? "test-jti" }
	},
	revokeToken: async (_token: string) => {},
}

const buildApp = (): Express => {
	const app = express()
	app.use(express.json())
	app.use("/api", createEnrollmentsRouter(testJwtService))
	app.use(errorHandler)
	return app
}

const enrollmentPayload = {
	learner_address: LEARNER,
	course_id: COURSE_SLUG,
	tx_hash: TX_HASH,
}

beforeEach(() => {
	jest.clearAllMocks()
	mockedQuery.mockReset()
	mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 })
	mockedIsEnrolled.mockResolvedValue(true)
	delete process.env.COURSE_MILESTONE_CONTRACT_ID
})

describe("POST /api/enrollments", () => {
	it("allows an authenticated user to enroll in a course", async () => {
		const enrolledAt = "2026-05-27T12:00:00.000Z"
		mockedQuery
			.mockResolvedValueOnce({ rows: [{ id: 1 }] })
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ content_version: 2 }] })
			.mockResolvedValueOnce({
				rows: [
					{
						id: 42,
						enrolled_at: enrolledAt,
						content_version: 2,
					},
				],
			})

		const res = await request(buildApp())
			.post("/api/enrollments")
			.set("Authorization", makeToken(LEARNER))
			.send(enrollmentPayload)

		expect(res.status).toBe(201)
		expect(res.body).toEqual({
			enrollment_id: 42,
			enrolled_at: enrolledAt,
			content_version: 2,
		})
	})

	it("returns 401 when the user is not authenticated", async () => {
		const res = await request(buildApp())
			.post("/api/enrollments")
			.send(enrollmentPayload)

		expect(res.status).toBe(401)
		expect(res.body).toEqual({ error: "Unauthorized" })
		expect(mockedQuery).not.toHaveBeenCalled()
	})

	it("returns 409 when the learner is already enrolled", async () => {
		mockedQuery
			.mockResolvedValueOnce({ rows: [{ id: 1 }] })
			.mockResolvedValueOnce({ rows: [{ id: 99 }] })

		const res = await request(buildApp())
			.post("/api/enrollments")
			.set("Authorization", makeToken(LEARNER))
			.send(enrollmentPayload)

		expect(res.status).toBe(409)
		expect(res.body).toEqual({ error: "Already enrolled in this course" })
	})

	it("returns 404 when enrolling in a non-existent course", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [] })

		const res = await request(buildApp())
			.post("/api/enrollments")
			.set("Authorization", makeToken(LEARNER))
			.send({
				...enrollmentPayload,
				course_id: "missing-course",
			})

		expect(res.status).toBe(404)
		expect(res.body).toEqual({ error: "Course not found" })
	})

	it("writes the correct enrollment record to the database", async () => {
		const enrolledAt = "2026-05-27T12:00:00.000Z"
		mockedQuery
			.mockResolvedValueOnce({ rows: [{ id: 1 }] })
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ content_version: 3 }] })
			.mockResolvedValueOnce({
				rows: [
					{
						id: 7,
						enrolled_at: enrolledAt,
						content_version: 3,
					},
				],
			})

		await request(buildApp())
			.post("/api/enrollments")
			.set("Authorization", makeToken(LEARNER))
			.send(enrollmentPayload)

		const insertCall = mockedQuery.mock.calls.find(([sql]) =>
			String(sql).includes("INSERT INTO enrollments"),
		)
		expect(insertCall).toBeDefined()
		expect(insertCall?.[1]).toEqual([LEARNER, COURSE_SLUG, TX_HASH, 3])
	})

	it("returns 400 when learner_address does not match the authenticated user", async () => {
		const res = await request(buildApp())
			.post("/api/enrollments")
			.set("Authorization", makeToken(LEARNER))
			.send({
				...enrollmentPayload,
				learner_address: OTHER_LEARNER,
			})

		expect(res.status).toBe(400)
		expect(res.body.error).toContain("learner_address must match")
		expect(mockedQuery).not.toHaveBeenCalled()
	})
})

describe("GET /api/enrollments", () => {
	it("returns enrollment status for a learner", async () => {
		const enrolledAt = "2026-05-27T12:00:00.000Z"
		mockedQuery.mockResolvedValueOnce({
			rows: [
				{
					id: 42,
					learner_address: LEARNER,
					course_id: COURSE_SLUG,
					tx_hash: TX_HASH,
					enrolled_at: enrolledAt,
					content_version: 2,
				},
			],
		})

		const res = await request(buildApp()).get(
			`/api/enrollments?learner_address=${LEARNER}`,
		)

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(1)
		expect(res.body.data[0]).toEqual({
			enrollment_id: 42,
			course_id: COURSE_SLUG,
			tx_hash: TX_HASH,
			enrolled_at: enrolledAt,
			content_version: 2,
		})
		expect(mockedQuery).toHaveBeenCalledWith(
			expect.stringContaining("FROM enrollments"),
			[LEARNER],
		)
	})

	it("returns 400 when learner_address is missing", async () => {
		const res = await request(buildApp()).get("/api/enrollments")
		expect(res.status).toBe(400)
		expect(res.body.error).toContain("learner_address")
	})
})
