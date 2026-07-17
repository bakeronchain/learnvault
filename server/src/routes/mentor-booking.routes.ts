import { Router } from "express"

import {
	addAvailability,
	cancelBooking,
	completeBooking,
	confirmPayment,
	createBooking,
	disputeBooking,
	getAvailability,
	getMentors,
	getMySessions,
	registerMentor,
} from "../controllers/mentor-booking.controller"
import { authMiddleware } from "../middleware/auth.middleware"

export const mentorBookingRouter = Router()

// Mentor profile
mentorBookingRouter.post("/mentors", authMiddleware, (req, res) => {
	void registerMentor(req, res)
})
mentorBookingRouter.get("/mentors", (req, res) => {
	void getMentors(req, res)
})

// Availability
mentorBookingRouter.post(
	"/mentors/:addr/availability",
	authMiddleware,
	(req, res) => {
		void addAvailability(req, res)
	},
)
mentorBookingRouter.get("/mentors/:addr/availability", (req, res) => {
	void getAvailability(req, res)
})

// Bookings
mentorBookingRouter.post("/bookings", authMiddleware, (req, res) => {
	void createBooking(req, res)
})
mentorBookingRouter.post(
	"/bookings/:id/confirm-payment",
	authMiddleware,
	(req, res) => {
		void confirmPayment(req, res)
	},
)
mentorBookingRouter.post(
	"/bookings/:id/complete",
	authMiddleware,
	(req, res) => {
		void completeBooking(req, res)
	},
)
mentorBookingRouter.post("/bookings/:id/cancel", authMiddleware, (req, res) => {
	void cancelBooking(req, res)
})
mentorBookingRouter.post(
	"/bookings/:id/dispute",
	authMiddleware,
	(req, res) => {
		void disputeBooking(req, res)
	},
)
mentorBookingRouter.get("/bookings/my-sessions", authMiddleware, (req, res) => {
	void getMySessions(req, res)
})
