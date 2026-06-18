import { StrKey } from "@stellar/stellar-sdk"
import { type Request, type Response } from "express"
import { type Pool } from "pg"
import { z } from "zod"
import { SponsorLicenseStore } from "../db/sponsor-license-store"

const BulkLicenseCheckoutSchema = z.object({
	wallet_address: z.string().min(1, "Sponsor wallet address required"),
	recipients: z
		.array(
			z.object({
				wallet_address: z.string().min(1, "Recipient wallet address required"),
				amount_usdc: z.number().positive("Amount must be positive"),
				metadata: z.record(z.unknown()).optional(),
			}),
		)
		.min(1, "At least one recipient required")
		.max(100, "Maximum 100 recipients per batch"),
	license_type: z.string().optional().default("course_access"),
})

export class SponsorLicenseCheckoutController {
	private store: SponsorLicenseStore

	constructor(private pool: Pool) {
		this.store = new SponsorLicenseStore(pool)
	}

	/**
	 * POST /api/sponsors/license-checkout
	 * Create bulk license grants for multiple recipients
	 */
	create = async (req: Request, res: Response): Promise<void> => {
		try {
			const body = BulkLicenseCheckoutSchema.parse(req.body)

			// Validate all wallet addresses are valid Stellar addresses
			const invalidAddresses: string[] = []

			if (!this.isValidStellarAddress(body.wallet_address)) {
				invalidAddresses.push(body.wallet_address)
			}

			for (const recipient of body.recipients) {
				if (!this.isValidStellarAddress(recipient.wallet_address)) {
					invalidAddresses.push(recipient.wallet_address)
				}
			}

			if (invalidAddresses.length > 0) {
				res.status(400).json({
					error: "Invalid Stellar wallet addresses",
					invalid_addresses: invalidAddresses,
				})
				return
			}

			// Get or create sponsor organization
			const orgResult = await this.pool.query(
				`SELECT id FROM sponsor_organizations WHERE LOWER(wallet_address) = LOWER($1)`,
				[body.wallet_address],
			)

			let organizationId: number

			if (orgResult.rows.length === 0) {
				// Auto-create organization if it doesn't exist
				const insertResult = await this.pool.query(
					`INSERT INTO sponsor_organizations (wallet_address, name)
           VALUES ($1, $2)
           RETURNING id`,
					[
						body.wallet_address,
						`Organization ${body.wallet_address.slice(0, 8)}`,
					],
				)
				organizationId = insertResult.rows[0]?.id as number
			} else {
				organizationId = orgResult.rows[0]?.id as number
			}

			// Create license grants
			const grants = body.recipients.map((recipient) => ({
				organization_id: organizationId,
				recipient_wallet_address: recipient.wallet_address,
				license_type: body.license_type,
				amount_usdc: recipient.amount_usdc,
				metadata: recipient.metadata || {},
			}))

			const createdGrants = await this.store.createBulkGrants(grants)

			// Calculate total
			const totalAmount = body.recipients.reduce(
				(sum, r) => sum + r.amount_usdc,
				0,
			)

			// In a real implementation, we would:
			// 1. Queue these grants for on-chain minting via a worker
			// 2. Return immediately with pending status
			// 3. Let the worker update status to 'minted' once tx confirms
			//
			// For now, we'll mark them as pending and generate a placeholder tx hash
			// that will be replaced by the actual tx hash once minted

			res.status(201).json({
				success: true,
				grants: createdGrants,
				summary: {
					total_recipients: body.recipients.length,
					total_amount_usdc: totalAmount.toFixed(2),
					organization_id: organizationId,
					status: "pending",
					message:
						"License grants created successfully. Minting will be processed shortly.",
				},
			})
		} catch (error) {
			if (error instanceof z.ZodError) {
				res.status(400).json({
					error: "Validation failed",
					details: error.errors,
				})
				return
			}

			console.error("Error creating license grants:", error)
			res.status(500).json({
				error: "Failed to create license grants",
				message: error instanceof Error ? error.message : "Unknown error",
			})
		}
	}

	/**
	 * GET /api/sponsors/license-checkout/:walletAddress
	 * Get all license grants for a sponsor organization
	 */
	getByOrganization = async (req: Request, res: Response): Promise<void> => {
		try {
			const { walletAddress } = req.params

			if (!walletAddress) {
				res.status(400).json({ error: "Wallet address required" })
				return
			}

			// Get organization
			const orgResult = await this.pool.query(
				`SELECT id FROM sponsor_organizations WHERE LOWER(wallet_address) = LOWER($1)`,
				[walletAddress],
			)

			if (orgResult.rows.length === 0) {
				res.status(404).json({ error: "Organization not found" })
				return
			}

			const organizationId = orgResult.rows[0]?.id as number
			const grants = await this.store.getGrantsByOrganization(organizationId)
			const stats = await this.store.getOrganizationGrantStats(organizationId)

			res.json({
				grants,
				stats,
			})
		} catch (error) {
			console.error("Error fetching license grants:", error)
			res.status(500).json({
				error: "Failed to fetch license grants",
			})
		}
	}

	/**
	 * GET /api/sponsors/license-checkout/recipient/:walletAddress
	 * Get all license grants received by a specific wallet
	 */
	getByRecipient = async (req: Request, res: Response): Promise<void> => {
		try {
			const { walletAddress } = req.params

			if (!walletAddress) {
				res.status(400).json({ error: "Wallet address required" })
				return
			}

			const grants = await this.store.getGrantsByRecipient(walletAddress)

			res.json({
				grants,
				total_received: grants.length,
			})
		} catch (error) {
			console.error("Error fetching recipient grants:", error)
			res.status(500).json({
				error: "Failed to fetch recipient grants",
			})
		}
	}

	/**
	 * Validate if a string is a valid Stellar address
	 */
	private isValidStellarAddress(address: string): boolean {
		try {
			return StrKey.isValidEd25519PublicKey(address)
		} catch {
			return false
		}
	}
}
