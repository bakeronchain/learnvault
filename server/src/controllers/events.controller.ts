import { type Request, type Response } from "express"
import { Pool } from "pg"
import { type ApiEvent } from "../types/events.js"

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })

export const getEvents = async (req: Request, res: Response): Promise<void> => {
	const { contract, type: eventType, address, limit = "20" } = req.query

	const normalizedLimit = Math.max(1, Math.min(Number(limit), 100))

	let query = `
    SELECT id, contract, event_type, data, ledger_sequence, created_at 
    FROM events 
    WHERE 1=1
  `
	const params: any[] = []
	let paramIndex = 1

	if (contract) {
		query += ` AND contract = $${paramIndex++}`
		params.push(contract)
	}
	if (eventType) {
		query += ` AND event_type = $${paramIndex++}`
		params.push(eventType)
	}
	if (address) {
		query += ` AND data->>'address' = $${paramIndex++}`
		params.push(address)
	}

	query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`
	params.push(normalizedLimit)

	try {
		const result = await pool.query(query, params)
		const data: ApiEvent[] = result.rows.map((row) => ({
			...row,
			ledger_sequence: BigInt(row.ledger_sequence),
		}))
		res.status(200).json({ data })
	} catch (err) {
		console.error("[events] Query failed:", err)
		res.status(500).json({ error: "Failed to fetch events" })
	}
}
