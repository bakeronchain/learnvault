import { type Request, type Response } from "express"
import { z } from "zod"

import {
	type BookingStatus,
	type Mentor,
	type MentorBooking,
	mentorStore,
} from "../db/mentor-store"
import { type AuthRequest } from "../middleware/auth.middleware"

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const registerMentorSchema = z.object({
	bio: z.string().max(500).optional().nullable(),
	hourly_rate: z.union([z.string(), z.number()]).transform((v) => String(v)),
	skills: z.array(z.string().min(1)).min(1),
})

const addAvailabilitySchema = z.object({
	start_ts: z.string().min(1),
	end_ts: z.string().min(1),
})

const createBookingSchema = z.object({
	slot_id: z.number().int().positive(),
	amount_usdc: z.union([z.string(), z.number()]).transform((v) => String(v)),
})

const confirmPaymentSchema = z.object({
	escrow_tx: z.string().min(1),
})

// ---------------------------------------------------------------------------
// Mentor profile endpoints
// ---------------------------------------------------------------------------

export async function registerMentor(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const validation = registerMentorSchema.safeParse(req.body)
	if (!validation.success) {
		res.status(400).json({
			error: "Invalid request data",
			details: validation.error.flatten().fieldErrors,
		})
		return
	}

	const address = req.user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const mentor = await mentorStore.upsertMentor(
		address,
		validation.data.bio ?? null,
		validation.data.hourly_rate,
		validation.data.skills,
	)
	res.status(201).json(mentor)
}

export async function getMentors(req: Request, res: Response): Promise<void> {
	const skill = req.query.skill as string | undefined
	const mentors = await mentorStore.getActiveMentors(skill)
	res.json(mentors)
}

// ---------------------------------------------------------------------------
// Availability endpoints
// ---------------------------------------------------------------------------

export async function addAvailability(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const validation = addAvailabilitySchema.safeParse(req.body)
	if (!validation.success) {
		res.status(400).json({
			error: "Invalid request data",
			details: validation.error.flatten().fieldErrors,
		})
		return
	}

	const mentorAddr = req.params.addr
	const userAddr = req.user?.address
	if (!userAddr || userAddr !== mentorAddr) {
		res.status(403).json({ error: "Can only add availability for yourself" })
		return
	}

	const slot = await mentorStore.addAvailability(
		mentorAddr,
		validation.data.start_ts,
		validation.data.end_ts,
	)
	res.status(201).json(slot)
}

export async function getAvailability(
	req: Request,
	res: Response,
): Promise<void> {
	const slots = await mentorStore.getAvailability(req.params.addr)
	res.json(slots)
}

// ---------------------------------------------------------------------------
// Booking endpoints
// ---------------------------------------------------------------------------

export async function createBooking(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const validation = createBookingSchema.safeParse(req.body)
	if (!validation.success) {
		res.status(400).json({
			error: "Invalid request data",
			details: validation.error.flatten().fieldErrors,
		})
		return
	}

	const learnerAddr = req.user?.address
	if (!learnerAddr) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const slot = await mentorStore.getSlotById(validation.data.slot_id)
	if (!slot) {
		res.status(404).json({ error: "Slot not found" })
		return
	}
	if (slot.booked) {
		res.status(409).json({ error: "Slot already booked" })
		return
	}
	if (slot.mentor_addr === learnerAddr) {
		res.status(400).json({ error: "Cannot book your own slot" })
		return
	}

	const booking = await mentorStore.createBooking(
		slot.id,
		learnerAddr,
		slot.mentor_addr,
		validation.data.amount_usdc,
	)

	res.status(201).json({
		booking,
		escrow_instructions: {
			recipient: slot.mentor_addr,
			amount_usdc: validation.data.amount_usdc,
			memo: `mentor-booking-${booking.id}`,
			note: "Deposit USDC to the mentor's escrow address and submit the tx hash via POST /api/bookings/:id/confirm-payment",
		},
	})
}

