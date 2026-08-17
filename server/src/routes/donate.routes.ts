/**
 * Multi-asset donation routes.
 *
 * Provides path discovery, trustline preflight, and transaction building
 * for donations via Stellar path payments.  The treasury always receives
 * USDC while donors can pay in XLM, EURC, or any asset with DEX liquidity.
 */

import { Router } from "express"

import {
	getDonateAssets,
	getDonatePaths,
	getDonateTrustline,
	postDonateBuild,
} from "../controllers/donate.controller"

export const donateRouter = Router()

/**
 * @openapi
 * /api/donate/assets:
 *   get:
 *     tags: [Donate]
 *     summary: List available source assets
 *     description: Returns the list of assets donors can use for multi-asset donations
 *     responses:
 *       200:
 *         description: Available assets list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 assets:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       code:
 *                         type: string
 *                         example: XLM
 *                       name:
 *                         type: string
 *                         example: Stellar Lumens
 *                       native:
 *                         type: boolean
 *                       env_configured:
 *                         type: boolean
 */
donateRouter.get("/donate/assets", getDonateAssets)

/**
 * @openapi
 * /api/donate/paths:
 *   get:
 *     tags: [Donate]
 *     summary: Discover payment paths
 *     description: Find viable payment paths from a source asset to USDC via Stellar DEX/AMM
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *         description: Source asset code (e.g. XLM, EURC)
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: string
 *         description: Destination amount in USDC
 *     responses:
 *       200:
 *         description: Available payment paths with estimated rates
 *       400:
 *         description: Invalid query parameters
 *       503:
 *         description: USDC contract not configured
 */
donateRouter.get("/donate/paths", getDonatePaths)

/**
 * @openapi
 * /api/donate/trustline:
 *   get:
 *     tags: [Donate]
 *     summary: Check trustline preflight
 *     description: Check if donor and treasury have required trustlines for the donation
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Stellar account address to check
 *       - in: query
 *         name: asset
 *         required: true
 *         schema:
 *           type: string
 *         description: Asset code to check trustline for
 *     responses:
 *       200:
 *         description: Trustline status for donor and treasury
 *       400:
 *         description: Invalid query parameters
 */
donateRouter.get("/donate/trustline", getDonateTrustline)

/**
 * @openapi
 * /api/donate/build:
 *   post:
 *     tags: [Donate]
 *     summary: Build donation transaction
 *     description: Constructs a path_payment_strict_receive XDR for the donor to sign
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [donor, treasury, source_asset, dest_amount]
 *             properties:
 *               donor:
 *                 type: string
 *                 description: Donor's Stellar public key
 *               treasury:
 *                 type: string
 *                 description: Treasury's Stellar public key
 *               source_asset:
 *                 type: string
 *                 description: Source asset code (e.g. XLM, EURC)
 *               dest_amount:
 *                 type: string
 *                 description: Exact USDC amount the treasury should receive
 *               slippage_pct:
 *                 type: number
 *                 default: 0.5
 *                 description: Slippage tolerance in percent (0-50)
 *               path:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     asset_code:
 *                       type: string
 *                     asset_issuer:
 *                       type: string
 *                 description: Payment path from a previous /paths call
 *     responses:
 *       200:
 *         description: Transaction XDR ready for signing
 *       400:
 *         description: Invalid build parameters
 *       503:
 *         description: USDC contract not configured
 */
donateRouter.post("/donate/build", postDonateBuild)
