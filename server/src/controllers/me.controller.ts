import { type Request, type Response } from "express"

import { pool } from "../db/index"
import * as linkedWalletsStore from "../db/linked-wallets-store"
import { type AuthService } from "../services/auth.service"

type CredentialRow = {
	token_id: string | number
	course_id: string
	metadata_uri: string | null
	minted_at: Date
	revoked: boolean
	scholar_address: string
}

async function loadClusterMembers(jwtAddress: string): Promise<{
	linkedWallets: Array<{ address: string; isPrimary: boolean }>
	primaryAddress: string
	addresses: string[]
}> {
	const clusterId = await linkedWalletsStore.findClusterIdForWallet(jwtAddress)
	if (!clusterId) {
		return {
			linkedWallets: [{ address: jwtAddress, isPrimary: true }],
			primaryAddress: jwtAddress,
			addresses: [jwtAddress],
		}
	}

	const rows = await linkedWalletsStore.listClusterWallets(clusterId)
	const linkedWallets = rows.map((r) => ({
		address: r.wallet_address,
		isPrimary: r.is_primary,
	}))
	const primaryRow = rows.find((r) => r.is_primary)
	const primaryAddress = primaryRow?.wallet_address ?? jwtAddress
	const addresses = rows.map((r) => r.wallet_address)
	return { linkedWallets, primaryAddress, addresses }
}

async function loadAggregates(addresses: string[]): Promise<{
	lrnBalance: string
	coursesCompleted: number
	nftCount: number
	credentials: Array<{
		token_id: number
		course_id: string
		metadata_uri: string | null
		minted_at: string
		revoked: boolean
		scholar_address: string
	}>
}> {
	if (addresses.length === 0) {
		return {
			lrnBalance: "0",
			coursesCompleted: 0,
			nftCount: 0,
			credentials: [],
		}
	}

	const bal = await pool.query<{ lrnsum: string; courses: string }>(
		`SELECT COALESCE(SUM(lrn_balance), 0)::text AS lrnsum,
            COALESCE(SUM(courses_completed), 0)::text AS courses
       FROM scholar_balances
      WHERE address = ANY($1::text[])`,
		[addresses],
	)
	const lrnsum = bal.rows[0]?.lrnsum ?? "0"
	const coursesCompleted = Number(bal.rows[0]?.courses ?? 0)

	const nftRes = await pool.query<CredentialRow>(
		`SELECT token_id, course_id, metadata_uri, minted_at, revoked, scholar_address
       FROM scholar_nfts
      WHERE scholar_address = ANY($1::text[])
      ORDER BY minted_at DESC`,
		[addresses],
	)

	const credentials = nftRes.rows.map((row) => ({
		token_id: Number(row.token_id),
		course_id: row.course_id,
		metadata_uri: row.metadata_uri,
		minted_at: row.minted_at.toISOString(),
		revoked: row.revoked,
		scholar_address: row.scholar_address,
	}))

	return {
		lrnBalance: lrnsum,
		coursesCompleted,
		nftCount: credentials.length,
		credentials,
	}
}

export async function getMe(req: Request, res: Response): Promise<void> {
	const address = req.walletAddress
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	try {
		const { linkedWallets, primaryAddress, addresses } =
			await loadClusterMembers(address)
		const aggregated = await loadAggregates(addresses)

		res.status(200).json({
			address,
			primaryAddress,
			linkedWallets,
			aggregated: {
				lrnBalance: aggregated.lrnBalance,
				coursesCompleted: aggregated.coursesCompleted,
				nftCount: aggregated.nftCount,
			},
			credentials: aggregated.credentials,
		})
	} catch (err) {
		console.error("[me] getMe failed:", err)
		res.status(500).json({ error: "Failed to load profile" })
	}
}

export function createMeWalletHandlers(authService: AuthService) {
	return {
		async postLinkWallet(req: Request, res: Response): Promise<void> {
			const jwtAddress = req.walletAddress
			if (!jwtAddress) {
				res.status(401).json({ error: "Unauthorized" })
				return
			}

			const { address: newAddress, signature } = req.body as {
				address: string
				signature: string
			}

			try {
				await authService.verifyNonceSignature(newAddress, signature)
				await linkedWalletsStore.linkWalletToCluster(jwtAddress, newAddress)
				res.status(201).json({ ok: true, linkedAddress: newAddress })
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Bad request"
				if (msg === "WALLET_ALREADY_LINKED") {
					res
						.status(409)
						.json({ error: "Wallet is already linked to another account" })
					return
				}
				if (msg === "ALREADY_IN_CLUSTER") {
					res
						.status(409)
						.json({ error: "Wallet is already linked to this account" })
					return
				}
				if (msg === "Cannot link wallet to itself") {
					res.status(400).json({ error: msg })
					return
				}
				if (
					msg.includes("Nonce") ||
					msg.includes("signature") ||
					msg.includes("Invalid")
				) {
					res.status(400).json({ error: msg })
					return
				}
				console.error("[me] link wallet:", err)
				res.status(500).json({ error: "Failed to link wallet" })
			}
		},

		async postSetPrimaryWallet(req: Request, res: Response): Promise<void> {
			const jwtAddress = req.walletAddress
			if (!jwtAddress) {
				res.status(401).json({ error: "Unauthorized" })
				return
			}

			const { address: primaryAddress } = req.body as { address: string }

			try {
				const clusterId =
					await linkedWalletsStore.findClusterIdForWallet(jwtAddress)
				if (!clusterId) {
					if (primaryAddress === jwtAddress) {
						res.status(200).json({ ok: true, primaryAddress })
						return
					}
					res.status(400).json({
						error:
							"Link an additional wallet before choosing a different primary",
					})
					return
				}

				await linkedWalletsStore.setPrimaryWallet(jwtAddress, primaryAddress)
				res.status(200).json({ ok: true, primaryAddress })
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Bad request"
				if (msg === "NO_CLUSTER" || msg === "NOT_IN_CLUSTER") {
					res
						.status(400)
						.json({ error: "Invalid primary wallet for this account" })
					return
				}
				console.error("[me] set primary:", err)
				res.status(500).json({ error: "Failed to update primary wallet" })
			}
		},
	}
}
