import { type Request, type Response } from "express"

export type CommunityEvent = {
	id: string
	title: string
	description: string
	date: string
	type: "hackathon" | "study_group" | "workshop"
	link: string
}

// In-memory storage for events (since DB is a stub)
const events: CommunityEvent[] = [
	{
		id: "1",
		title: "Stellar Soroban Hackathon",
		description: "Build the future of decentralized finance on Stellar.",
		date: "2026-05-15T10:00:00Z",
		type: "hackathon",
		link: "https://stellar.org/hackathon",
	},
	{
		id: "2",
		title: "Rust for Soroban Workshop",
		description: "Learn how to write secure smart contracts with Rust.",
		date: "2026-05-20T14:00:00Z",
		type: "workshop",
		link: "https://learnvault.io/workshop/rust",
	},
]

export const getEvents = (req: Request, res: Response) => {
	res.json(events)
}

export const createEvent = (req: Request, res: Response) => {
	const { title, description, date, type, link } = req.body
	if (!title || !description || !date || !type || !link) {
		return res.status(400).json({ error: "Missing required fields" })
	}
	const newEvent: CommunityEvent = {
		id: (events.length + 1).toString(),
		title,
		description,
		date,
		type,
		link,
	}
	events.push(newEvent)
	res.status(201).json(newEvent)
}
