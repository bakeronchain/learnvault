import express from "express"
import request from "supertest"
import { z } from "zod"
import { AppError } from "../errors/app-error-handler"
import { authMiddleware } from "../middleware/auth.middleware"
import { errorHandler, notFoundHandler } from "../middleware/error.middleware"
import { validate } from "../middleware/validate.middleware"

const originalNodeEnv = process.env.NODE_ENV

const buildApp = (nodeEnv = "test") => {
	process.env.NODE_ENV = nodeEnv

	const app = express()
	app.use(express.json())

	app.get("/throws", () => {
		throw new Error("Sensitive database password leaked")
	})

	app.get("/auth-error", (_req, _res, next) => {
		next(new AppError("Unauthorized", 401))
	})

	app.get("/rate-limit-error", (_req, _res, next) => {
		next(new AppError("Too many requests", 429))
	})

	app.post(
		"/validation-error",
		validate({
			body: z.object({
				email: z.string().email(),
				name: z.string().min(2),
			}),
		}),
		(_req, res) => {
			res.status(200).json({ success: true })
		},
	)

	app.get("/protected", authMiddleware, (_req, res) => {
		res.status(200).json({ success: true })
	})

	app.use(notFoundHandler)
	app.use(errorHandler)

	return app
}

afterEach(() => {
	process.env.NODE_ENV = originalNodeEnv
})

describe("error handling middleware", () => {
	it("returns sanitized 500 message with no stack trace in production", async () => {
		const res = await request(buildApp("production")).get("/throws")

		expect(res.status).toBe(500)
		expect(res.body).toEqual({
			error: "Internal Server Error",
			message: "Internal Server Error",
		})
		expect(res.body.stack).toBeUndefined()
		expect(JSON.stringify(res.body)).not.toContain(
			"Sensitive database password leaked",
		)
	})

	it("returns JSON for 404 errors, not HTML", async () => {
		const res = await request(buildApp()).get("/missing-route")

		expect(res.status).toBe(404)
		expect(res.type).toMatch(/json/)
		expect(res.body.error).toBe("Not Found")
		expect(res.body.message).toContain("/missing-route")
	})

	it("returns 400 with field-level details for Zod validation errors", async () => {
		const res = await request(buildApp())
			.post("/validation-error")
			.send({ email: "not-an-email", name: "" })

		expect(res.status).toBe(400)
		expect(res.body.error).toBe("Validation failed")
		expect(res.body.details).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					field: "email",
				}),
				expect.objectContaining({
					field: "name",
				}),
			]),
		)
	})

	it("returns 401 for auth errors", async () => {
		const res = await request(buildApp()).get("/protected")

		expect(res.status).toBe(401)
		expect(res.body.error).toBe("Unauthorized")
	})

	it("returns 429 for rate limit errors", async () => {
		const res = await request(buildApp()).get("/rate-limit-error")

		expect(res.status).toBe(429)
		expect(res.body.error).toBe("Too many requests")
	})

	it("includes stack traces in development", async () => {
		const res = await request(buildApp("development")).get("/throws")

		expect(res.status).toBe(500)
		expect(res.body.error).toBe("Sensitive database password leaked")
		expect(res.body.stack).toContain(
			"Error: Sensitive database password leaked",
		)
	})

	it("does not include stack traces in production", async () => {
		const res = await request(buildApp("production")).get("/throws")

		expect(res.status).toBe(500)
		expect(res.body.stack).toBeUndefined()
	})
})
