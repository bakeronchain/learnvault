import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { pool } from "../db/index"
import { errorHandler } from "../middleware/error.middleware"
import { commentsRouter } from "../routes/comments.routes"

const JWT_SECRET = "learnvault-secret"

function makeToken(address = "GUSER123") {
	return jwt.sign({ address }, JWT_SECRET, { expiresIn: "1h" })
}

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", commentsRouter)
	app.use(errorHandler)
	return app
}

describe("POST /api/comments", () => {
	const querySpy = jest.spyOn(pool, "query")

	beforeEach(() => {
		jest.clearAllMocks()
	})

	afterAll(() => {
		querySpy.mockRestore()
	})

	it("returns field-level validation errors for invalid snake_case payloads", async () => {
		const res = await request(buildApp())
			.post("/api/comments")
			.set("Authorization", `Bearer ${makeToken()}`)
			.send({
				proposal_id: "proposal-1",
				body: "",
				author_address: "GUSER123",
			})

		expect(res.status).toBe(400)
		expect(res.body.error).toBe("Validation failed")
		expect(res.body.details).toEqual([
			{
				field: "body",
				message: "body cannot be empty",
			},
		])
		expect(querySpy).not.toHaveBeenCalled()
	})

	it("accepts the issue payload shape when the author matches the token", async () => {
		querySpy
			.mockResolvedValueOnce({ rows: [{ count: "0" }] } as never)
			.mockResolvedValueOnce({
				rows: [
					{
						id: 1,
						proposal_id: "proposal-1",
						author_address: "GUSER123",
						content: "Nice proposal",
					},
				],
			} as never)

		const res = await request(buildApp())
			.post("/api/comments")
			.set("Authorization", `Bearer ${makeToken()}`)
			.send({
				proposal_id: "proposal-1",
				body: "Nice proposal",
				author_address: "GUSER123",
			})

		expect(res.status).toBe(201)
		expect(res.body.author_address).toBe("GUSER123")
		expect(res.body.content).toBe("Nice proposal")
	})
})
