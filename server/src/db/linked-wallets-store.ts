import { randomUUID } from "node:crypto"

import { pool } from "./index"

export type LinkedWalletRow = {
	wallet_address: string
	is_primary: boolean
}

export async function findClusterIdForWallet(
	walletAddress: string,
): Promise<string | null> {
	const res = await pool.query<{ cluster_id: string }>(
		`SELECT cluster_id FROM linked_wallets WHERE wallet_address = $1 LIMIT 1`,
		[walletAddress],
	)
	return res.rows[0]?.cluster_id ?? null
}

export async function listClusterWallets(
	clusterId: string,
): Promise<LinkedWalletRow[]> {
	const res = await pool.query<LinkedWalletRow>(
		`SELECT wallet_address, is_primary
     FROM linked_wallets
     WHERE cluster_id = $1
     ORDER BY is_primary DESC, wallet_address ASC`,
		[clusterId],
	)
	return res.rows
}

/**
 * Links `newWallet` into the cluster of `jwtWallet`, creating a cluster if needed.
 */
export async function linkWalletToCluster(
	jwtWallet: string,
	newWallet: string,
): Promise<{ clusterId: string }> {
	if (jwtWallet === newWallet) {
		throw new Error("Cannot link wallet to itself")
	}

	const client = await pool.connect()
	try {
		await client.query("BEGIN")

		const existingNew = await client.query<{ cluster_id: string }>(
			`SELECT cluster_id FROM linked_wallets WHERE wallet_address = $1`,
			[newWallet],
		)
		const jwtCluster = await client.query<{ cluster_id: string }>(
			`SELECT cluster_id FROM linked_wallets WHERE wallet_address = $1`,
			[jwtWallet],
		)

		let clusterId = jwtCluster.rows[0]?.cluster_id

		if (existingNew.rows.length > 0) {
			const existingCluster = existingNew.rows[0].cluster_id
			if (clusterId && existingCluster === clusterId) {
				await client.query("ROLLBACK")
				throw new Error("ALREADY_IN_CLUSTER")
			}
			await client.query("ROLLBACK")
			throw new Error("WALLET_ALREADY_LINKED")
		}

		if (!clusterId) {
			clusterId = randomUUID()
			await client.query(
				`INSERT INTO linked_wallets (cluster_id, wallet_address, is_primary)
         VALUES ($1, $2, TRUE)`,
				[clusterId, jwtWallet],
			)
		}

		await client.query(
			`INSERT INTO linked_wallets (cluster_id, wallet_address, is_primary)
       VALUES ($1, $2, FALSE)`,
			[clusterId, newWallet],
		)

		await client.query("COMMIT")
		return { clusterId }
	} catch (err) {
		await client.query("ROLLBACK").catch(() => {})
		throw err
	} finally {
		client.release()
	}
}

export async function setPrimaryWallet(
	jwtWallet: string,
	primaryAddress: string,
): Promise<void> {
	const clusterId = await findClusterIdForWallet(jwtWallet)
	if (!clusterId) {
		throw new Error("NO_CLUSTER")
	}

	const member = await pool.query(
		`SELECT 1 FROM linked_wallets WHERE cluster_id = $1 AND wallet_address = $2`,
		[clusterId, primaryAddress],
	)
	if (member.rows.length === 0) {
		throw new Error("NOT_IN_CLUSTER")
	}

	const client = await pool.connect()
	try {
		await client.query("BEGIN")
		await client.query(
			`UPDATE linked_wallets SET is_primary = FALSE WHERE cluster_id = $1`,
			[clusterId],
		)
		await client.query(
			`UPDATE linked_wallets SET is_primary = TRUE WHERE cluster_id = $1 AND wallet_address = $2`,
			[clusterId, primaryAddress],
		)
		await client.query("COMMIT")
	} catch (err) {
		await client.query("ROLLBACK").catch(() => {})
		throw err
	} finally {
		client.release()
	}
}
