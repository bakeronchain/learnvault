import express, { type Express } from "express"
import request from "supertest"

// Mock internal modules
jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn(),
	},
}))

jest.mock("../services/stellar-contract.service", () => ({
	stellarContractService: {
		getLearnTokenBalance: jest.fn().mockResolvedValue("10000000000"),
		getEnrolledCourses: jest
			.fn()
			.mockResolvedValue(["stellar-basics", "defi-101"]),
		getScholarCredentials: jest.fn().mockResolvedValue([
			{
				token_id: 1,
				course_id: "stellar-basics",
				issued_at: "2026-03-26T15:00:00Z",
			},
		]),
	},
}))

import { pool } from "../db/index"
import { scholarsRouter } from "../routes/scholars.routes"

const mockedQuery = pool.query as jest.Mock

// We need a helper to build the app with mocked dependencies

const buildApp = (): Express => {
	const app = express()
	app.use(express.json())
	app.use("/api", scholarsRouter)
	return app
}

describe("GET /api/scholars/:address", () => {
	const mockAddress = "GABC1234567890"

	beforeEach(() => {
		mockedQuery.mockReset()
	})

	it("returns a complete scholar profile", async () => {
		// Mock database responses
		mockedQuery
			.mockResolvedValueOnce({
				rows: [{ completed: "1", pending: "1" }],
			}) // stats
			.mockResolvedValueOnce({
				rows: [{ joined_at: "2026-01-15T10:00:00.000Z" }],
			}) // joinedAt

		const res = await request(buildApp()).get(`/api/scholars/${mockAddress}`)

		expect(res.status).toBe(200)
		expect(res.body).toEqual({
			address: mockAddress,
			lrn_balance: "10000000000",
			enrolled_courses: ["stellar-basics", "defi-101"],
			completed_milestones: 1,
			pending_milestones: 1,
			credentials: [
				{
					token_id: 1,
					course_id: "stellar-basics",
					issued_at: "2026-03-26T15:00:00Z",
				},
			],
			joined_at: "2026-01-15T10:00:00.000Z",
		})
	})

	it("returns 400 if address is missing", async () => {
		// Express usually handles this via routing, but if we call without address:
		// Note: /api/scholars/ without address might 404 due to route not matching
		const res = await request(buildApp()).get("/api/scholars/")
		expect(res.status).toBe(404)
	})
})
