import { pool } from "./index"

export interface AnchorWithdrawal {
	id: number
	learner_addr: string
	anchor_domain: string
	transaction_id: string
	amount_in: string
	asset_out: string
	amount_out: string | null
	quote_id: string | null
	status: string
	status_message: string | null
	stellar_tx_id: string | null
	created_at: string
	updated_at: string
}

export const anchorWithdrawalStore = {
	async insertWithdrawal(data: {
		learnerAddr: string
		anchorDomain: string
		transactionId: string
		amountIn: string
		assetOut: string
		quoteId?: string | null
	}): Promise<AnchorWithdrawal> {
		const result = await pool.query(
			`INSERT INTO anchor_withdrawals
				(learner_addr, anchor_domain, transaction_id, amount_in, asset_out, quote_id, status)
			 VALUES ($1, $2, $3, $4, $5, $6, 'incomplete')
			 ON CONFLICT (anchor_domain, transaction_id) DO UPDATE
				SET amount_in = EXCLUDED.amount_in,
					asset_out = EXCLUDED.asset_out,
					quote_id = EXCLUDED.quote_id,
					updated_at = NOW()
			 RETURNING *`,
			[
				data.learnerAddr,
				data.anchorDomain,
				data.transactionId,
				data.amountIn,
				data.assetOut,
				data.quoteId ?? null,
			],
		)
		return result.rows[0]
	},

	/**
	 * Reconciles a row's status from the anchor's own report. Idempotent: a
	 * repeated poll with the same status/amount_out/stellar_tx_id is a cheap
	 * no-op write, not an error — the reconciliation worker calls this on
	 * every poll regardless of whether anything actually changed.
	 */
	async updateWithdrawalStatus(
		anchorDomain: string,
		transactionId: string,
		data: {
			status: string
			statusMessage?: string | null
			amountOut?: string | null
			stellarTxId?: string | null
		},
	): Promise<AnchorWithdrawal | null> {
		const result = await pool.query(
			`UPDATE anchor_withdrawals
			 SET status = $3,
				 status_message = COALESCE($4, status_message),
				 amount_out = COALESCE($5, amount_out),
				 stellar_tx_id = COALESCE($6, stellar_tx_id),
				 updated_at = NOW()
			 WHERE anchor_domain = $1 AND transaction_id = $2
			 RETURNING *`,
			[
				anchorDomain,
				transactionId,
				data.status,
				data.statusMessage ?? null,
				data.amountOut ?? null,
				data.stellarTxId ?? null,
			],
		)
		return result.rows[0] ?? null
	},

	async listWithdrawalsForLearner(
		learnerAddr: string,
	): Promise<AnchorWithdrawal[]> {
		const result = await pool.query(
			`SELECT * FROM anchor_withdrawals WHERE learner_addr = $1 ORDER BY created_at DESC`,
			[learnerAddr],
		)
		return result.rows
	},

	/** Rows the reconciliation worker still needs to poll — anything not in a terminal state. */
	async listIncompleteWithdrawals(): Promise<AnchorWithdrawal[]> {
		const result = await pool.query(
			`SELECT * FROM anchor_withdrawals
			 WHERE status NOT IN ('completed', 'refunded', 'expired', 'error')
			 ORDER BY updated_at ASC`,
		)
		return result.rows
	},
}