export async function confirmPayment(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const validation = confirmPaymentSchema.safeParse(req.body)
	if (!validation.success) {
		res.status(400).json({
			error: "Invalid request data",
			details: validation.error.flatten().fieldErrors,
		})
		return
	}

	const bookingId = Number.parseInt(req.params.id, 10)
	if (Number.isNaN(bookingId)) {
		res.status(400).json({ error: "Invalid booking id" })
		return
	}

	const booking = await mentorStore.getBookingById(bookingId)
	if (!booking) {
		res.status(404).json({ error: "Booking not found" })
		return
	}

	const userAddr = req.user?.address
	if (!userAddr || userAddr !== booking.learner_addr) {
		res.status(403).json({ error: "Only the learner can confirm payment" })
		return
	}

	if (booking.status !== "pending") {
		res
			.status(409)
			.json({ error: `Booking already in status: ${booking.status}` })
		return
	}

	// Lock the slot atomically — prevents double-booking
	const lockedSlot = await mentorStore.lockSlot(booking.slot_id)
	if (!lockedSlot) {
		res
			.status(409)
			.json({ error: "Slot was already booked by another booking" })
		return
	}

	const updated = await mentorStore.confirmPayment(
		bookingId,
		validation.data.escrow_tx,
	)
	if (!updated) {
		await mentorStore.unlockSlot(booking.slot_id)
		res
			.status(409)
			.json({
				error: "Could not confirm payment — booking not in pending state",
			})
		return
	}

	res.json(updated)
}

export async function completeBooking(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const bookingId = Number.parseInt(req.params.id, 10)
	if (Number.isNaN(bookingId)) {
		res.status(400).json({ error: "Invalid booking id" })
		return
	}

	const booking = await mentorStore.getBookingById(bookingId)
	if (!booking) {
		res.status(404).json({ error: "Booking not found" })
		return
	}

	const userAddr = req.user?.address
	const isLearner = userAddr === booking.learner_addr
	const isMentor = userAddr === booking.mentor_addr
	if (!userAddr || (!isLearner && !isMentor)) {
		res
			.status(403)
			.json({ error: "Only the learner or mentor can complete this booking" })
		return
	}

	if (booking.status !== "paid") {
		res
			.status(409)
			.json({
				error: `Booking must be in 'paid' state to complete, current: ${booking.status}`,
			})
		return
	}

	const updated = await mentorStore.completeBooking(bookingId)
	if (!updated) {
		res.status(409).json({ error: "Could not complete booking" })
		return
	}

	res.json({
		...updated,
		escrow_release: {
			mentor_addr: booking.mentor_addr,
			amount_usdc: booking.amount_usdc,
			note: "Escrow funds released to mentor after session completion",
		},
	})
}

export async function cancelBooking(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const bookingId = Number.parseInt(req.params.id, 10)
	if (Number.isNaN(bookingId)) {
		res.status(400).json({ error: "Invalid booking id" })
		return
	}

	const booking = await mentorStore.getBookingById(bookingId)
	if (!booking) {
		res.status(404).json({ error: "Booking not found" })
		return
	}

	const userAddr = req.user?.address
	const isLearner = userAddr === booking.learner_addr
	const isMentor = userAddr === booking.mentor_addr
	if (!userAddr || (!isLearner && !isMentor)) {
		res
			.status(403)
			.json({ error: "Only the learner or mentor can cancel this booking" })
		return
	}

	const updated = await mentorStore.cancelBooking(bookingId)
	if (!updated) {
		res
			.status(409)
			.json({ error: "Booking cannot be cancelled in its current state" })
		return
	}

	if (booking.status === "paid") {
		await mentorStore.unlockSlot(booking.slot_id)
	}

	res.json(updated)
}

export async function disputeBooking(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const bookingId = Number.parseInt(req.params.id, 10)
	if (Number.isNaN(bookingId)) {
		res.status(400).json({ error: "Invalid booking id" })
		return
	}

	const booking = await mentorStore.getBookingById(bookingId)
	if (!booking) {
		res.status(404).json({ error: "Booking not found" })
		return
	}

	const userAddr = req.user?.address
	const isLearner = userAddr === booking.learner_addr
	const isMentor = userAddr === booking.mentor_addr
	if (!userAddr || (!isLearner && !isMentor)) {
		res
			.status(403)
			.json({ error: "Only the learner or mentor can dispute this booking" })
		return
	}

	const updated = await mentorStore.disputeBooking(bookingId)
	if (!updated) {
		res
			.status(409)
			.json({ error: "Booking cannot be disputed in its current state" })
		return
	}

	res.json(updated)
}

export async function getMySessions(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const userAddr = req.user?.address
	if (!userAddr) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const role = req.query.role as string | undefined
	let bookings: MentorBooking[]

	if (role === "mentor") {
		bookings = await mentorStore.getBookingsForMentor(userAddr)
	} else if (role === "learner") {
		bookings = await mentorStore.getBookingsForLearner(userAddr)
	} else {
		const [asLearner, asMentor] = await Promise.all([
			mentorStore.getBookingsForLearner(userAddr),
			mentorStore.getBookingsForMentor(userAddr),
		])
		bookings = [...asLearner, ...asMentor]
	}

	res.json(bookings)
}
