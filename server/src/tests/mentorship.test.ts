import express from "express"
import request from "supertest"

const mockMentor = {
	address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567890123456",
	skills: ["Rust", "Soroban"],
	availability: true,
	active: true,
	created_at: new Date().toISOString(),
}

const mockRequest = {
	id: 1,
	scholar_address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567890123456",
	skills_needed: ["Rust"],
	status: "pending",
	mentor_address: null,
	created_at: new Date().toISOString(),
}

jest.mock("../db/mentorship-store", () => ({
	mentorshipStore: {
		getActiveMentors: jest.fn().mockResolvedValue([mockMentor]),
		createRequest: jest.fn().mockResolvedValue(mockRequest),
		approveMentor: jest.fn().mockResolvedValue(mockMentor),
	},
}))

// Bypass auth middleware for protected routes
jest.mock("../middleware/auth.middleware", () => ({
	authMiddleware: (req: any, _res: any, next: any) => {
		req.user = {
			address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567890123456",
		}
		next()
	},
}))

jest.mock("../middleware/admin.middleware", () => ({
	requireAdmin: (_req: any, _res: any, next: any) => next(),
}))

import { mentorshipRouter } from "../routes/mentorship.routes"

const app = express()
app.use(express.json())
app.use("/api", mentorshipRouter)

describe("Mentorship API", () => {
	describe("GET /api/mentorship/mentors", () => {
		it("returns active mentors", async () => {
			const res = await request(app).get("/api/mentorship/mentors")
			expect(res.status).toBe(200)
			expect(res.body).toHaveLength(1)
			expect(res.body[0].address).toBe(mockMentor.address)
		})
	})

	describe("POST /api/mentorship/request", () => {
		it("creates a mentorship request", async () => {
			const res = await request(app)
				.post("/api/mentorship/request")
				.set("Authorization", "Bearer mock-token")
				.send({ skills_needed: ["Rust"] })
			expect(res.status).toBe(201)
			expect(res.body.id).toBe(1)
			expect(res.body.status).toBe("pending")
		})

		it("rejects request with empty skills_needed", async () => {
			const res = await request(app)
				.post("/api/mentorship/request")
				.set("Authorization", "Bearer mock-token")
				.send({ skills_needed: [] })
			expect(res.status).toBe(400)
			expect(res.body).toHaveProperty("error")
		})

		it("rejects request with missing body", async () => {
			const res = await request(app)
				.post("/api/mentorship/request")
				.set("Authorization", "Bearer mock-token")
				.send({})
			expect(res.status).toBe(400)
		})
	})

	describe("POST /api/admin/mentors/approve/:address", () => {
		it("approves a mentor profile", async () => {
			const res = await request(app)
				.post(`/api/admin/mentors/approve/${mockMentor.address}`)
				.set("Authorization", "Bearer mock-admin-jwt")
			expect(res.status).toBe(200)
			expect(res.body.active).toBe(true)
		})

		it("returns 404 for unknown address", async () => {
			const { mentorshipStore } = require("../db/mentorship-store")
			;(mentorshipStore.approveMentor as jest.Mock).mockResolvedValueOnce(null)

			const res = await request(app)
				.post("/api/admin/mentors/approve/UNKNOWN")
				.set("Authorization", "Bearer mock-admin-jwt")
			expect(res.status).toBe(404)
		})
	})
})
