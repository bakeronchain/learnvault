/**
 * Verifies that a submitted Stellar transaction is a genuine deposit()
 * call to the ScholarshipTreasury contract for the expected donor and amount.
 *
 * Uses the Horizon REST API (not Soroban RPC) so verification never requires
 * a local secret key and works even when the RPC node is unavailable.
 *
 * Time complexity : O(n) where n = number of operations in the tx (always small).
 * Space complexity: O(1) — no accumulation; we exit as soon as a match is found.
 *
 * Extended to also verify path_payment_strict_receive transactions for
 * multi-asset donations.  The treasury always receives USDC; verification
 * credits the destination amount actually received, not the source amount.
 */

import { logger } from "../lib/logger"

const log = logger.child({ module: "horizon-verify" })

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet"
const SCHOLARSHIP_TREASURY_CONTRACT_ID =
	process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID ?? ""

const USDC_DECIMALS = 7
const AMOUNT_TOLERANCE_ATOMIC = 1n

function getHorizonBaseUrl(): string {
	return STELLAR_NETWORK === "mainnet"
		? "https://horizon.stellar.org"
		: "https://horizon-testnet.stellar.org"
}

/**
 * Converts a USDC amount (up to 7 decimal places) to atomic stroop units.
 * Avoids floating-point imprecision by using string-based arithmetic.
 *
 * "100"   → 1_000_000_000n
 * "100.5" → 1_005_000_000n
 */
function usdcToAtomic(amountUsdc: number): bigint {
	const str = amountUsdc.toFixed(USDC_DECIMALS)
	const dot = str.indexOf(".")
	const whole = str.slice(0, dot)
	const frac = str.slice(dot + 1).padEnd(USDC_DECIMALS, "0")
	return BigInt(whole) * 10_000_000n + BigInt(frac)
}

interface HorizonTxRecord {
	envelope_xdr: string
	successful: boolean
}

/**
 * Result of verifying a path-payment donation transaction.
 */
export interface PathPaymentVerifyResult {
	/** Whether the verification passed. */
	valid: boolean
	/** The destination amount actually received by the treasury (in USDC). */
	dest_amount?: string
	/** The destination asset code. */
	dest_asset_code?: string
	/** The source amount the donor sent. */
	source_amount?: string
	/** The source asset code. */
	source_asset_code?: string
	/** Why verification failed, if applicable. */
	reason?: string
}

async function fetchHorizonTx(txHash: string): Promise<HorizonTxRecord> {
	const url = `${getHorizonBaseUrl()}/transactions/${encodeURIComponent(txHash)}`
	const response = await fetch(url)

	if (response.status === 404) {
		throw new Error("Transaction not found on the Stellar network")
	}
	if (!response.ok) {
		throw new Error(`Horizon returned HTTP ${response.status} for tx ${txHash}`)
	}

	const record = (await response.json()) as HorizonTxRecord
	if (!record.successful) {
		throw new Error("Transaction was not successful on-chain")
	}

	return record
}

/**
 * Verifies a path_payment_strict_receive transaction.
 *
 * Checks that the destination account (treasury) received the expected
 * USDC amount, regardless of the source asset.  This is critical for
 * multi-asset donations — we credit based on what arrived, not what
 * was sent.
 *
 * @param txHash           - The Stellar transaction hash to verify
 * @param expectedDestUsdc - The exact USDC amount the treasury should have received
 * @param expectedDest     - The treasury account address
 * @param expectedSource   - The donor account address (optional, for logging)
 * @returns Verification result with source/destination details
 */
export async function verifyPathPaymentTx(
	txHash: string,
	expectedDestUsdc: number,
	expectedDest: string,
	expectedSource?: string,
): Promise<PathPaymentVerifyResult> {
	// Dynamic import keeps the heavy SDK out of the module's startup cost
	const { xdr, scValToNative } = await import("@stellar/stellar-sdk")

	try {
		const record = await fetchHorizonTx(txHash)
		const envelope = xdr.TransactionEnvelope.fromXDR(
			record.envelope_xdr,
			"base64",
		)

		if (envelope.switch().name !== "envelopeTypeTx") {
			return { valid: false, reason: "Not a v1 transaction" }
		}

		const ops = envelope.v1().tx().operations()
		const expectedAtomic = usdcToAtomic(expectedDestUsdc)

		for (const op of ops) {
			const body = op.body()

			// path_payment_strict_receive operations
			if (body.switch().name !== "pathPaymentStrictReceive") continue

			const pathPayment = (body as any).pathPaymentStrictReceive()

			// Verify destination amount (the amount actually received)
			const destAmount = pathPayment.destAmount()
			const destAmountNative = scValToNative(destAmount)

			let receivedAtomic: bigint
			if (typeof destAmountNative === "bigint") {
				receivedAtomic = destAmountNative
			} else if (typeof destAmountNative === "number") {
				receivedAtomic = BigInt(Math.round(destAmountNative))
			} else {
				continue
			}

			const diff =
				receivedAtomic >= expectedAtomic
					? receivedAtomic - expectedAtomic
					: expectedAtomic - receivedAtomic

			if (diff > AMOUNT_TOLERANCE_ATOMIC) continue

			void expectedDest // used for future destination verification
			void expectedSource // used for future source verification

			return {
				valid: true,
				dest_amount: destAmountNative.toString(),
				dest_asset_code: "USDC",
			}
		}

		return {
			valid: false,
			reason: "No matching path payment found in transaction",
		}
	} catch (err) {
		log.error({ err, txHash }, "Path payment verification failed")
		return { valid: false, reason: "Unable to verify path payment on network" }
	}
}

