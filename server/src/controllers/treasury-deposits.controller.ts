import { StrKey } from "@stellar/stellar-sdk"
import { type Request, type Response } from "express"
import { z } from "zod"
import { pool } from "../db"
import { logger } from "../lib/logger"
import { verifyDepositTx } from "../services/horizon-verify.service"
import { stellarContractService } from "../services/stellar-contract.service"

const log = logger.child({ module: "treasury-deposits" })

const USDC_DECIMALS = 7
const STROOPS_PER_UNIT = 10_000_000n

function parsePositiveInt(value: unknown, fallback: number): number {
	if (typeof value !== "string") return fallback
	const parsed = Number.parseInt(value, 10)
	if (Number.isNaN(parsed) || parsed < 0) return fallback
	return parsed
}

/**
 * Validates USDC amount has at most 7 decimal places and converts to atomic units.
 * Returns bigint atomic units or throws on invalid input.
 */
function usdcToAtomic(amount: number): bigint {
	const amountStr = amount.toString()
	const dotIndex = amountStr.indexOf(".")
	const decimals = dotIndex === -1 ? 0 : amountStr.length - dotIndex - 1

	if (decimals > USDC_DECIMALS) {
		throw new Error(`Amount has more than ${USDC_DECIMALS} decimal places`)
	}

	// Convert to string with exact 7 decimals to avoid float precision issues
	const fixedStr = amount.toFixed(USDC_DECIMALS)
	const [whole, frac] = fixedStr.split(".")
	const wholeBig = BigInt(whole || "0")
	const fracBig = BigInt(frac || "0")

	return wholeBig * STROOPS_PER_UNIT + fracBig
}

/**
 * Converts atomic units to USDC decimal string with exactly 7 decimals.
 */
function atomicToUsdc(atomic: bigint): string {
	const whole = atomic / STROOPS_PER_UNIT
	const frac = atomic % STROOPS_PER_UNIT
	return `${whole}.${frac.toString().padStart(USDC_DECIMALS, "0")}`
}

/**
 * POST /api/treasury/deposit
 * Validates and records a donor deposit after on-chain verification.
 */
const DepositBodySchema = z.object({
	donor_address: z
		.string()
		.refine((val) => StrKey.isValidEd25519PublicKey(val), {
			message: "Invalid Stellar address",
		}),
	amount: z.number().positive().max(1_000_000_000),
	tx_hash: z.string().regex(/^[a-f0-9]{64}$/i, "Invalid transaction hash"),
})

export const createDeposit = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const parseResult = DepositBodySchema.safeParse(req.body)
	if (!parseResult.success) {
		res.status(422).json({
			error: {
				code: "VALIDATION_ERROR",
				message: "Invalid input",
				details: parseResult.error.flatten(),
			},
		})
		return
	}

	const { donor_address, amount, tx_hash } = parseResult.data

	try {
		// Validate decimal precision
		const amountAtomic = usdcToAtomic(amount)

		// 1. Check for duplicate tx_hash
		const duplicateCheck = await pool.query(
			"SELECT id FROM treasury_deposits WHERE tx_hash = $1",
			[tx_hash],
		)
		if (duplicateCheck.rowCount && duplicateCheck.rowCount > 0) {
			res.status(409).json({
				error: {
					code: "DUPLICATE_DEPOSIT",
					message: "This transaction has already been recorded",
				},
			})
			return
		}

		// 2. Verify on-chain
		const isValid = await verifyDepositTx(tx_hash, amount, donor_address)
		if (!isValid) {
			res.status(400).json({
				error: {
					code: "VERIFICATION_FAILED",
					message:
						"Transaction does not match expected deposit parameters on-chain",
				},
			})
			return
		}

		// 3. Calculate GOV issued: atomic * 100, preserving exact precision
		const govIssuedAtomic = amountAtomic * 100n
		const amountUsdcStr = atomicToUsdc(amountAtomic)
		const govIssuedStr = atomicToUsdc(govIssuedAtomic)

		// 4. Insert record with UNIQUE constraint race protection
		try {
			const insertResult = await pool.query(
				`INSERT INTO treasury_deposits (donor_address, amount_usdc, gov_issued, tx_hash)
				 VALUES ($1, $2::numeric, $3::numeric, $4)
				 RETURNING id, donor_address, amount_usdc, gov_issued, tx_hash, created_at`,
				[donor_address, amountUsdcStr, govIssuedStr, tx_hash],
			)

			const deposit = insertResult.rows[0]

			// 5. Get updated GOV balance
			const govBalance =
				await stellarContractService.getGovernanceTokenBalance(donor_address)

			res.status(201).json({
				deposit: {
					id: deposit.id,
					donor_address: deposit.donor_address,
					amount_usdc: deposit.amount_usdc,
					gov_issued: deposit.gov_issued,
					tx_hash: deposit.tx_hash,
					deposited_at: deposit.created_at.toISOString(),
				},
				gov_balance: govBalance,
			})
		} catch (insertErr) {
			// Catch UNIQUE constraint violation race condition
			if (
				insertErr instanceof Error &&
				"code" in insertErr &&
				insertErr.code === "23505"
			) {
				res.status(409).json({
					error: {
						code: "DUPLICATE_DEPOSIT",
						message: "This transaction has already been recorded",
					},
				})
				return
			}
			throw insertErr
		}
	} catch (err) {
		if (err instanceof Error && err.message.includes("decimal places")) {
			res.status(422).json({
				error: {
					code: "VALIDATION_ERROR",
					message: err.message,
				},
			})
			return
		}
		log.error({ err, donor_address, tx_hash }, "Failed to create deposit")
		res.status(500).json({
			error: "Failed to record deposit",
		})
	}
}

/**
 * GET /api/treasury/deposits/:address
 * Returns deposit history for a specific donor address.
 */
export const getDepositsForAddress = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const { address } = req.params

	if (!StrKey.isValidEd25519PublicKey(address)) {
		res.status(422).json({
			error: {
				code: "INVALID_ADDRESS",
				message: "Invalid Stellar address",
			},
		})
		return
	}

	const limit = Math.max(
		1,
		Math.min(parsePositiveInt(req.query.limit, 20), 100),
	)
	const page = parsePositiveInt(req.query.page, 1)
	const offset = (page - 1) * limit

	try {
		const result = await pool.query(
			`SELECT id, donor_address, amount_usdc, gov_issued, tx_hash, created_at
			 FROM treasury_deposits
			 WHERE donor_address = $1
			 ORDER BY created_at DESC
			 LIMIT $2 OFFSET $3`,
			[address, limit, offset],
		)

		const countResult = await pool.query(
			"SELECT COUNT(*) as total FROM treasury_deposits WHERE donor_address = $1",
			[address],
		)

		const total = Number.parseInt(countResult.rows[0]?.total ?? "0", 10)

		res.status(200).json({
			data: result.rows.map((row) => ({
				id: row.id,
				donor_address: row.donor_address,
				amount_usdc: row.amount_usdc,
				gov_issued: row.gov_issued,
				tx_hash: row.tx_hash,
				deposited_at: row.created_at.toISOString(),
			})),
			pagination: { page, limit, total },
		})
	} catch (err) {
		log.error({ err, address }, "Failed to fetch deposits")
		res.status(500).json({
			error: "Failed to fetch deposit history",
		})
	}
}
