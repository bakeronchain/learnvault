import { pool } from "../db/index"

export interface LeaderboardRanking {
	rank: number
	address: string
	lrn_balance: string
	courses_completed: number
}

export interface LeaderboardData {
	rankings: LeaderboardRanking[]
	total: number
	your_rank: number | null
}

export async function getLeaderboardData(options: {
	page?: number
	limit?: number
	search?: string
	viewerAddress?: string
}): Promise<LeaderboardData> {
	const page = Math.max(options.page ?? 1, 1)
	const limit = Math.min(options.limit ?? 50, 100)
	const search = options.search?.trim() ?? ""
	const offset = (page - 1) * limit

	const whereClause = search ? "WHERE address ILIKE $1" : ""
	const whereValues: unknown[] = search ? [`%${search}%`] : []

	const totalResult = await pool.query(
		`SELECT COUNT(*)::int AS total FROM scholar_balances ${whereClause}`,
		whereValues,
	)
	const total = Number(totalResult.rows[0]?.total ?? 0)

	const rankingsValues = [...whereValues, limit, offset]
	const rankingsResult = await pool.query(
		`SELECT
			ROW_NUMBER() OVER (ORDER BY lrn_balance DESC, address ASC) + $${whereValues.length + 2} AS rank,
			address,
			lrn_balance,
			courses_completed
		 FROM scholar_balances
		 ${whereClause}
		 ORDER BY lrn_balance DESC, address ASC
		 LIMIT $${whereValues.length + 1}
		 OFFSET $${whereValues.length + 2}`,
		rankingsValues,
	)

	let yourRank: number | null = null
	if (options.viewerAddress) {
		const rankResult = await pool.query(
			`SELECT rank FROM (
				SELECT ROW_NUMBER() OVER (ORDER BY lrn_balance DESC, address ASC) AS rank, address
				FROM scholar_balances
			) ranked
			WHERE address = $1`,
			[options.viewerAddress],
		)
		yourRank = rankResult.rows[0]?.rank ? Number(rankResult.rows[0].rank) : null
	}

	return {
		rankings: rankingsResult.rows,
		total,
		your_rank: yourRank,
	}
}
