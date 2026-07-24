// ---------------------------------------------------------------------------
// QF rounds route/controller integration tests.
// The DB pool and Horizon tx-verify service are mocked so the suite is hermetic
// (no database, network or Stellar SDK). Covers: round creation, window
// enforcement, anti-sybil gating, tx-verified contributions, live standings,
// and finalize producing a pool-bounded disbursement plan.
// ---------------------------------------------------------------------------

// Dev-mode auth: authMiddleware falls back to this HS256 secret, and requireAdmin
// accepts the "mock-admin-jwt" sentinel when NODE_ENV !== "production".
process.env.JWT_SECRET = "learnvault-secret"
process.env.NODE_ENV = "test"
delete process.env.JWT_PUBLIC_KEY
delete process.env.ADMIN_ADDRESSES

// --- Mock DB pool ---
const poolQueryMock = jest.fn()
jest.mock("../db/index", () => ({ pool: { query: poolQueryMock } }))

// --- Mock Horizon tx verification (accept by default) ---
const verifyContributionTxMock = jest.fn()
jest.mock("../services/qf-tx-verify.service", () => ({
	verifyContributionTx: verifyContributionTxMock,
}))

import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"

import { errorHandler } from "../middleware/error.middleware"
import { qfRouter } from "../routes/qf.routes"

const DONOR = "GDONOR1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO"
const ADMIN_TOKEN = "mock-admin-jwt"

function donorToken(address = DONOR): string {
	return jwt.sign({ sub: address }, "learnvault-secret")
}

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", qfRouter)
	app.use(errorHandler)
	return app
}

const HOUR = 60 * 60 * 1000

function roundRow(overrides: Record<string, unknown> = {}) {
	const now = Date.now()
	return {
		id: 1,
		name: "Spring 2026 Scholarships",
		matching_pool: "10000",
		start_ts: new Date(now - HOUR).toISOString(),
		end_ts: new Date(now + HOUR).toISOString(),
		status: "upcoming",
		created_at: new Date(now - 2 * HOUR).toISOString(),
		...overrides,
	}
}

/** Marks the wallet as fully verified so passesSybilCheck() succeeds. */
function mockSybilVerified() {
	poolQueryMock.mockImplementationOnce(async (text: string) => {
		expect(text).toContain("identity_verifications")
		return { rows: [{ method: "government_id" }], rowCount: 1 }
	})
}

beforeEach(() => {
	jest.clearAllMocks()
	verifyContributionTxMock.mockResolvedValue({ valid: true })
})

describe("POST /api/qf/rounds (admin create)", () => {
	it("creates a round with a matching pool", async () => {
		const created = roundRow()
		poolQueryMock.mockResolvedValueOnce({ rows: [created], rowCount: 1 })

		const res = await request(buildApp())
			.post("/api/qf/rounds")
			.set("Authorization", `Bearer ${ADMIN_TOKEN}`)
			.send({
				name: created.name,
				matching_pool: 10000,
				start_ts: created.start_ts,
				end_ts: created.end_ts,
			})

		expect(res.status).toBe(201)
		expect(res.body.matching_pool).toBe(10000)
		expect(res.body.status).toBe("upcoming")
	})

	it("rejects unauthenticated round creation", async () => {
		const res = await request(buildApp())
			.post("/api/qf/rounds")
			.send({ name: "x", matching_pool: 1, start_ts: "", end_ts: "" })
		expect(res.status).toBe(401)
	})

	it("rejects a window where end precedes start", async () => {
		const now = Date.now()
		const res = await request(buildApp())
			.post("/api/qf/rounds")
			.set("Authorization", `Bearer ${ADMIN_TOKEN}`)
			.send({
				name: "Bad window",
				matching_pool: 100,
				start_ts: new Date(now + HOUR).toISOString(),
				end_ts: new Date(now).toISOString(),
			})
		expect(res.status).toBe(400)
	})

	it("rejects invalid round data", async () => {
		const res = await request(buildApp())
			.post("/api/qf/rounds")
			.set("Authorization", `Bearer ${ADMIN_TOKEN}`)
			.send({ name: "x", matching_pool: -5 })
		expect(res.status).toBe(400)
	})
})

