import { pool } from "./index"

export interface Mentor {
	address: string
	bio: string | null
	hourly_rate: string
	skills: string[]
	active: boolean
	created_at: string
}

export interface MentorAvailability {
	id: number
	mentor_addr: string
	start_ts: string
	end_ts: string
	booked: boolean
}

export type BookingStatus =
	"pending" | "paid" | "completed" | "cancelled" | "disputed"

export interface MentorBooking {
	id: number
	slot_id: number
	learner_addr: string
	mentor_addr: string
	amount_usdc: string
	escrow_tx: string | null
	status: BookingStatus
	created_at: string
}

export const mentorStore = {
	async upsertMentor(
		address: string,
		bio: string | null,
		hourlyRate: string,
		skills: string[],
	): Promise<Mentor> {
		const result = await pool.query(
			`INSERT INTO mentors (address, bio, hourly_rate, skills)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (address) DO UPDATE
			   SET bio = EXCLUDED.bio,
			       hourly_rate = EXCLUDED.hourly_rate,
			       skills = EXCLUDED.skills
			 RETURNING *`,
			[address, bio, hourlyRate, skills],
		)
		return result.rows[0]
	},

	async getActiveMentors(skill?: string): Promise<Mentor[]> {
		if (skill) {
			const result = await pool.query(
				`SELECT * FROM mentors
				 WHERE active = true AND $1 = ANY(skills)
				 ORDER BY created_at DESC`,
				[skill],
			)
			return result.rows
		}
		const result = await pool.query(
			"SELECT * FROM mentors WHERE active = true ORDER BY created_at DESC",
		)
		return result.rows
	},

	async getMentorByAddress(address: string): Promise<Mentor | null> {
		const result = await pool.query(
			"SELECT * FROM mentors WHERE address = $1",
			[address],
		)
		return result.rows[0] ?? null
	},

	async addAvailability(
		mentorAddr: string,
		startTs: string,
		endTs: string,
	): Promise<MentorAvailability> {
		const result = await pool.query(
			`INSERT INTO mentor_availability (mentor_addr, start_ts, end_ts)
			 VALUES ($1, $2, $3) RETURNING *`,
			[mentorAddr, startTs, endTs],
		)
		return result.rows[0]
	},

	async getAvailability(mentorAddr: string): Promise<MentorAvailability[]> {
		const result = await pool.query(
			`SELECT * FROM mentor_availability
			 WHERE mentor_addr = $1 AND booked = false
			 ORDER BY start_ts ASC`,
			[mentorAddr],
		)
		return result.rows
	},

	async getSlotById(slotId: number): Promise<MentorAvailability | null> {
		const result = await pool.query(
			"SELECT * FROM mentor_availability WHERE id = $1",
			[slotId],
		)
		return result.rows[0] ?? null
	},

	async lockSlot(slotId: number): Promise<MentorAvailability | null> {
		const result = await pool.query(
			`UPDATE mentor_availability SET booked = true
			 WHERE id = $1 AND booked = false
			 RETURNING *`,
			[slotId],
		)
		return result.rows[0] ?? null
	},

	async unlockSlot(slotId: number): Promise<void> {
		await pool.query(
			"UPDATE mentor_availability SET booked = false WHERE id = $1",
			[slotId],
		)
	},

	async createBooking(
		slotId: number,
		learnerAddr: string,
		mentorAddr: string,
		amountUsdc: string,
	): Promise<MentorBooking> {
		const result = await pool.query(
			`INSERT INTO mentor_bookings (slot_id, learner_addr, mentor_addr, amount_usdc)
			 VALUES ($1, $2, $3, $4) RETURNING *`,
			[slotId, learnerAddr, mentorAddr, amountUsdc],
		)
		return result.rows[0]
	},

	async getBookingById(id: number): Promise<MentorBooking | null> {
		const result = await pool.query(
			"SELECT * FROM mentor_bookings WHERE id = $1",
			[id],
		)
		return result.rows[0] ?? null
	},

	async confirmPayment(
		id: number,
		escrowTx: string,
	): Promise<MentorBooking | null> {
		const result = await pool.query(
			`UPDATE mentor_bookings
			 SET escrow_tx = $2, status = 'paid'
			 WHERE id = $1 AND status = 'pending'
			 RETURNING *`,
			[id, escrowTx],
		)
		return result.rows[0] ?? null
	},

	async completeBooking(id: number): Promise<MentorBooking | null> {
		const result = await pool.query(
			`UPDATE mentor_bookings
			 SET status = 'completed'
			 WHERE id = $1 AND status = 'paid'
			 RETURNING *`,
			[id],
		)
		return result.rows[0] ?? null
	},

	async cancelBooking(id: number): Promise<MentorBooking | null> {
		const result = await pool.query(
			`UPDATE mentor_bookings
			 SET status = 'cancelled'
			 WHERE id = $1 AND status IN ('pending', 'paid')
			 RETURNING *`,
			[id],
		)
		return result.rows[0] ?? null
	},

	async disputeBooking(id: number): Promise<MentorBooking | null> {
		const result = await pool.query(
			`UPDATE mentor_bookings
			 SET status = 'disputed'
			 WHERE id = $1 AND status = 'paid'
			 RETURNING *`,
			[id],
		)
		return result.rows[0] ?? null
	},

	async getBookingsForLearner(learnerAddr: string): Promise<MentorBooking[]> {
		const result = await pool.query(
			"SELECT * FROM mentor_bookings WHERE learner_addr = $1 ORDER BY created_at DESC",
			[learnerAddr],
		)
		return result.rows
	},

	async getBookingsForMentor(mentorAddr: string): Promise<MentorBooking[]> {
		const result = await pool.query(
			"SELECT * FROM mentor_bookings WHERE mentor_addr = $1 ORDER BY created_at DESC",
			[mentorAddr],
		)
		return result.rows
	},
}
