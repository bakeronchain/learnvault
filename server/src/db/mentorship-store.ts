import { pool } from "./index"

export interface MentorProfile {
	address: string
	skills: string[]
	availability: boolean
	active: boolean
	created_at: string
}

export interface MentorshipRequest {
	id: number
	scholar_address: string
	skills_needed: string[]
	status: string
	mentor_address: string | null
	created_at: string
}

export const mentorshipStore = {
	async getActiveMentors(): Promise<MentorProfile[]> {
		const result = await pool.query(
			"SELECT * FROM mentor_profiles WHERE active = true ORDER BY created_at DESC",
		)
		return result.rows
	},

	async createRequest(
		scholarAddress: string,
		skillsNeeded: string[],
	): Promise<MentorshipRequest> {
		const result = await pool.query(
			`INSERT INTO mentorship_requests (scholar_address, skills_needed)
			 VALUES ($1, $2) RETURNING *`,
			[scholarAddress, skillsNeeded],
		)
		return result.rows[0]
	},

	async approveMentor(address: string): Promise<MentorProfile | null> {
		const result = await pool.query(
			"UPDATE mentor_profiles SET active = true WHERE address = $1 RETURNING *",
			[address],
		)
		return result.rows[0] ?? null
	},
}