describe("POST /api/qf/rounds/:id/contribute", () => {
	it("records a tx-verified contribution within the window", async () => {
		mockSybilVerified()
		poolQueryMock.mockResolvedValueOnce({
			rows: [roundRow({ status: "active" })],
			rowCount: 1,
		}) // loadRound
		poolQueryMock.mockResolvedValueOnce({ rows: [{ id: 42 }], rowCount: 1 }) // insert

		const res = await request(buildApp())
			.post("/api/qf/rounds/1/contribute")
			.set("Authorization", `Bearer ${donorToken()}`)
			.send({ proposal_id: 7, amount_usdc: 25, tx_hash: "abc123" })

		expect(res.status).toBe(201)
		expect(res.body.id).toBe(42)
		expect(verifyContributionTxMock).toHaveBeenCalledWith({
			txHash: "abc123",
			expectedSource: DONOR,
			expectedAmount: 25,
		})
	})

	it("blocks contributions from wallets below the sybil threshold", async () => {
		poolQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // no verified methods

		const res = await request(buildApp())
			.post("/api/qf/rounds/1/contribute")
			.set("Authorization", `Bearer ${donorToken()}`)
			.send({ proposal_id: 7, amount_usdc: 25, tx_hash: "abc123" })

		expect(res.status).toBe(403)
		expect(verifyContributionTxMock).not.toHaveBeenCalled()
	})

	it("rejects contributions before the round opens", async () => {
		mockSybilVerified()
		poolQueryMock.mockResolvedValueOnce({
			rows: [
				roundRow({
					start_ts: new Date(Date.now() + HOUR).toISOString(),
					end_ts: new Date(Date.now() + 2 * HOUR).toISOString(),
				}),
			],
			rowCount: 1,
		})

		const res = await request(buildApp())
			.post("/api/qf/rounds/1/contribute")
			.set("Authorization", `Bearer ${donorToken()}`)
			.send({ proposal_id: 7, amount_usdc: 25, tx_hash: "abc123" })

		expect(res.status).toBe(409)
		expect(verifyContributionTxMock).not.toHaveBeenCalled()
	})

	it("rejects contributions after the round closes", async () => {
		mockSybilVerified()
		poolQueryMock.mockResolvedValueOnce({
			rows: [
				roundRow({
					start_ts: new Date(Date.now() - 2 * HOUR).toISOString(),
					end_ts: new Date(Date.now() - HOUR).toISOString(),
				}),
			],
			rowCount: 1,
		})

		const res = await request(buildApp())
			.post("/api/qf/rounds/1/contribute")
			.set("Authorization", `Bearer ${donorToken()}`)
			.send({ proposal_id: 7, amount_usdc: 25, tx_hash: "abc123" })

		expect(res.status).toBe(409)
	})

	it("rejects when Horizon tx verification fails", async () => {
		mockSybilVerified()
		poolQueryMock.mockResolvedValueOnce({
			rows: [roundRow({ status: "active" })],
			rowCount: 1,
		})
		verifyContributionTxMock.mockResolvedValueOnce({
			valid: false,
			reason: "No matching payment from donor found in transaction",
		})

		const res = await request(buildApp())
			.post("/api/qf/rounds/1/contribute")
			.set("Authorization", `Bearer ${donorToken()}`)
			.send({ proposal_id: 7, amount_usdc: 25, tx_hash: "badtx" })

		expect(res.status).toBe(400)
	})

	it("returns 409 when the tx hash was already recorded", async () => {
		mockSybilVerified()
		poolQueryMock.mockResolvedValueOnce({
			rows: [roundRow({ status: "active" })],
			rowCount: 1,
		})
		poolQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ON CONFLICT DO NOTHING

		const res = await request(buildApp())
			.post("/api/qf/rounds/1/contribute")
			.set("Authorization", `Bearer ${donorToken()}`)
			.send({ proposal_id: 7, amount_usdc: 25, tx_hash: "dup" })

		expect(res.status).toBe(409)
	})

	it("returns 404 for a missing round", async () => {
		mockSybilVerified()
		poolQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // loadRound

		const res = await request(buildApp())
			.post("/api/qf/rounds/999/contribute")
			.set("Authorization", `Bearer ${donorToken()}`)
			.send({ proposal_id: 7, amount_usdc: 25, tx_hash: "abc" })

		expect(res.status).toBe(404)
	})
})

