import express from "express"
import request from "supertest"

import {
	createRequestLogger,
} from "../middleware/request-logger.middleware"

describe("requestLogger middleware", () => {
	it("attaches a request id header to every response", async () => {
		const app = express()

		app.use(createRequestLogger({ enabled: false }))
		app.get("/api/ping", (req, res) => {
			res.json({ requestId: req.requestId })
		})

		const response = await request(app).get("/api/ping?source=test")

		expect(response.status).toBe(200)
		expect(response.headers["x-request-id"]).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		)
		expect(response.body.requestId).toBe(response.headers["x-request-id"])
	})

	it("logs structured request data on response finish", async () => {
		const info = jest.fn()
		const app = express()

		app.use(createRequestLogger({ enabled: true, logger: { info } }))
		app.get("/api/users", (_req, res) => {
			res.status(201).json({ ok: true })
		})

		const response = await request(app).get("/api/users?page=1")

		expect(response.status).toBe(201)
		expect(info).toHaveBeenCalledTimes(1)
		expect(info).toHaveBeenCalledWith(
			expect.objectContaining({
				requestId: response.headers["x-request-id"],
				method: "GET",
				path: "/api/users?page=1",
				statusCode: 201,
				durationMs: expect.any(Number),
			}),
		)
	})

	it("stays silent in the test environment by default", async () => {
		const previousNodeEnv = process.env.NODE_ENV
		process.env.NODE_ENV = "test"

		const info = jest.fn()
		const app = express()

		app.use(createRequestLogger({ logger: { info } }))
		app.get("/api/quiet", (_req, res) => {
			res.sendStatus(204)
		})

		const response = await request(app).get("/api/quiet")

		expect(response.status).toBe(204)
		expect(response.headers["x-request-id"]).toBeTruthy()
		expect(info).not.toHaveBeenCalled()

		process.env.NODE_ENV = previousNodeEnv
	})
})
