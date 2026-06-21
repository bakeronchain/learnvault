import { type Request, type Response } from "express"

import { type AuthRequest } from "../middleware/auth.middleware"
import { tokenEventsEmitter } from "../lib/token-events-emitter"
import {
	burnLearnToken,
	mapBurnError,
} from "../services/learn-token.service"
import { lrnBurnStore } from "../services/lrn-burn-store.service"

function parseAtomicAmount(raw: unknown): bigint | null {
	if (typeof raw === "bigint") return raw > 0n ? raw : null
	if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
		return BigInt(Math.trunc(raw))
	}
	if (typeof raw === "string" && raw.trim().length > 0) {
		try {
			const value = BigInt(raw.trim())
			return value > 0n ? value : null
		} catch {
			return null
		}
	}
	return null
}

/**
 * POST /api/lrn/burn — burn LRN on-chain and persist the record.
 */
export async function postBurnLrn(req: Request, res: Response): Promise<void> {
	const address = (req as AuthRequest).user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const amountAtomic = parseAtomicAmount(
		(req.body as { amount?: unknown })?.amount,
	)
	if (amountAtomic === null) {
		res.status(400).json({ error: "Invalid burn amount" })
		return
	}

	const signedTransaction =
		typeof (req.body as { signed_transaction?: unknown })
			?.signed_transaction === "string"
			? (req.body as { signed_transaction: string }).signed_transaction.trim()
			: undefined

	try {
		const { txHash } = await burnLearnToken({
			holderAddress: address,
			amountAtomic,
			signedTransactionXdr: signedTransaction,
		})

		const record = await lrnBurnStore.insertLrnBurn({
			walletAddress: address,
			amountAtomic,
			txHash,
		})

		tokenEventsEmitter.emitTokenBurned({
			walletAddress: address,
			amount: amountAtomic.toString(),
			txHash,
			timestamp: record.burnedAt,
		})

		res.status(201).json({
			tx_hash: txHash,
			amount: amountAtomic.toString(),
			burned_at: record.burnedAt,
		})
	} catch (err) {
		const mapped = mapBurnError(err)
		res.status(mapped.status).json({ error: mapped.message })
	}
}

/**
 * GET /api/lrn/burn/history — list burns for the authenticated wallet.
 */
export async function getLrnBurnHistory(
	req: Request,
	res: Response,
): Promise<void> {
	const address = (req as AuthRequest).user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	try {
		const burns = await lrnBurnStore.listLrnBurnsByWallet(address)
		const totalBurned = burns.reduce(
			(sum, row) => sum + BigInt(row.amount),
			0n,
		)

		res.json({
			wallet_address: address,
			total_burned: totalBurned.toString(),
			burns,
			count: burns.length,
		})
	} catch {
		res.status(500).json({ error: "Failed to retrieve burn history" })
	}
}

// Legacy governance burn endpoints — delegate to shared implementation.
export async function burnLRNForGovernance(
	req: Request,
	res: Response,
): Promise<void> {
	const body = req.body as {
		amount?: unknown
		reason?: string
		signed_transaction?: string
	}
	if (
		body.reason &&
		!["governance_vote", "proposal_creation", "delegation"].includes(
			body.reason,
		)
	) {
		res.status(400).json({ error: "Invalid burn reason" })
		return
	}
	await postBurnLrn(req, res)
}

export async function getBurnHistory(
	req: Request,
	res: Response,
): Promise<void> {
	await getLrnBurnHistory(req, res)
}

export async function getGovernanceIncentives(
	req: Request,
	res: Response,
): Promise<void> {
	const address = (req as AuthRequest).user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	try {
		const burns = await lrnBurnStore.listLrnBurnsByWallet(address)
		const totalBurned = burns.reduce(
			(sum, row) => sum + BigInt(row.amount),
			0n,
		)
		const totalBurnedNumber = Number(totalBurned / 10_000_000n)

		const votingPower = totalBurnedNumber * 1.5
		const proposalWeight = Math.min(votingPower / 100, 10)
		const delegationBonus = totalBurnedNumber > 1000 ? 0.25 : 0.1

		res.json({
			wallet_address: address,
			total_burned: totalBurned.toString(),
			votingPower,
			proposalWeight,
			delegationBonus,
			incentiveLevel:
				totalBurnedNumber > 5000
					? "platinum"
					: totalBurnedNumber > 1000
						? "gold"
						: "silver",
		})
	} catch {
		res.status(500).json({ error: "Failed to calculate incentives" })
	}
}
