import { pool } from "../db/index"

export interface LrnBurnRecord {
	id: number
	walletAddress: string
	amount: string
	txHash: string
	burnedAt: string
}

type BurnRow = {
	id: number
	wallet_address: string
	amount: string
	tx_hash: string
	burned_at: Date
}

function mapRow(row: BurnRow): LrnBurnRecord {
	return {
		id: row.id,
		walletAddress: row.wallet_address,
		amount: String(row.amount),
		txHash: row.tx_hash,
		burnedAt: row.burned_at.toISOString(),
	}
}

export async function insertLrnBurn(params: {
	walletAddress: string
	amountAtomic: bigint
	txHash: string
}): Promise<LrnBurnRecord> {
	const result = await pool.query<BurnRow>(
		`INSERT INTO lrn_burns (wallet_address, amount, tx_hash)
		 VALUES ($1, $2, $3)
		 RETURNING id, wallet_address, amount, tx_hash, burned_at`,
		[params.walletAddress, params.amountAtomic.toString(), params.txHash],
	)
	return mapRow(result.rows[0])
}

export async function listLrnBurnsByWallet(
	walletAddress: string,
): Promise<LrnBurnRecord[]> {
	const result = await pool.query<BurnRow>(
		`SELECT id, wallet_address, amount, tx_hash, burned_at
		 FROM lrn_burns
		 WHERE wallet_address = $1
		 ORDER BY burned_at DESC`,
		[walletAddress],
	)
	return result.rows.map(mapRow)
}

export const lrnBurnStore = {
	insertLrnBurn,
	listLrnBurnsByWallet,
}
