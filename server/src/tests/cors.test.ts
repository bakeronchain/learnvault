import cors from "cors"
import express from "express"
import request from "supertest"
import { allowedOrigins } from "../config/cors-config"


describe("CORS Configuration", () => {
	let app: express.Application

	beforeAll(() => {
		app = express()
		// Clone the exact CORS configuration from index.ts
		app.use(
			cors({
				origin: (origin, callback) => {
					if (!origin) {
						return callback(null, true)
					}
					if (allowedOrigins.includes(origin)) {
						callback(null, true)
					} else {
						callback(new Error("Not allowed by CORS"))
					}
				},
				credentials: true,
				methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
				allowedHeaders: ["Content-Type", "Authorization"],
			}),
		)

		app.get("/api/test", (req, res) => res.status(200).json({ success: true }))
		
		// Add error handler to capture CORS errors as 403 (or similar)
		app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
			if (err.message === "Not allowed by CORS") {
				res.status(403).json({ error: err.message })
			} else {
				next(err)
			}
		})
	})

	it("allows requests from legitimate origins with correct headers", async () => {
		const origin = allowedOrigins[0]
		const res = await request(app)
			.get("/api/test")
			.set("Origin", origin)

		expect(res.status).toBe(200)
		expect(res.header["access-control-allow-origin"]).toBe(origin)
		expect(res.header["access-control-allow-credentials"]).toBe("true")
	})

	it("allows requests with no origin (e.g. mobile apps, curl)", async () => {
		const res = await request(app).get("/api/test")
		expect(res.status).toBe(200)
		// When no origin is provided, CORS middleware usually doesn't set the allow-origin header
		expect(res.header["access-control-allow-origin"]).toBeUndefined()
	})

	it("blocks requests from unauthorized origins", async () => {
		const res = await request(app)
			.get("/api/test")
			.set("Origin", "http://evil.com")

		expect(res.status).toBe(403)
		expect(res.header["access-control-allow-origin"]).toBeUndefined()
	})

	it("handles OPTIONS preflight requests correctly", async () => {
		const origin = allowedOrigins[0]
		const res = await request(app)
			.options("/api/test")
			.set("Origin", origin)
			.set("Access-Control-Request-Method", "POST")

		expect(res.status).toBe(204) // No Content for successful preflight
		expect(res.header["access-control-allow-origin"]).toBe(origin)
		expect(res.header["access-control-allow-methods"]).toMatch(/POST/)
		expect(res.header["access-control-allow-credentials"]).toBe("true")
	})

	it("CORS configuration includes all origins defined in allowedOrigins", () => {
		// This meta-test ensures that our test uses the same source of truth as the app
		expect(allowedOrigins).toBeDefined()
		expect(allowedOrigins.length).toBeGreaterThan(0)
		expect(allowedOrigins).toContain("https://learnvault.app")
	})
})
