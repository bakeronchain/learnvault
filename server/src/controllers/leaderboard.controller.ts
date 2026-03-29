import { type Request, type Response } from "express"

/**
 * Mock data for the leaderboard.
 * In a real production app, this would be fetched from an indexer or
 * by aggregating on-chain events.
 */
const MOCK_LEADERS = [
	{
		rank: 1,
		address: "GDOW...7890",
		fullAddress: "GDOWK76XRPX7PFM7W4ZREXV6XOPD6VHY6G6G6G6G6G6G6G6G6G6G6G6G",
		balance: "1250",
		completedCourses: 5,
	},
	{
		rank: 2,
		address: "GBAV...1234",
		fullAddress: "GBAV76XRPX7PFM7W4ZREXV6XOPD6VHY6G6G6G6G6G6G6G6G6G6G6G6G",
		balance: "980",
		completedCourses: 4,
	},
	{
		rank: 3,
		address: "GCTY...5678",
		fullAddress: "GCTY76XRPX7PFM7W4ZREXV6XOPD6VHY6G6G6G6G6G6G6G6G6G6G6G6G",
		balance: "750",
		completedCourses: 3,
	},
	{
		rank: 4,
		address: "GDQK...4321",
		fullAddress: "GDQK76XRPX7PFM7W4ZREXV6XOPD6VHY6G6G6G6G6G6G6G6G6G6G6G6G",
		balance: "420",
		completedCourses: 2,
	},
	{
		rank: 5,
		address: "GBNZ...8765",
		fullAddress: "GBNZ76XRPX7PFM7W4ZREXV6XOPD6VHY6G6G6G6G6G6G6G6G6G6G6G6G",
		balance: "150",
		completedCourses: 1,
	},
]

export const getLeaderboard = (req: Request, res: Response): void => {
	const limit = Number.parseInt(String(req.query.limit ?? "10"), 10)
	const offset = Number.parseInt(String(req.query.offset ?? "0"), 10)

	const normalizedLimit = Number.isNaN(limit)
		? 10
		: Math.max(1, Math.min(limit, 50))
	const normalizedOffset = Number.isNaN(offset) ? 0 : Math.max(0, offset)

	// Return a slice of mock data
	const data = MOCK_LEADERS.slice(
		normalizedOffset,
		normalizedOffset + normalizedLimit,
	)

	res.status(200).json({
		data,
		total: MOCK_LEADERS.length,
		limit: normalizedLimit,
		offset: normalizedOffset,
	})
}
