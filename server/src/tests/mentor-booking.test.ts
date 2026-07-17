import express from "express"
import request from "supertest"

const mockMentor = {
	address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567890123456",
	bio: "Rust & Soroban expert",
	hourly_rate: "50",
	skills: ["Rust", "Soroban"],
	active: true,
	created_at: new Date().toISOString(),
}

const mockSlot = {
	id: 1,
	mentor_addr: "GABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567890123456",
	start_ts: "2026-08-01T10:00:00Z",
	end_ts: "2026-08-01T11:00:00Z",
	booked: false,
}

const mockBooking = {
	id: 1,
	slot_id: 1,
	learner_addr: "GLEARNERABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567",
	mentor_addr: "GABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567890123456",
	amount_usdc: "50",
	escrow_tx: null,
	status: "pending" as const,
	created_at: new Date().toISOString(),
}

const mockPaidBooking = {
	...mockBooking,
	escrow_tx: "abc123txhash",
	status: "paid" as const,
}

const mockCompletedBooking = {
	...mockPaidBooking,
	status: "completed" as const,
}

jest.mock("../db/mentor-store", () => ({
	mentorStore: {
		upsertMentor: jest.fn().mockResolvedValue(mockMentor),
		getActiveMentors: jest.fn().mockResolvedValue([mockMentor]),
		getMentorByAddress: jest.fn().mockResolvedValue(mockMentor),
		addAvailability: jest.fn().mockResolvedValue(mockSlot),
		getAvailability: jest.fn().mockResolvedValue([mockSlot]),
		getSlotById: jest.fn().mockResolvedValue(mockSlot),
		lockSlot: jest.fn().mockResolvedValue({ ...mockSlot, booked: true }),
		unlockSlot: jest.fn().mockResolvedValue(undefined),
		createBooking: jest.fn().mockResolvedValue(mockBooking),
		getBookingById: jest.fn().mockResolvedValue(mockBooking),
		confirmPayment: jest.fn().mockResolvedValue(mockPaidBooking),
		completeBooking: jest.fn().mockResolvedValue(mockCompletedBooking),
		cancelBooking: jest
			.fn()
			.mockResolvedValue({ ...mockBooking, status: "cancelled" }),
		disputeBooking: jest
			.fn()
			.mockResolvedValue({ ...mockPaidBooking, status: "disputed" }),
		getBookingsForLearner: jest.fn().mockResolvedValue([mockBooking]),
		getBookingsForMentor: jest.fn().mockResolvedValue([mockBooking]),
	},
}))

const MENTOR_ADDR = "GABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567890123456"
const LEARNER_ADDR = "GLEARNERABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567"

jest.mock("../middleware/auth.middleware", () => ({
	authMiddleware: (req: any, _res: any, next: any) => {
		const isMentorRoute =
			req.path.includes("/mentors/") && !req.path.includes("/bookings")
		req.user = {
			address: isMentorRoute ? MENTOR_ADDR : LEARNER_ADDR,
		}
		next()
	},
}))

import { mentorStore } from "../db/mentor-store"
import { mentorBookingRouter } from "../routes/mentor-booking.routes"

const app = express()
app.use(express.json())
app.use("/api", mentorBookingRouter)

