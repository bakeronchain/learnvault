import express from "express"
import request from "supertest"

import { createMeRouter } from "../routes/me.routes"
import { type AuthService } from "../services/auth.service"
import { type DataRightsService } from "../services/data-rights.service"
import { type JwtService } from "../services/jwt.service"

const USER_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
const USER_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"

const jwtService = {
	verifyWalletToken: jest.fn(),
} as unknown as jest.Mocked<JwtService>

const authService = {
	verifySignedTransaction: jest.fn(),
} as unknown as jest.Mocked<AuthService>

const dataRightsService = {
	requestExport: jest.fn(),
	getExport: jest.fn(),
	getDownload: jest.fn(),
	scheduleDeletion: jest.fn(),
	getPendingDeletion: jest.fn(),
	cancelDeletion: jest.fn(),
} as unknown as jest.Mocked<DataRightsService>

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", createMeRouter(jwtService, authService, dataRightsService))
	return app
}

describe("learner data rights routes", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		jwtService.verifyWalletToken.mockResolvedValue({
			sub: USER_A,
			jti: "session",
		})
	})

	it("queues an asynchronous export", async () => {
		dataRightsService.requestExport.mockResolvedValue({
			id: "job-1",
			status: "pending",
			createdAt: new Date("2026-08-25T12:00:00Z"),
			expiresAt: null,
		})

		const response = await request(buildApp())
			.post("/api/me/export")
			.set("Authorization", "Bearer user-a")

		expect(response.status).toBe(202)
		expect(response.body.id).toBe("job-1")
		expect(dataRightsService.requestExport).toHaveBeenCalledWith(USER_A)
	})

	it("does not reveal another learner's export", async () => {
		dataRightsService.getExport.mockRejectedValue(new Error("Export not found"))

		const response = await request(buildApp())
			.get("/api/me/export/job-b")
			.set("Authorization", "Bearer user-a")

		expect(response.status).toBe(404)
		expect(dataRightsService.getExport).toHaveBeenCalledWith("job-b", USER_A)
	})

	it("requires typed confirmation and fresh wallet re-authentication", async () => {
		const missingConfirmation = await request(buildApp())
			.delete("/api/me")
			.set("Authorization", "Bearer user-a")
			.send({ confirmation: "delete", signedTransaction: "signed-xdr" })
		expect(missingConfirmation.status).toBe(400)

		authService.verifySignedTransaction.mockResolvedValue({
			accessToken: "fresh-token",
			refreshToken: "fresh-refresh",
		})
		jwtService.verifyWalletToken
			.mockResolvedValueOnce({ sub: USER_A, jti: "session" })
			.mockResolvedValueOnce({ sub: USER_B, jti: "fresh" })

		const wrongWallet = await request(buildApp())
			.delete("/api/me")
			.set("Authorization", "Bearer user-a")
			.send({
				confirmation: "DELETE MY ACCOUNT",
				signedTransaction: "signed-xdr",
			})
		expect(wrongWallet.status).toBe(401)
		expect(dataRightsService.scheduleDeletion).not.toHaveBeenCalled()
	})

	it("soft deletes for the grace period and allows cancellation", async () => {
		authService.verifySignedTransaction.mockResolvedValue({
			accessToken: "fresh-token",
			refreshToken: "fresh-refresh",
		})
		jwtService.verifyWalletToken.mockResolvedValue({
			sub: USER_A,
			jti: "fresh",
		})
		dataRightsService.scheduleDeletion.mockResolvedValue(
			new Date("2026-09-24T12:00:00Z"),
		)

		const deletion = await request(buildApp())
			.delete("/api/me")
			.set("Authorization", "Bearer user-a")
			.send({
				confirmation: "DELETE MY ACCOUNT",
				signedTransaction: "signed-xdr",
			})
		expect(deletion.status).toBe(202)
		expect(deletion.body.eraseAfter).toBe("2026-09-24T12:00:00.000Z")

		const cancellation = await request(buildApp())
			.post("/api/me/deletion/cancel")
			.set("Authorization", "Bearer user-a")
		expect(cancellation.status).toBe(204)
		expect(dataRightsService.cancelDeletion).toHaveBeenCalledWith(USER_A)
	})
})