describe("GET /api/qf/rounds/:id/standings", () => {
	it("computes the quadratic match that reacts to unique donors", async () => {
		poolQueryMock.mockResolvedValueOnce({
			rows: [roundRow({ status: "active", matching_pool: "1000" })],
			rowCount: 1,
		}) // loadRound
		poolQueryMock.mockResolvedValueOnce({
			rows: [
				// Proposal 1: single whale (weight 0)
				{ proposal_id: 1, donor_addr: "whale", amount_usdc: "100" },
				// Proposal 2: four small donors (weight 300)
				{ proposal_id: 2, donor_addr: "a", amount_usdc: "25" },
				{ proposal_id: 2, donor_addr: "b", amount_usdc: "25" },
				{ proposal_id: 2, donor_addr: "c", amount_usdc: "25" },
				{ proposal_id: 2, donor_addr: "d", amount_usdc: "25" },
			],
			rowCount: 5,
		}) // loadContributions

		const res = await request(buildApp()).get("/api/qf/rounds/1/standings")

		expect(res.status).toBe(200)
		const p2 = res.body.standings.find(
			(s: { proposal_id: number }) => s.proposal_id === 2,
		)
		const p1 = res.body.standings.find(
			(s: { proposal_id: number }) => s.proposal_id === 1,
		)
		expect(p2.unique_contributors).toBe(4)
		expect(p2.estimated_match).toBeGreaterThan(p1.estimated_match)
		expect(p1.estimated_match).toBe(0)
	})

	it("returns 404 for a missing round", async () => {
		poolQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 })
		const res = await request(buildApp()).get("/api/qf/rounds/5/standings")
		expect(res.status).toBe(404)
	})
})

describe("POST /api/qf/rounds/:id/finalize (admin)", () => {
	it("produces a disbursement plan bounded by the pool", async () => {
		poolQueryMock.mockResolvedValueOnce({
			rows: [roundRow({ status: "active", matching_pool: "1000" })],
			rowCount: 1,
		}) // loadRound
		poolQueryMock.mockResolvedValueOnce({
			rows: [
				{ proposal_id: 1, donor_addr: "a", amount_usdc: "10" },
				{ proposal_id: 1, donor_addr: "b", amount_usdc: "10" },
				{ proposal_id: 2, donor_addr: "c", amount_usdc: "20" },
				{ proposal_id: 2, donor_addr: "d", amount_usdc: "20" },
				{ proposal_id: 2, donor_addr: "e", amount_usdc: "20" },
			],
			rowCount: 5,
		}) // loadContributions
		poolQueryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 }) // UPDATE status

		const res = await request(buildApp())
			.post("/api/qf/rounds/1/finalize")
			.set("Authorization", `Bearer ${ADMIN_TOKEN}`)

		expect(res.status).toBe(200)
		expect(res.body.matching_pool).toBe(1000)
		const sum = res.body.disbursements.reduce(
			(acc: number, d: { match_amount: number }) => acc + d.match_amount,
			0,
		)
		expect(sum).toBeLessThanOrEqual(1000 + 1e-6)
		expect(res.body.total_matched).toBeCloseTo(1000, 4)
	})

	it("rejects finalizing an already-finalized round", async () => {
		poolQueryMock.mockResolvedValueOnce({
			rows: [roundRow({ status: "finalized" })],
			rowCount: 1,
		})

		const res = await request(buildApp())
			.post("/api/qf/rounds/1/finalize")
			.set("Authorization", `Bearer ${ADMIN_TOKEN}`)

		expect(res.status).toBe(409)
	})

	it("requires admin auth", async () => {
		const res = await request(buildApp()).post("/api/qf/rounds/1/finalize")
		expect(res.status).toBe(401)
	})
})
