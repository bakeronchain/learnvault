process.env.JWT_SECRET = "learnvault-secret"
process.env.NODE_ENV = "test"

import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"

jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn(),
	},
}))

jest.mock("../services/learn-token.service", () => ({
	burnLearnToken: jest.fn(),
	mapBurnError: jest.requireActual("../services/learn-token.service")
		.mapBurnError,
	InsufficientLrnBalanceError: jest.requireActual(
		"../services/learn-token.service",
	).InsufficientLrnBalanceError,
	SorobanRpcError: jest.requireActual("../services/learn-token.service")
		.SorobanRpcError,
}))

jest.mock("../services/lrn-burn-store.service", () => ({
	lrnBurnStore: {
		insertLrnBurn: jest.fn(),
		listLrnBurnsByWallet: jest.fn(),
	},
}))

import { lrnRouter } from "../routes/lrn.routes"
import {
	burnLearnToken,
	InsufficientLrnBalanceError,
	SorobanRpcError,
} from "../services/learn-token.service"
import { lrnBurnStore } from "../services/lrn-burn-store.service"

const mockedBurn = burnLearnToken as jest.Mock
const mockedInsert = lrnBurnStore.insertLrnBurn as jest.Mock

const app = express()
app.use(express.json())
app.use("/api", lrnRouter)

const WALLET = "GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBF3UKJQ2K5RQDD"
const JWT_SECRET = "learnvault-secret"

function authHeader() {
	return {
		Authorization: `Bearer ${jwt.sign({ address: WALLET }, JWT_SECRET, {
			expiresIn: "1h",
		})}`,
	}
}

describe("POST /api/lrn/burn", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("records a successful burn", async () => {
		mockedBurn.mockResolvedValue({ txHash: "abc123hash" })
		mockedInsert.mockResolvedValue({
			id: 1,
			walletAddress: WALLET,
			amount: "10000000",
			txHash: "abc123hash",
			burnedAt: "2026-05-27T12:00:00.000Z",
		})

		const res = await request(app)
			.post("/api/lrn/burn")
			.set(authHeader())
			.send({ amount: "10000000" })

		expect(res.status).toBe(201)
		expect(res.body).toEqual({
			tx_hash: "abc123hash",
			amount: "10000000",
			burned_at: "2026-05-27T12:00:00.000Z",
		})
		expect(mockedBurn).toHaveBeenCalledWith({
			holderAddress: WALLET,
			amountAtomic: 10_000_000n,
			signedTransactionXdr: undefined,
		})
		expect(mockedInsert).toHaveBeenCalledWith({
			walletAddress: WALLET,
			amountAtomic: 10_000_000n,
			txHash: "abc123hash",
		})
	})

	it("returns 400 when balance is insufficient", async () => {
		mockedBurn.mockRejectedValue(
			new InsufficientLrnBalanceError(WALLET, 10_000_000n, 1_000_000n),
		)

		const res = await request(app)
			.post("/api/lrn/burn")
			.set(authHeader())
			.send({ amount: "10000000" })

		expect(res.status).toBe(400)
		expect(res.body.error).toBe("Insufficient LRN balance")
	})

	it("returns 502 when Soroban RPC fails or times out", async () => {
		mockedBurn.mockRejectedValue(
			new SorobanRpcError("Soroban RPC call failed while invoking learn_token.burn"),
		)

		const res = await request(app)
			.post("/api/lrn/burn")
			.set(authHeader())
			.send({ amount: "10000000" })

		expect(res.status).toBe(502)
		expect(res.body.error).toBe("Soroban RPC call failed")
	})

	it("returns 401 without auth", async () => {
		const res = await request(app)
			.post("/api/lrn/burn")
			.send({ amount: "10000000" })

		expect(res.status).toBe(401)
	})
})

describe("GET /api/lrn/burn/history", () => {
	it("returns persisted burns for the wallet", async () => {
		;(lrnBurnStore.listLrnBurnsByWallet as jest.Mock).mockResolvedValue([
			{
				id: 1,
				walletAddress: WALLET,
				amount: "5000000",
				txHash: "hash1",
				burnedAt: "2026-05-27T12:00:00.000Z",
			},
		])

		const res = await request(app)
			.get("/api/lrn/burn/history")
			.set(authHeader())

		expect(res.status).toBe(200)
		expect(res.body.wallet_address).toBe(WALLET)
		expect(res.body.count).toBe(1)
		expect(res.body.total_burned).toBe("5000000")
	})
})
