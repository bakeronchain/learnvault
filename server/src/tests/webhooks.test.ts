import { createHmac } from "node:crypto"
import express from "express"
import request from "supertest"

import { webhooksRouter } from "../routes/webhooks.routes"
import { processWebhookEvents } from "../services/event-indexer.service"

jest.mock("../services/event-indexer.service", () => ({
	processWebhookEvents: jest.fn().mockResolvedValue({ inserted: 1, skipped: 0 }),
}))

const mockedProcessWebhookEvents = processWebhookEvents as jest.MockedFunction<
	typeof processWebhookEvents
>

const WEBHOOK_SECRET = "test-webhook-secret"

function signPayload(body: string): string {
	const digest = createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex")
	return `sha256=${digest}`
}

const samplePayload = {
	events: [
		{
			id: "00001000-testtxhash-0",
			type: "contract",
			contract: "C123",
			topic: "LearnToken::Mint",
			ledger: "1000",
			value: { address: "GABC", amount: "100" },
		},
	],
}

function buildApp() {
	const app = express()
	app.use("/api/webhooks", express.raw({ type: "application/json" }), webhooksRouter)
	return app
}

describe("POST /api/webhooks/horizon", () => {
	const originalSecret = process.env.WEBHOOK_SECRET

	beforeEach(() => {
		jest.clearAllMocks()
		process.env.WEBHOOK_SECRET = WEBHOOK_SECRET
	})

	afterAll(() => {
		process.env.WEBHOOK_SECRET = originalSecret
	})

	it("accepts a signed payload and dispatches events asynchronously", async () => {
		const body = JSON.stringify(samplePayload)
		const app = buildApp()

		const res = await request(app)
			.post("/api/webhooks/horizon")
			.set("Content-Type", "application/json")
			.set("X-Webhook-Signature", signPayload(body))
			.send(body)

		expect(res.status).toBe(200)
		expect(res.body).toEqual({ received: true, count: 1 })

		await new Promise((resolve) => setImmediate(resolve))

		expect(mockedProcessWebhookEvents).toHaveBeenCalledWith(samplePayload.events)
	})

	it("rejects unsigned requests with 401", async () => {
		const body = JSON.stringify(samplePayload)
		const app = buildApp()

		const res = await request(app)
			.post("/api/webhooks/horizon")
			.set("Content-Type", "application/json")
			.send(body)

		expect(res.status).toBe(401)
		expect(res.body.error).toMatch(/signature/i)
		expect(mockedProcessWebhookEvents).not.toHaveBeenCalled()
	})

	it("rejects requests with an invalid signature", async () => {
		const body = JSON.stringify(samplePayload)
		const app = buildApp()

		const res = await request(app)
			.post("/api/webhooks/horizon")
			.set("Content-Type", "application/json")
			.set("X-Webhook-Signature", "sha256=deadbeef")
			.send(body)

		expect(res.status).toBe(401)
		expect(res.body.error).toMatch(/signature/i)
		expect(mockedProcessWebhookEvents).not.toHaveBeenCalled()
	})

	it("rejects malformed payloads with 400", async () => {
		const body = JSON.stringify({ events: [] })
		const app = buildApp()

		const res = await request(app)
			.post("/api/webhooks/horizon")
			.set("Content-Type", "application/json")
			.set("X-Webhook-Signature", signPayload(body))
			.send(body)

		expect(res.status).toBe(400)
		expect(mockedProcessWebhookEvents).not.toHaveBeenCalled()
	})
})