describe("Mentor Booking API", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("POST /api/mentors", () => {
		it("registers a mentor profile", async () => {
			const res = await request(app)
				.post("/api/mentors")
				.set("Authorization", "Bearer mock-token")
				.send({
					bio: "Rust & Soroban expert",
					hourly_rate: "50",
					skills: ["Rust", "Soroban"],
				})
			expect(res.status).toBe(201)
			expect(res.body.address).toBe(mockMentor.address)
			expect(res.body.skills).toEqual(["Rust", "Soroban"])
		})

		it("rejects missing skills", async () => {
			const res = await request(app)
				.post("/api/mentors")
				.set("Authorization", "Bearer mock-token")
				.send({ hourly_rate: "50" })
			expect(res.status).toBe(400)
		})
	})

	describe("GET /api/mentors", () => {
		it("returns active mentors", async () => {
			const res = await request(app).get("/api/mentors")
			expect(res.status).toBe(200)
			expect(res.body).toHaveLength(1)
			expect(res.body[0].address).toBe(mockMentor.address)
		})

		it("filters by skill", async () => {
			const res = await request(app).get("/api/mentors?skill=Rust")
			expect(res.status).toBe(200)
			expect(mentorStore.getActiveMentors).toHaveBeenCalledWith("Rust")
		})
	})

	describe("POST /api/mentors/:addr/availability", () => {
		it("adds availability slots", async () => {
			const res = await request(app)
				.post(`/api/mentors/${mockMentor.address}/availability`)
				.set("Authorization", "Bearer mock-token")
				.send({
					start_ts: "2026-08-01T10:00:00Z",
					end_ts: "2026-08-01T11:00:00Z",
				})
			expect(res.status).toBe(201)
			expect(res.body.mentor_addr).toBe(mockMentor.address)
		})

		it("rejects availability for another mentor", async () => {
			const res = await request(app)
				.post("/api/mentors/GDIFFERENTADDRESS/availability")
				.set("Authorization", "Bearer mock-token")
				.send({
					start_ts: "2026-08-01T10:00:00Z",
					end_ts: "2026-08-01T11:00:00Z",
				})
			expect(res.status).toBe(403)
		})
	})

	describe("POST /api/bookings", () => {
		it("creates a booking and returns escrow instructions", async () => {
			const res = await request(app)
				.post("/api/bookings")
				.set("Authorization", "Bearer mock-token")
				.send({ slot_id: 1, amount_usdc: "50" })
			expect(res.status).toBe(201)
			expect(res.body.booking.id).toBe(1)
			expect(res.body.escrow_instructions).toBeDefined()
			expect(res.body.escrow_instructions.amount_usdc).toBe("50")
		})

		it("rejects booking with invalid slot_id", async () => {
			const res = await request(app)
				.post("/api/bookings")
				.set("Authorization", "Bearer mock-token")
				.send({ slot_id: -1, amount_usdc: "50" })
			expect(res.status).toBe(400)
		})

		it("rejects double-booking", async () => {
			;(mentorStore.getSlotById as jest.Mock).mockResolvedValueOnce({
				...mockSlot,
				booked: true,
			})
			const res = await request(app)
				.post("/api/bookings")
				.set("Authorization", "Bearer mock-token")
				.send({ slot_id: 1, amount_usdc: "50" })
			expect(res.status).toBe(409)
			expect(res.body.error).toContain("already booked")
		})
	})

	describe("POST /api/bookings/:id/confirm-payment", () => {
		it("confirms payment and locks slot", async () => {
			const res = await request(app)
				.post("/api/bookings/1/confirm-payment")
				.set("Authorization", "Bearer mock-token")
				.send({ escrow_tx: "abc123txhash" })
			expect(res.status).toBe(200)
			expect(res.body.status).toBe("paid")
			expect(mentorStore.lockSlot).toHaveBeenCalledWith(1)
		})

		it("rejects missing escrow_tx", async () => {
			const res = await request(app)
				.post("/api/bookings/1/confirm-payment")
				.set("Authorization", "Bearer mock-token")
				.send({})
			expect(res.status).toBe(400)
		})

		it("prevents double-booking on confirm — slot already locked", async () => {
			;(mentorStore.lockSlot as jest.Mock).mockResolvedValueOnce(null)
			const res = await request(app)
				.post("/api/bookings/1/confirm-payment")
				.set("Authorization", "Bearer mock-token")
				.send({ escrow_tx: "abc123txhash" })
			expect(res.status).toBe(409)
			expect(res.body.error).toContain("already booked")
		})
	})

	describe("POST /api/bookings/:id/complete", () => {
		it("completes a paid booking and releases escrow", async () => {
			;(mentorStore.getBookingById as jest.Mock).mockResolvedValueOnce(
				mockPaidBooking,
			)
			const res = await request(app)
				.post("/api/bookings/1/complete")
				.set("Authorization", "Bearer mock-token")
				.send()
			expect(res.status).toBe(200)
			expect(res.body.status).toBe("completed")
			expect(res.body.escrow_release).toBeDefined()
		})

		it("rejects completing a pending booking", async () => {
			;(mentorStore.getBookingById as jest.Mock).mockResolvedValueOnce(
				mockBooking,
			)
			const res = await request(app)
				.post("/api/bookings/1/complete")
				.set("Authorization", "Bearer mock-token")
				.send()
			expect(res.status).toBe(409)
		})
	})

	describe("POST /api/bookings/:id/cancel", () => {
		it("cancels a pending booking", async () => {
			;(mentorStore.getBookingById as jest.Mock).mockResolvedValueOnce(
				mockBooking,
			)
			const res = await request(app)
				.post("/api/bookings/1/cancel")
				.set("Authorization", "Bearer mock-token")
				.send()
			expect(res.status).toBe(200)
			expect(res.body.status).toBe("cancelled")
		})
	})

	describe("POST /api/bookings/:id/dispute", () => {
		it("disputes a paid booking", async () => {
			;(mentorStore.getBookingById as jest.Mock).mockResolvedValueOnce(
				mockPaidBooking,
			)
			const res = await request(app)
				.post("/api/bookings/1/dispute")
				.set("Authorization", "Bearer mock-token")
				.send()
			expect(res.status).toBe(200)
			expect(res.body.status).toBe("disputed")
		})
	})

	describe("GET /api/bookings/my-sessions", () => {
		it("returns sessions for the current user", async () => {
			const res = await request(app)
				.get("/api/bookings/my-sessions")
				.set("Authorization", "Bearer mock-token")
			expect(res.status).toBe(200)
			expect(Array.isArray(res.body)).toBe(true)
		})

		it("filters by role=learner", async () => {
			const res = await request(app)
				.get("/api/bookings/my-sessions?role=learner")
				.set("Authorization", "Bearer mock-token")
			expect(res.status).toBe(200)
			expect(mentorStore.getBookingsForLearner).toHaveBeenCalled()
		})
	})
})
