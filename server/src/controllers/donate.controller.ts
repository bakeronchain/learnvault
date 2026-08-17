/**
 * Multi-asset donation controllers.
 *
 * Endpoints:
 *   GET  /api/donate/assets         — list available source assets
 *   GET  /api/donate/paths          — discover payment paths
 *   GET  /api/donate/trustline      — check trustline preflight
 *   POST /api/donate/build          — build path_payment XDR
 */

import { type Request, type Response } from "express"
import { z } from "zod"

import { logger, maskAddress } from "../lib/logger"
import {
	buildDonateTransaction,
	checkTrustline,
	discoverPaths,
	getAvailableAssets,
} from "../services/donate.service"

const log = logger.child({ module: "donate-controller" })

const USDC_CONTRACT_ID = process.env.USDC_CONTRACT_ID ?? ""
const SCHOLARSHIP_TREASURY_CONTRACT_ID =
	process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID ?? ""

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const pathsQuerySchema = z.object({
	from: z.string().min(1, "Source asset code is required"),
	amount: z.string().regex(/^\d+(\.\d+)?$/, "Amount must be a positive number"),
})

const trustlineQuerySchema = z.object({
	address: z.string().min(1, "Account address is required"),
	asset: z.string().min(1, "Asset code is required"),
})

const buildBodySchema = z.object({
	donor: z.string().min(1, "Donor address is required"),
	treasury: z.string().min(1, "Treasury address is required"),
	source_asset: z.string().min(1, "Source asset code is required"),
	dest_amount: z
		.string()
		.regex(/^\d+(\.\d+)?$/, "Destination amount must be a positive number"),
	slippage_pct: z.number().min(0).max(50).optional().default(0.5),
	path: z
		.array(
			z.object({
				asset_code: z.string(),
				asset_issuer: z.string().optional(),
			}),
		)
		.optional(),
})

// ---------------------------------------------------------------------------
// GET /api/donate/assets
// ---------------------------------------------------------------------------

export async function getDonateAssets(
	_req: Request,
	res: Response,
): Promise<void> {
	try {
		const assets = getAvailableAssets()
		res.status(200).json({ assets })
	} catch (err) {
		log.error({ err }, "Failed to list donate assets")
		res.status(500).json({ error: "Failed to list available assets" })
	}
}

// ---------------------------------------------------------------------------
// GET /api/donate/paths
// ---------------------------------------------------------------------------

export async function getDonatePaths(
	req: Request,
	res: Response,
): Promise<void> {
	const parsed = pathsQuerySchema.safeParse(req.query)
	if (!parsed.success) {
		res.status(400).json({
			error: "Invalid query parameters",
			details: parsed.error.flatten().fieldErrors,
		})
		return
	}

	const { from, amount } = parsed.data

	if (!USDC_CONTRACT_ID) {
		res.status(503).json({ error: "USDC_CONTRACT_ID not configured" })
		return
	}

	try {
		const result = await discoverPaths(from, amount)
		res.status(200).json(result)
	} catch (err) {
		log.error({ err, from, amount }, "Path discovery failed")
		res.status(500).json({ error: "Failed to discover payment paths" })
	}
}

// ---------------------------------------------------------------------------
// GET /api/donate/trustline
// ---------------------------------------------------------------------------

export async function getDonateTrustline(
	req: Request,
	res: Response,
): Promise<void> {
	const parsed = trustlineQuerySchema.safeParse(req.query)
	if (!parsed.success) {
		res.status(400).json({
			error: "Invalid query parameters",
			details: parsed.error.flatten().fieldErrors,
		})
		return
	}

	const { address, asset } = parsed.data

	try {
		const status = await checkTrustline(address, asset)

		// Also check treasury trustline for USDC
		const treasuryStatus = await checkTrustline(
			SCHOLARSHIP_TREASURY_CONTRACT_ID || address, // fallback for test
			"USDC",
		)

		res.status(200).json({
			donor: status,
			treasury: treasuryStatus,
		})
	} catch (err) {
		log.error(
			{ err, address: maskAddress(address), asset },
			"Trustline check failed",
		)
		res.status(500).json({ error: "Failed to check trustline status" })
	}
}

// ---------------------------------------------------------------------------
// POST /api/donate/build
// ---------------------------------------------------------------------------

export async function postDonateBuild(
	req: Request,
	res: Response,
): Promise<void> {
	const parsed = buildBodySchema.safeParse(req.body)
	if (!parsed.success) {
		res.status(400).json({
			error: "Invalid build parameters",
			details: parsed.error.flatten().fieldErrors,
		})
		return
	}

	const params = parsed.data

	if (!USDC_CONTRACT_ID) {
		res.status(503).json({ error: "USDC_CONTRACT_ID not configured" })
		return
	}

	try {
		const result = await buildDonateTransaction(params)
		res.status(200).json(result)
	} catch (err) {
		log.error(
			{
				err,
				donor: maskAddress(params.donor),
				source_asset: params.source_asset,
			},
			"Transaction build failed",
		)
		res.status(500).json({ error: "Failed to build donation transaction" })
	}
}
