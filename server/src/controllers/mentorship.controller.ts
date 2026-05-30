import { type Request, type Response } from "express"
import { z } from "zod"

import { mentorshipStore } from "../db/mentorship-store"
import { type AdminRequest } from "../middleware/admin.middleware"
import { type AuthRequest } from "../middleware/auth.middleware"

const requestSchema = z.object({
	skills_needed: z.array(z.string().min(1)).min(1),
})

export async function getMentors(_req: Request, res: Response): Promise<void> {
	const mentors = await mentorshipStore.getActiveMentors()
	res.json(mentors)
}

export async function createMentorshipRequest(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const validation = requestSchema.safeParse(req.body)
	if (!validation.success) {
		res.status(400).json({
			error: "Invalid request data",
			details: validation.error.flatten().fieldErrors,
		})
		return
	}

	const scholarAddress = req.user?.address
	if (!scholarAddress) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const request = await mentorshipStore.createRequest(
		scholarAddress,
		validation.data.skills_needed,
	)
	res.status(201).json(request)
}

export async function approveMentor(
	req: AdminRequest,
	res: Response,
): Promise<void> {
	const { address } = req.params
	const mentor = await mentorshipStore.approveMentor(address)
	if (!mentor) {
		res.status(404).json({ error: "Mentor profile not found" })
		return
	}
	res.json(mentor)
}
