import { useCallback, useEffect, useState } from "react"

import { apiFetchJson } from "../lib/api"

export interface Mentor {
	address: string
	bio: string | null
	hourly_rate: string
	skills: string[]
	active: boolean
	created_at: string
}

export interface MentorSlot {
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

export interface EscrowInstructions {
	recipient: string
	amount_usdc: string
	memo: string
	note: string
}

export interface CreateBookingResponse {
	booking: MentorBooking
	escrow_instructions: EscrowInstructions
}

export function useMentors() {
	const [mentors, setMentors] = useState<Mentor[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchMentors = useCallback(async (skill?: string) => {
		setLoading(true)
		setError(null)
		try {
			const query = skill ? `?skill=${encodeURIComponent(skill)}` : ""
			const data = await apiFetchJson<Mentor[]>(`/api/mentors${query}`)
			setMentors(data)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch mentors")
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		void fetchMentors()
	}, [fetchMentors])

	return { mentors, loading, error, refetch: fetchMentors }
}

export function useMentorAvailability(mentorAddr: string | null) {
	const [slots, setSlots] = useState<MentorSlot[]>([])
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		if (!mentorAddr) {
			setSlots([])
			return
		}
		setLoading(true)
		apiFetchJson<MentorSlot[]>(`/api/mentors/${mentorAddr}/availability`)
			.then(setSlots)
			.catch(() => setSlots([]))
			.finally(() => setLoading(false))
	}, [mentorAddr])

	return { slots, loading }
}

export function useMySessions() {
	const [bookings, setBookings] = useState<MentorBooking[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchSessions = useCallback(async (role?: "learner" | "mentor") => {
		setLoading(true)
		setError(null)
		try {
			const query = role ? `?role=${role}` : ""
			const data = await apiFetchJson<MentorBooking[]>(
				`/api/bookings/my-sessions${query}`,
				{ auth: true },
			)
			setBookings(data)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch sessions")
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		void fetchSessions()
	}, [fetchSessions])

	return { bookings, loading, error, refetch: fetchSessions }
}

export async function createBooking(
	slotId: number,
	amountUsdc: string,
): Promise<CreateBookingResponse> {
	return apiFetchJson<CreateBookingResponse>("/api/bookings", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ slot_id: slotId, amount_usdc: amountUsdc }),
		auth: true,
	})
}

export async function confirmBookingPayment(
	bookingId: number,
	escrowTx: string,
): Promise<MentorBooking> {
	return apiFetchJson<MentorBooking>(
		`/api/bookings/${bookingId}/confirm-payment`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ escrow_tx: escrowTx }),
			auth: true,
		},
	)
}

export async function completeBooking(
	bookingId: number,
): Promise<MentorBooking> {
	return apiFetchJson<MentorBooking>(`/api/bookings/${bookingId}/complete`, {
		method: "POST",
		auth: true,
	})
}

export async function cancelBooking(bookingId: number): Promise<MentorBooking> {
	return apiFetchJson<MentorBooking>(`/api/bookings/${bookingId}/cancel`, {
		method: "POST",
		auth: true,
	})
}

export async function disputeBooking(
	bookingId: number,
): Promise<MentorBooking> {
	return apiFetchJson<MentorBooking>(`/api/bookings/${bookingId}/dispute`, {
		method: "POST",
		auth: true,
	})
}
