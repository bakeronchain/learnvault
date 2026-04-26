import { randomUUID } from "node:crypto"

import { Pool } from "pg"

import { pool } from "../db/index"
import { isValidStellarPublicKey } from "./auth.service"

export type LinkedWalletRow = {
	stellar_address: string
	is_primary: boolean
	account_id: string
}

function getPgPool(): Pool | null {
	return pool instanceof Pool ? pool : null
}

export const linkedWalletsService = {
	async listByAccountId(accountId: string): Promise<LinkedWalletRow[]> {
		const p = getPgPool()
		if (!p) return []
		const { rows } = await p.query<{
			account_id: string
			stellar_address: string
			is_primary: boolean
		}>(
			`SELECT account_id, stellar_address, is_primary
       FROM linked_wallets
       WHERE account_id = $1::uuid
       ORDER BY created_at`,
			[accountId],
		)
		return rows.map((r) => ({
			account_id: String(r.account_id),
			stellar_address: r.stellar_address,
			is_primary: r.is_primary,
		}))
	},

	/** Wallets in the same account as `stellar`, or null if none stored. */
	async getGroupForStellar(stellar: string): Promise<LinkedWalletRow[] | null> {
		if (!isValidStellarPublicKey(stellar)) return null
		const p = getPgPool()
		if (!p) return null
		const a = await p.query<{ account_id: string }>(
			"SELECT account_id::text as account_id FROM linked_wallets WHERE stellar_address = $1",
			[stellar],
		)
		if (a.rowCount === 0) return null
		return this.listByAccountId(a.rows[0].account_id)
	},

	async addLinkedWallet(
		authenticated: string,
		toLink: string,
	): Promise<{ group: LinkedWalletRow[]; error?: string }> {
		if (!isValidStellarPublicKey(authenticated) || !isValidStellarPublicKey(toLink)) {
			return { group: [], error: "Invalid Stellar public key" }
		}
		if (authenticated === toLink) {
			return { group: [], error: "Address is already the active wallet" }
		}
		const p = getPgPool()
		if (!p) {
			return {
				group: [
					{ stellar_address: authenticated, is_primary: true, account_id: "local" },
				],
			}
		}
		const client = await p.connect()
		try {
			await client.query("BEGIN")
			const taken = await client.query(
				"SELECT 1 FROM linked_wallets WHERE stellar_address = $1",
				[toLink],
			)
			if (taken.rowCount && taken.rowCount > 0) {
				await client.query("ROLLBACK")
				return { group: [], error: "This address is already linked to an account" }
			}
			const ex = await client.query<{ account_id: string }>(
				"SELECT account_id::text as account_id FROM linked_wallets WHERE stellar_address = $1",
				[authenticated],
			)
			let accountId: string
			if (ex.rowCount === 0) {
				accountId = randomUUID()
				await client.query(
					`INSERT INTO linked_wallets (account_id, stellar_address, is_primary)
           VALUES ($1::uuid, $2, true)`,
					[accountId, authenticated],
				)
			} else {
				accountId = ex.rows[0].account_id
			}
			await client.query(
				`INSERT INTO linked_wallets (account_id, stellar_address, is_primary)
         VALUES ($1::uuid, $2, false)`,
				[accountId, toLink],
			)
			await client.query("COMMIT")
			return { group: await this.listByAccountId(accountId) }
		} catch (e) {
			await client.query("ROLLBACK").catch(() => undefined)
			const message = e instanceof Error ? e.message : "Link failed"
			return { group: [], error: message }
		} finally {
			client.release()
		}
	},

	async setPrimary(authenticated: string, primary: string) {
		if (!isValidStellarPublicKey(authenticated) || !isValidStellarPublicKey(primary)) {
			return { error: "Invalid Stellar public key" as const }
		}
		const p = getPgPool()
		if (!p) {
			return { error: "Database unavailable" as const }
		}
		const group = await this.getGroupForStellar(authenticated)
		if (!group) {
			return { error: "No wallet group" as const }
		}
		const member = group.find((g) => g.stellar_address === primary)
		if (!member) {
			return { error: "Address is not in this linked set" as const }
		}
		const accountId = group[0].account_id
		const client = await p.connect()
		try {
			await client.query("BEGIN")
			await client.query(
				"UPDATE linked_wallets SET is_primary = false WHERE account_id = $1::uuid",
				[accountId],
			)
			await client.query(
				"UPDATE linked_wallets SET is_primary = true WHERE account_id = $1::uuid AND stellar_address = $2",
				[accountId, primary],
			)
			await client.query("COMMIT")
			return { group: await this.listByAccountId(accountId) }
		} catch (e) {
			await client.query("ROLLBACK").catch(() => undefined)
			const message = e instanceof Error ? e.message : "Update failed"
			return { error: message }
		} finally {
			client.release()
		}
	},
}
