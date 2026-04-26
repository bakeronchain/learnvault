import { type Request, type Response } from "express"
import { pool } from "../db/index"

function parsePositiveInt(value: unknown, fallback: number): number {
	if (typeof value !== "string") return fallback
	const parsed = Number.parseInt(value, 10)
	if (Number.isNaN(parsed) || parsed < 0) return fallback
	return parsed
}

function extractTxHash(data: unknown): string | null {
	if (!data || typeof data !== "object") return null

	const queue: unknown[] = [data]
	const txKeys = new Set([
		"txhash",
		"tx_hash",
		"transactionhash",
		"transaction_hash",
	])

	while (queue.length > 0) {
		const current = queue.shift()
		if (Array.isArray(current)) {
			queue.push(...current)
			continue
		}

		if (!current || typeof current !== "object") {
			continue
		}

		for (const [rawKey, value] of Object.entries(current)) {
			const key = rawKey.toLowerCase()
			if (txKeys.has(key) && typeof value === "string" && value.length > 0) {
				return value
			}
			if (value && typeof value === "object") {
				queue.push(value)
			}
		}
	}

	return null
}

export const getEvents = async (req: Request, res: Response): Promise<void> => {
	const contractFilter =
		typeof req.query.contract === "string"
			? req.query.contract.trim()
			: undefined
	const typeFilter =
		typeof req.query.type === "string" ? req.query.type.trim() : undefined
	const addressFilter =
		typeof req.query.address === "string" ? req.query.address.trim() : undefined

	const limit = Math.max(
		1,
		Math.min(parsePositiveInt(req.query.limit, 50), 100),
	)
	const pageParam = parsePositiveInt(req.query.page, 1)
	const offsetQueryParam = parsePositiveInt(req.query.offset, -1)
	const offset = offsetQueryParam >= 0 ? offsetQueryParam : (pageParam - 1) * limit
	const page = offsetQueryParam >= 0 ? Math.floor(offset / limit) + 1 : pageParam

	let query = `
		SELECT id, contract, event_type, data, ledger_sequence, created_at
		FROM events
	`
	let countQuery = `SELECT COUNT(*)::int as total FROM events`
	const conditions: string[] = []
	const params: unknown[] = []

	if (contractFilter) {
		params.push(contractFilter)
		conditions.push(`contract = $${params.length}`)
	}

	if (typeFilter) {
		params.push(typeFilter)
		conditions.push(`event_type = $${params.length}`)
	}

	if (addressFilter) {
		params.push(`%${addressFilter.toLowerCase()}%`)
		conditions.push(`LOWER(data::text) LIKE $${params.length}`)
	}

	if (conditions.length > 0) {
		const whereClause = ` WHERE ${conditions.join(" AND ")}`
		query += whereClause
		countQuery += whereClause
	}

	const limitParam = params.length + 1
	const offsetParam = params.length + 2
	query += ` ORDER BY created_at DESC LIMIT $${limitParam} OFFSET $${offsetParam}`
	params.push(limit, offset)

	try {
		const countResult = await pool.query(countQuery, params.slice(0, params.length - 2))
		const total = countResult.rows[0]?.total || 0

		const result = await pool.query(query, params)
		const data = result.rows.map((row) => ({
			...row,
			tx_hash: extractTxHash(row.data),
		}))
		res.status(200).json({ 
			data,
			pagination: { page, limit, total },
		})
	} catch (err) {
		console.error("[events] Query failed:", err)
		res.status(500).json({ error: "Failed to fetch events" })
	}
}
