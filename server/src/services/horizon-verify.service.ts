/**
 * Verifies that a submitted Stellar transaction is a genuine deposit()
 * call to the ScholarshipTreasury contract for the expected donor and amount.
 *
 * Uses the Horizon REST API (not Soroban RPC) so verification never requires
 * a local secret key and works even when the RPC node is unavailable.
 *
 * Time complexity : O(n) where n = number of operations in the tx (always small).
 * Space complexity: O(1) — no accumulation; we exit as soon as a match is found.
 */

import { xdr, Address, scValToNative } from "@stellar/stellar-sdk"
import { logger } from "../lib/logger"

const log = logger.child({ module: "horizon-verify" })

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet"
const SCHOLARSHIP_TREASURY_CONTRACT_ID =
	process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID ?? ""
const USDC_CONTRACT_ID = process.env.USDC_CONTRACT_ID ?? ""

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
	if (!USDC_CONTRACT_ID) {
		throw new Error(
			"USDC_CONTRACT_ID not configured — cannot verify asset parameter",
		)
	}

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

		const ihfOp = body.value() as xdr.InvokeHostFunctionOp
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

		// 5. Verify the third argument (asset) is exactly USDC_CONTRACT_ID
		if (args.length < 3) continue
		let assetStrkey: string
		try {
			assetStrkey = Address.fromScVal(args[2]).toString()
		} catch {
			continue
		}
		if (!USDC_CONTRACT_ID || assetStrkey !== USDC_CONTRACT_ID) continue

		return true
	}

	return false
}
