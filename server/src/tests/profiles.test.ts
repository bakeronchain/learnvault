import express, { type Express, type NextFunction, type Request, type Response } from "express"
import request from "supertest"

// Mock database
jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn(),
	},
}))

// Mock auth middleware to easily simulate authenticated users
jest.mock("../middleware/auth.middleware", () => ({
	authMiddleware: (req: any, res: Response, next: NextFunction) => {
		if (req.headers.authorization === "Bearer valid-token") {
			req.user = { address: "GABC12345" }
			next()
		} else {
			res.status(401).json({ error: "Unauthorized" })
		}
	},
}))

import { pool } from "../db/index"
import { profilesRouter } from "../routes/profiles.routes"

const mockedQuery = pool.query as jest.Mock

const buildApp = (): Express => {
	const app = express()
	app.use(express.json())
	app.use("/api", profilesRouter)
	return app
}

describe("User Profiles API", () => {
	beforeEach(() => {
		mockedQuery.mockReset()
	})

	describe("GET /api/profiles/:address", () => {
		it("returns a user profile if it exists", async () => {
			const mockProfile = {
				address: "GABC12345",
				display_name: "Alice",
				bio: "Hello world!",
				avatar_url: "https://example.com/avatar.png",
				twitter: "@alice",
				github: "alice-dev",
				website: "https://alice.dev",
			}
			mockedQuery.mockResolvedValueOnce({ rows: [mockProfile] })

			const res = await request(buildApp()).get("/api/profiles/GABC12345")

			expect(res.status).toBe(200)
			expect(res.body).toEqual(mockProfile)
		})

		it("returns 404 if profile does not exist", async () => {
			mockedQuery.mockResolvedValueOnce({ rows: [] })

			const res = await request(buildApp()).get("/api/profiles/GNONEXISTENT")

			expect(res.status).toBe(404)
			expect(res.body).toEqual({ error: "Profile not found" })
		})
	})

	describe("PUT /api/profiles/me", () => {
		const validUpdatePayload = {
			display_name: "Alice",
			bio: "I am a <b>blockchain</b> developer.",
			avatar_url: "https://example.com/avatar.png",
			twitter: "@alice",
		}

		it("requires authentication", async () => {
			const res = await request(buildApp())
				.put("/api/profiles/me")
				.send(validUpdatePayload)

			expect(res.status).toBe(401)
		})

		it("upserts the profile and sanitizes bio HTML", async () => {
			const payloadWithXss = {
				...validUpdatePayload,
				bio: "I am a <b>developer</b> <script>alert('xss')</script> and I like <a href='javascript:alert(1)'>links</a>.",
			}

			const expectedSanitizedBio = "I am a <b>developer</b>  and I like <a>links</a>."

			mockedQuery.mockResolvedValueOnce({
				rows: [
					{
						address: "GABC12345",
						display_name: payloadWithXss.display_name,
						bio: expectedSanitizedBio,
					},
				],
			})

			const res = await request(buildApp())
				.put("/api/profiles/me")
				.set("Authorization", "Bearer valid-token")
				.send(payloadWithXss)

			expect(res.status).toBe(200)
			expect(res.body.bio).toBe(expectedSanitizedBio)

			// Verify query parameters
			const callArgs = mockedQuery.mock.calls[0][1]
			expect(callArgs[2]).toBe(expectedSanitizedBio)
		})

		it("validates display_name constraints", async () => {
			const res = await request(buildApp())
				.put("/api/profiles/me")
				.set("Authorization", "Bearer valid-token")
				.send({ display_name: "a" }) // Too short

			expect(res.status).toBe(400)
			expect(res.body.error).toBe("Validation failed")
		})

		it("handles unique display_name constraint violations", async () => {
			const dbError = new Error("duplicate key value violates unique constraint")
			;(dbError as any).code = "23505"
			mockedQuery.mockRejectedValueOnce(dbError)

			const res = await request(buildApp())
				.put("/api/profiles/me")
				.set("Authorization", "Bearer valid-token")
				.send(validUpdatePayload)

			expect(res.status).toBe(409)
			expect(res.body.error).toBe("Display name is already taken")
		})
	})
})
