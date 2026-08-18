import { type Request, type Response } from "express"

import { logger } from "../lib/logger"
import { type AuthRequest } from "../middleware/auth.middleware"
import {
	AnchorNotAllowlistedError,
	getAnchorAuthChallenge,
	getFirmQuote,
	getIndicativePrice,
	initiateWithdrawal,
	isQuoteExpired,
	listAnchorsForCountry,
	listWithdrawalsForLearner,
	reconcileWithdrawal,
	submitAnchorAuth,
} from "../services/anchor.service"
import { anchorWithdrawalStore } from "../db/anchor-withdrawal-store"

const log = logger.child({ module: "anchors" })

function errorStatus(err: unknown): number {
	if (err instanceof AnchorNotAllowlistedError) return 404
	const message = err instanceof Error ? err.message : ""
	if (message.includes("is required") || message.includes("Missing")) return 400
	if (message.includes("does not advertise")) return 502
	return 500
}

function bearerToken(req: Request): string | undefined {
	const header = req.headers.authorization
	if (!header?.startsWith("Bearer ")) return undefined
	return header.slice("Bearer ".length).trim() || undefined
}

export async function listAnchors(req: Request, res: Response): Promise<void> {
	const country =
		typeof req.query.country === "string" ? req.query.country : undefined

	try {
		const anchors = await listAnchorsForCountry(country)
		res.status(200).json({ anchors })
	} catch (err) {
		log.error({ err, country }, "Failed to list anchors")
		res.status(500).json({ error: "Failed to list anchors" })
	}
}

export async function getAuthChallenge(req: Request, res: Response): Promise<void> {
	const { domain } = req.params
	const account = typeof req.query.account === "string" ? req.query.account : ""
	if (!account) {
		res.status(400).json({ error: "account query parameter is required" })
		return
	}

	try {
		const challenge = await getAnchorAuthChallenge(domain, account)
		res.status(200).json(challenge)
	} catch (err) {
		log.error({ err, domain }, "Failed to fetch anchor auth challenge")
		const message = err instanceof Error ? err.message : "Internal server error"
		res.status(errorStatus(err)).json({ error: message })
	}
}

export async function submitAuth(req: Request, res: Response): Promise<void> {
	const { domain } = req.params
	const body = (req.body ?? {}) as { signedTransactionXdr?: unknown }
	if (
		!body.signedTransactionXdr ||
		typeof body.signedTransactionXdr !== "string"
	) {
		res.status(400).json({ error: "signedTransactionXdr is required" })
		return
	}

	try {
		const result = await submitAnchorAuth(domain, body.signedTransactionXdr)
		res.status(200).json(result)
	} catch (err) {
		log.error({ err, domain }, "Failed to submit anchor auth")
		const message = err instanceof Error ? err.message : "Internal server error"
		res.status(errorStatus(err)).json({ error: message })
	}
}

export async function getQuote(req: Request, res: Response): Promise<void> {
	const { domain } = req.params
	const sell = typeof req.query.sell === "string" ? req.query.sell : ""
	const buy = typeof req.query.buy === "string" ? req.query.buy : ""
	const amount = typeof req.query.amount === "string" ? req.query.amount : ""

	if (!sell || !buy || !amount) {
		res
			.status(400)
			.json({ error: "sell, buy, and amount query parameters are required" })
		return
	}

	const anchorToken = bearerToken(req)

	try {
		if (anchorToken) {
			const quote = await getFirmQuote(
				domain,
				{ sellAsset: sell, buyAsset: buy, sellAmount: amount },
				anchorToken,
			)
			res.status(200).json({ firm: true, expired: isQuoteExpired(quote), ...quote })
			return
		}

		const price = await getIndicativePrice(domain, {
			sellAsset: sell,
			buyAsset: buy,
			sellAmount: amount,
		})
		res.status(200).json({ firm: false, ...price })
	} catch (err) {
		log.error({ err, domain }, "Failed to fetch anchor quote")
		const message = err instanceof Error ? err.message : "Internal server error"
		res.status(errorStatus(err)).json({ error: message })
	}
}

export async function withdraw(req: AuthRequest, res: Response): Promise<void> {
	const { domain } = req.params
	const learnerAddr = req.walletAddress
	if (!learnerAddr) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const body = (req.body ?? {}) as {
		assetCode?: unknown
		assetOut?: unknown
		amount?: unknown
		quoteId?: unknown
		anchorToken?: unknown
	}

	if (typeof body.assetCode !== "string" || !body.assetCode) {
		res.status(400).json({ error: "assetCode is required" })
		return
	}
	if (typeof body.assetOut !== "string" || !body.assetOut) {
		res.status(400).json({ error: "assetOut is required" })
		return
	}
	if (typeof body.amount !== "string" || !body.amount) {
		res.status(400).json({ error: "amount is required" })
		return
	}
	if (typeof body.anchorToken !== "string" || !body.anchorToken) {
		res.status(400).json({ error: "anchorToken is required" })
		return
	}
	if (body.quoteId !== undefined && typeof body.quoteId !== "string") {
		res.status(400).json({ error: "quoteId must be a string" })
		return
	}

	try {
		const result = await initiateWithdrawal(domain, {
			learnerAddr,
			assetCode: body.assetCode,
			assetOut: body.assetOut,
			amount: body.amount,
			quoteId: body.quoteId,
			anchorToken: body.anchorToken,
		})
		res.status(201).json(result)
	} catch (err) {
		log.error({ err, domain, learnerAddr }, "Failed to initiate anchor withdrawal")
		const message = err instanceof Error ? err.message : "Internal server error"
		res.status(errorStatus(err)).json({ error: message })
	}
}

export async function reconcile(req: AuthRequest, res: Response): Promise<void> {
	const { domain, transactionId } = req.params
	const learnerAddr = req.walletAddress
	if (!learnerAddr) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const body = (req.body ?? {}) as { anchorToken?: unknown }
	if (typeof body.anchorToken !== "string" || !body.anchorToken) {
		res.status(400).json({ error: "anchorToken is required" })
		return
	}

	try {
		// Ownership check: a learner may only reconcile their own withdrawal row.
		const existing = await anchorWithdrawalStore.listWithdrawalsForLearner(
			learnerAddr,
		)
		const owns = existing.some(
			(w) => w.anchor_domain === domain && w.transaction_id === transactionId,
		)
		if (!owns) {
			res.status(404).json({ error: "Withdrawal not found" })
			return
		}

		const updated = await reconcileWithdrawal(
			domain,
			transactionId,
			body.anchorToken,
		)
		res.status(200).json({ withdrawal: updated })
	} catch (err) {
		log.error(
			{ err, domain, transactionId, learnerAddr },
			"Failed to reconcile anchor withdrawal",
		)
		const message = err instanceof Error ? err.message : "Internal server error"
		res.status(errorStatus(err)).json({ error: message })
	}
}

export async function listWithdrawals(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const learnerAddr = req.walletAddress
	if (!learnerAddr) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	try {
		const withdrawals = await listWithdrawalsForLearner(learnerAddr)
		res.status(200).json({ withdrawals })
	} catch (err) {
		log.error({ err, learnerAddr }, "Failed to list anchor withdrawals")
		res.status(500).json({ error: "Failed to list withdrawals" })
	}
}
