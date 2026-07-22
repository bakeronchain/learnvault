process.env.JWT_SECRET = "learnvault-secret"
process.env.NODE_ENV = "test"
process.env.FRONTEND_URL = "http://localhost:5173"

import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"

const mockPoolQuery = jest.fn()
jest.mock("../db/index", () => ({
	pool: {
		query: mockPoolQuery,
	},
}))

jest.mock("../services/learn-token.service", () => ({
	mintLrn: jest.fn(),
	mapMintError: jest.requireActual("../services/learn-token.service")
		.mapMintError,
	SorobanRpcError: jest.requireActual("../services/learn-token.service")
		.SorobanRpcError,
	lrnToAtomic: jest.requireActual("../services/learn-token.service")
		.lrnToAtomic,
}))

import { referralRouter } from "../routes/referral.routes"

const WALLET = "GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBF3UKJQ2K5RQDD"
const OTHER_WALLET = "GBPL6OJBXGGDYQ7RN6A5P3FRQGW3KX2N3Q3VJYQN5G4J2X5SX7ZQAAAA"
const JWT_SECRET = "learnvault-secret"

const app = express()
app.use(express.json())
app.use("/api", referralRouter)

function authHeader(address = WALLET) {
	return {
		Authorization: `Bearer ${jwt.sign({ address }, JWT_SECRET, {
			expiresIn: "1h",
		})}`,
	}
}

function mockQuerySequence(...results: Array<Record<string, unknown>>) {
	let callCount = 0
	mockPoolQuery.mockImplementation(() => {
		const result = results[callCount] ?? { rows: [] }
		callCount++
		return Promise.resolve(result)
	})
}

describe("GET /api/referrals/code", () => {
	beforeEach(() => {
		mockPoolQuery.mockReset()
	})

	it("returns 401 without auth", async () => {
		const res = await request(app).get("/api/referrals/code")
		expect(res.status).toBe(401)
	})

	it("returns existing code when already created", async () => {
		mockQuerySequence(
			{ rows: [{ code: "abc12345" }] },
			{
				rows: [
					{
						pending_count: 0,
						qualified_count: 0,
						rewarded_count: 0,
					},
				],
			},
		)

		const res = await request(app).get("/api/referrals/code").set(authHeader())

		expect(res.status).toBe(200)
		expect(res.body.code).toBe("abc12345")
		expect(res.body.link).toContain("/?ref=abc12345")
	})

	it("generates a new code on first call", async () => {
		mockQuerySequence(
			{ rows: [] },
			{ rows: [{ code: "newcode01" }], rowCount: 1 },
			{
				rows: [
					{
						pending_count: 0,
						qualified_count: 0,
						rewarded_count: 0,
					},
				],
			},
		)

		const res = await request(app).get("/api/referrals/code").set(authHeader())

		expect(res.status).toBe(200)
		expect(res.body.code).toBe("newcode01")
	})
})

describe("POST /api/referrals/claim", () => {
	beforeEach(() => {
		mockPoolQuery.mockReset()
	})

	it("returns 401 without auth", async () => {
		const res = await request(app)
			.post("/api/referrals/claim")
			.send({ code: "abc123" })

		expect(res.status).toBe(401)
	})

	it("returns 400 when code is missing", async () => {
		const res = await request(app)
			.post("/api/referrals/claim")
			.set(authHeader())
			.send({})

		expect(res.status).toBe(400)
		expect(res.body.error).toContain("code")
	})

	it("returns 404 for invalid code", async () => {
		mockQuerySequence({ rows: [] })

		const res = await request(app)
			.post("/api/referrals/claim")
			.set(authHeader())
			.send({ code: "invalid" })

		expect(res.status).toBe(404)
		expect(res.body.error).toContain("Invalid")
	})

	it("rejects self-referral", async () => {
		mockQuerySequence(
			{ rows: [{ referrer_addr: WALLET }] },
			{ rows: [] },
			{ rows: [{ count: 1 }] },
		)

		const res = await request(app)
			.post("/api/referrals/claim")
			.set(authHeader(WALLET))
			.send({ code: "selfref" })

		expect(res.status).toBe(400)
		expect(res.body.error).toContain("Cannot refer yourself")
	})

	it("rejects duplicate claim for already-referred wallet", async () => {
		mockQuerySequence(
			{ rows: [{ referrer_addr: OTHER_WALLET }] },
			{ rows: [{ id: 1 }] },
		)

		const res = await request(app)
			.post("/api/referrals/claim")
			.set(authHeader())
			.send({ code: "dupclaim" })

		expect(res.status).toBe(409)
		expect(res.body.error).toContain("Already referred")
	})

	it("rejects claim when anti-sybil check fails", async () => {
		mockQuerySequence(
			{ rows: [{ referrer_addr: OTHER_WALLET }] },
			{ rows: [] },
			{ rows: [{ count: 0 }] },
		)

		const res = await request(app)
			.post("/api/referrals/claim")
			.set(authHeader())
			.send({ code: "nosybil" })

		expect(res.status).toBe(403)
		expect(res.body.error).toContain("identity verification")
	})

	it("creates referral when all validations pass", async () => {
		mockQuerySequence(
			{ rows: [{ referrer_addr: OTHER_WALLET }] },
			{ rows: [] },
			{ rows: [{ count: 1 }] },
			{ rowCount: 1 },
		)

		const res = await request(app)
			.post("/api/referrals/claim")
			.set(authHeader())
			.send({ code: "goodcode" })

		expect(res.status).toBe(201)
		expect(res.body.message).toContain("successfully")
	})
})

describe("GET /api/referrals/mine", () => {
	beforeEach(() => {
		mockPoolQuery.mockReset()
	})

	it("returns 401 without auth", async () => {
		const res = await request(app).get("/api/referrals/mine")
		expect(res.status).toBe(401)
	})

	it("returns list of referrals", async () => {
		mockQuerySequence({
			rows: [
				{
					id: 1,
					referred_addr: OTHER_WALLET,
					status: "pending",
					qualified_at: null,
					created_at: "2026-07-22T12:00:00.000Z",
				},
			],
		})

		const res = await request(app).get("/api/referrals/mine").set(authHeader())

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(1)
		expect(res.body.data[0].status).toBe("pending")
	})
})