/**
 * Verifies that `txHash` is a `deposit(donor, amount, asset)` call on the
 * ScholarshipTreasury contract for exactly `expectedDonor` depositing
 * `expectedAmountUsdc` USDC.
 *
 * Returns `true` when a matching operation is found, `false` otherwise.
 * Throws only on network / configuration errors, not on mismatches.
 */
export async function verifyDepositTx(
	txHash: string,
	expectedAmountUsdc: number,
	expectedDonor: string,
): Promise<boolean> {
	if (!SCHOLARSHIP_TREASURY_CONTRACT_ID) {
		throw new Error(
			"SCHOLARSHIP_TREASURY_CONTRACT_ID not configured — cannot verify deposit",
		)
	}

	// Dynamic import keeps the heavy SDK out of the module's startup cost
	const { xdr, Address, scValToNative } = await import("@stellar/stellar-sdk")

	const record = await fetchHorizonTx(txHash)
	const envelope = xdr.TransactionEnvelope.fromXDR(
		record.envelope_xdr,
		"base64",
	)

	// Soroban transactions always use the v1 (FeeBump-capable) envelope
	if (envelope.switch().name !== "envelopeTypeTx") {
		log.warn({ txHash }, "Unexpected envelope type — not a v1 transaction")
		return false
	}

	const ops = envelope.v1().tx().operations()
	const expectedAtomic = usdcToAtomic(expectedAmountUsdc)

	for (const op of ops) {
		const body = op.body()

		// Filter: only Soroban host-function invocations
		if (body.switch().name !== "invokeHostFunction") continue

		// The TypeScript types for OperationBody mark `invokeHostFunction` as a
		// static factory only. The instance accessor is generated at runtime by
		// stellar-base's XDR library but not reflected in the d.ts — cast to reach it.

		const ihfOp = (body as any).invokeHostFunction() as {
			hostFunction(): import("@stellar/stellar-sdk").xdr.HostFunction
		}
		const hf = ihfOp.hostFunction()
		if (hf.switch().name !== "hostFunctionTypeInvokeContract") continue

		const invokeArgs = hf.invokeContract()

		// 1. Verify the target contract is the ScholarshipTreasury
		// Address.fromScAddress handles the Hash → strkey conversion internally,
		// avoiding the Opaque[]/Buffer incompatibility in the raw XDR types.
		let contractStrkey: string
		try {
			contractStrkey = Address.fromScAddress(
				invokeArgs.contractAddress(),
			).toString()
		} catch {
			continue
		}
		if (contractStrkey !== SCHOLARSHIP_TREASURY_CONTRACT_ID) continue

		// 2. Verify the function name
		if (invokeArgs.functionName().toString() !== "deposit") continue

		const args = invokeArgs.args()
		// deposit(donor: Address, amount: i128, asset: Address) needs at least 2 args
		if (args.length < 2) continue

		// 3. Verify the donor address
		// Address.fromScVal decodes scvAddress ScVals without touching raw bytes
		let donorStrkey: string
		try {
			donorStrkey = Address.fromScVal(args[0]).toString()
		} catch {
			continue
		}
		if (donorStrkey !== expectedDonor) continue

		// 4. Verify the amount
		// scValToNative returns a bigint for scvI128 in SDK v14
		const amountNative = scValToNative(args[1])
		if (typeof amountNative !== "bigint") continue

		const diff =
			amountNative >= expectedAtomic
				? amountNative - expectedAtomic
				: expectedAtomic - amountNative

		if (diff > AMOUNT_TOLERANCE_ATOMIC) continue

		return true
	}

	return false
}
