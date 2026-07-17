import { Horizon } from "@stellar/stellar-sdk"

import { logger } from "../lib/logger"

const log = logger.child({ module: "qf-tx-verify" })

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet"

// When QF_VERIFY_TX is not "true", tx verification is skipped (dev / test
// convenience) and every well-formed request is accepted. Production
// deployments must set QF_VERIFY_TX=true so contributions are only recorded
// after the on-chain transfer is confirmed on Horizon.
const VERIFY_TX = process.env.QF_VERIFY_TX === "true"

// Optional destination allow-list: when set, the contribution transfer must be
// paid to the QF pool / treasury account.
const QF_POOL_ADDRESS = process.env.QF_POOL_ADDRESS ?? ""

// USDC has 7 decimals on Stellar; amounts within this tolerance are "equal".
const AMOUNT_TOLERANCE = 1e-7

export interface VerifyContributionParams {
	txHash: string
	expectedSource: string
	expectedAmount: number
}

export interface VerifyContributionResult {
	valid: boolean
	reason?: string
}

function horizonUrl(): string {
	if (process.env.HORIZON_URL) return process.env.HORIZON_URL
	return STELLAR_NETWORK === "mainnet"
		? "https://horizon.stellar.org"
		: "https://horizon-testnet.stellar.org"
}

/**
 * Confirms that a Stellar transaction hash corresponds to a successful payment
 * from the claimed donor, for at least the claimed amount, into the QF pool
 * account (when one is configured).
 *
 * The check is skipped (returns valid) unless QF_VERIFY_TX=true so local dev and
 * tests need no live network. This mirrors the "simulated" escape hatch used by
 * the on-chain contract service elsewhere in the codebase.
 */
export async function verifyContributionTx(
	params: VerifyContributionParams,
): Promise<VerifyContributionResult> {
	if (!VERIFY_TX) {
		return { valid: true }
	}

	const { txHash, expectedSource, expectedAmount } = params

	try {
		const server = new Horizon.Server(horizonUrl())

		const tx = await server.transactions().transaction(txHash).call()
		if (!tx.successful) {
			return { valid: false, reason: "Transaction was not successful" }
		}

		// Fetch the payment operations for this transaction and find one that
		// matches the claimed donor, amount and (optionally) destination.
		const payments = await server
			.payments()
			.forTransaction(txHash)
			.limit(200)
			.call()

		const match = payments.records.find((op) => {
			if (op.type !== "payment" && op.type !== "path_payment_strict_receive")
				return false
			const record = op as {
				from?: string
				to?: string
				amount?: string
			}
			if (record.from !== expectedSource) return false
			if (QF_POOL_ADDRESS && record.to !== QF_POOL_ADDRESS) return false
			const paid = Number(record.amount ?? "0")
			return paid + AMOUNT_TOLERANCE >= expectedAmount
		})

		if (!match) {
			return {
				valid: false,
				reason: "No matching payment from donor found in transaction",
			}
		}

		return { valid: true }
	} catch (err) {
		log.warn({ err, txHash }, "Horizon tx verification failed")
		return { valid: false, reason: "Unable to verify transaction on Horizon" }
	}
}
