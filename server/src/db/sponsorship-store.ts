import { pool } from "./index"

export type SponsoredAccountStatus = "pending" | "active" | "revoked"
export type SponsorSpendKind = "create_account" | "fee_bump"

export interface SponsoredAccount {
	learner_address: string
	sponsor_tx_hash: string
	reserves_locked_stroops: string
	status: SponsoredAccountStatus
	created_at: string
	activated_at: string | null
}

export const sponsorshipStore = {
	async insertSponsoredAccount(data: {
		learnerAddress: string
		sponsorTxHash: string
		reservesLockedStroops: bigint
	}): Promise<SponsoredAccount> {
		const result = await pool.query(
			`INSERT INTO sponsored_accounts (learner_address, sponsor_tx_hash, reserves_locked_stroops, status)
			 VALUES ($1, $2, $3, 'pending')
			 ON CONFLICT (learner_address) DO UPDATE
				SET sponsor_tx_hash = EXCLUDED.sponsor_tx_hash,
					reserves_locked_stroops = EXCLUDED.reserves_locked_stroops
			 RETURNING *`,
			[
				data.learnerAddress,
				data.sponsorTxHash,
				data.reservesLockedStroops.toString(),
			],
		)
		return result.rows[0]
	},

	async markAccountActive(learnerAddress: string): Promise<void> {
		await pool.query(
			`UPDATE sponsored_accounts
			 SET status = 'active', activated_at = COALESCE(activated_at, CURRENT_TIMESTAMP)
			 WHERE learner_address = $1`,
			[learnerAddress],
		)
	},

	async countSponsoredAccounts(): Promise<number> {
		const result = await pool.query(
			`SELECT COUNT(*)::int AS count FROM sponsored_accounts WHERE status != 'revoked'`,
		)
		return result.rows[0]?.count ?? 0
	},

	async sumReservesLocked(): Promise<bigint> {
		const result = await pool.query(
			`SELECT COALESCE(SUM(reserves_locked_stroops), 0)::text AS total
			 FROM sponsored_accounts WHERE status != 'revoked'`,
		)
		return BigInt(result.rows[0]?.total ?? "0")
	},

	async recordSpend(data: {
		amountStroops: bigint
		kind: SponsorSpendKind
		learnerAddress?: string
		txHash?: string
	}): Promise<void> {
		await pool.query(
			`INSERT INTO sponsor_spend_log (amount_stroops, kind, learner_address, tx_hash)
			 VALUES ($1, $2, $3, $4)`,
			[
				data.amountStroops.toString(),
				data.kind,
				data.learnerAddress ?? null,
				data.txHash ?? null,
			],
		)
	},

	/** Sum of amount_stroops spent at/after `since` (inclusive) — used for the daily spend ceiling. */
	async sumSpendSince(since: Date): Promise<bigint> {
		const result = await pool.query(
			`SELECT COALESCE(SUM(amount_stroops), 0)::text AS total
			 FROM sponsor_spend_log WHERE spent_at >= $1`,
			[since.toISOString()],
		)
		return BigInt(result.rows[0]?.total ?? "0")
	},
}
