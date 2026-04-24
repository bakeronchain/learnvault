import express, { type Express } from "express"
import request from "supertest"

import { getMe, createMeWalletHandlers } from "../controllers/me.controller"
import { pool } from "../db/index"
import * as linkedWalletsStore from "../db/linked-wallets-store"
import { createTokenStore } from "../db/token-store"
import { linkWalletBodySchema } from "../lib/zod-schemas"
import { createRequireAuth } from "../middleware/auth.middleware"
import { validate } from "../middleware/validate.middleware"
import {
	generateEphemeralDevJwtKeys,
	createJwtService,
} from "../services/jwt.service"

jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn(),
		connect: jest.fn(),
	},
}))

jest.mock("../db/linked-wallets-store", () => ({
	findClusterIdForWallet: jest.fn(),
	listClusterWallets: jest.fn(),
	linkWalletToCluster: jest.fn(),
	setPrimaryWallet: jest.fn(),
}))

const mockedPool = pool as { query: jest.Mock; connect: jest.Mock }
const mockedLinked = linkedWalletsStore as jest.Mocked<
	typeof linkedWalletsStore
>

describe("GET /api/me", () => {
	const { privateKeyPem, publicKeyPem } = generateEphemeralDevJwtKeys()
	const tokenStore = createTokenStore(undefined)
	const jwtService = createJwtService(privateKeyPem, publicKeyPem, tokenStore)
	const jwtAddr = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
	const token = jwtService.signWalletToken(jwtAddr)

	const buildApp = (): Express => {
		const app = express()
		app.use(express.json())
		const requireAuth = createRequireAuth(jwtService)
		app.get("/api/me", requireAuth, (req, res) => {
			void getMe(req, res)
		})
		return app
	}

	beforeEach(() => {
		mockedPool.query.mockReset()
		mockedLinked.findClusterIdForWallet.mockReset()
		mockedLinked.listClusterWallets.mockReset()
	})

	it("returns singleton profile when no cluster exists", async () => {
		mockedLinked.findClusterIdForWallet.mockResolvedValue(null)
		mockedPool.query
			.mockResolvedValueOnce({ rows: [{ lrnsum: "100", courses: "2" }] })
			.mockResolvedValueOnce({ rows: [] })

		const res = await request(buildApp())
			.get("/api/me")
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(200)
		expect(res.body.address).toBe(jwtAddr)
		expect(res.body.primaryAddress).toBe(jwtAddr)
		expect(res.body.linkedWallets).toEqual([
			{ address: jwtAddr, isPrimary: true },
		])
		expect(res.body.aggregated.lrnBalance).toBe("100")
		expect(res.body.aggregated.coursesCompleted).toBe(2)
		expect(res.body.credentials).toEqual([])
	})
})

describe("POST /api/me/wallets/link", () => {
	const { privateKeyPem, publicKeyPem } = generateEphemeralDevJwtKeys()
	const tokenStore = createTokenStore(undefined)
	const jwtService = createJwtService(privateKeyPem, publicKeyPem, tokenStore)
	const jwtAddr = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
	const token = jwtService.signWalletToken(jwtAddr)

	const authService = {
		verifyNonceSignature: jest.fn().mockResolvedValue(undefined),
	}

	const { postLinkWallet } = createMeWalletHandlers(authService as never)

	const buildApp = (): Express => {
		const app = express()
		app.use(express.json())
		const requireAuth = createRequireAuth(jwtService)
		app.post(
			"/api/me/wallets/link",
			requireAuth,
			validate({ body: linkWalletBodySchema }),
			(req, res) => {
				void postLinkWallet(req, res)
			},
		)
		return app
	}

	beforeEach(() => {
		authService.verifyNonceSignature.mockClear()
		mockedLinked.linkWalletToCluster.mockReset()
	})

	it("links after signature verification", async () => {
		mockedLinked.linkWalletToCluster.mockResolvedValue({ clusterId: "u" })

		const res = await request(buildApp())
			.post("/api/me/wallets/link")
			.set("Authorization", `Bearer ${token}`)
			.send({
				address: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBMOLQ",
				signature: "c2lnbmF0dXJl",
			})

		expect(res.status).toBe(201)
		expect(authService.verifyNonceSignature).toHaveBeenCalled()
		expect(mockedLinked.linkWalletToCluster).toHaveBeenCalledWith(
			jwtAddr,
			"GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBMOLQ",
		)
	})
})
