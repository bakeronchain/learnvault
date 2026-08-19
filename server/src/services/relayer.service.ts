/**
 * Fee-bump relayer for gasless onboarding (#1054).
 *
 * A learner with a zero-XLM balance can't pay the fee on their own
 * transactions. This service accepts a learner-SIGNED inner transaction
 * envelope, validates it against a hard allowlist of LearnVault contract
 * calls, wraps it in a fee-bump transaction paid by the sponsor account, and
 * submits it. The allowlist check is the entire point of this file — a
 * permissive relayer is a free money pump for draining the sponsor account,
 * so every rejection below is a hard reject, never a flag-and-continue.
 *
 * Validation (parseAndValidateInnerTransaction) is a pure, synchronous,
 * network-free function operating on already-signed XDR — no RPC round trip
 * needed to reject a bad request, and it's fully unit-testable without
 * mocking the network (see server/src/tests/relayer.service.test.ts).
 */

import { logger } from "../lib/logger"
import { sponsorshipStore } from "../db/sponsorship-store"

const log = logger.child({ module: "relayer" })

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet"
const SPONSOR_SECRET = process.env.SPONSOR_SECRET ?? ""

// 0.01 XLM default — generous for a single contract-invocation operation,
// tight enough that a maliciously-inflated inner fee can't drain much per call.
const SPONSOR_MAX_FEE_STROOPS = BigInt(
	process.env.SPONSOR_MAX_FEE_STROOPS ?? "100000",
)
// 50 XLM/day default sponsor spend ceiling across account creation + relayed fees.
const SPONSOR_DAILY_SPEND_CAP_STROOPS = BigInt(
	process.env.SPONSOR_DAILY_SPEND_CAP_STROOPS ?? "500000000",
)
const SPONSOR_DAILY_SPEND_ALERT_RATIO = 0.8

const COURSE_MILESTONE_CONTRACT_ID =
	process.env.COURSE_MILESTONE_CONTRACT_ID ?? ""

function networkPassphrase(): string {
	return STELLAR_NETWORK === "mainnet"
		? "Public Global Stellar Network ; September 2015"
		: "Test SDF Network ; September 2015"
}

function rpcUrlFor(): string {
	return STELLAR_NETWORK === "mainnet"
		? "https://soroban-rpc.stellar.org"
		: "https://soroban-testnet.stellar.org"
}

/**
 * Learner-signed on-chain operations the relayer will fee-bump.
 *
 * The issue frames the allowlist as "enroll, submit milestone, claim
 * reward." In this codebase's contracts (contracts/course_milestone), only
 * two functions require the LEARNER's auth — `enroll` and
 * `submit_milestone`. Reward payout (`complete_milestone`) is gated on
 * `require_stored_admin_auth`, i.e. it's an oracle/admin-signed call the
 * learner never submits — there is currently no learner-signed "claim
 * reward" transaction for the relayer to allowlist. This map is keyed by
 * contract ID -> allowed function names specifically so a future
 * learner-signed claim function is a one-line addition, not a guard rewrite.
 */
function buildAllowlist(): Map<string, Set<string>> {
	const allowlist = new Map<string, Set<string>>()
	if (COURSE_MILESTONE_CONTRACT_ID) {
		allowlist.set(
			COURSE_MILESTONE_CONTRACT_ID,
			new Set(["enroll", "submit_milestone"]),
		)
	}
	return allowlist
}

export interface ParsedOperation {
	contractId: string
	functionName: string
}

export interface ParsedInnerTransaction {
	sourceAccount: string
	feeStroops: bigint
	operations: ParsedOperation[]
}

export type RelayRejectionReason =
	| "INVALID_ENVELOPE"
	| "ALREADY_FEE_BUMP"
	| "NO_OPERATIONS"
	| "NON_CONTRACT_OPERATION"
	| "NOT_ALLOWLISTED"
	| "SOURCE_MISMATCH"
	| "FEE_OVER_CAP"
	| "DAILY_CAP_EXCEEDED"
	| "RELAYER_NOT_CONFIGURED"

export class RelayRejection extends Error {
	reason: RelayRejectionReason
	constructor(reason: RelayRejectionReason, message: string) {
		super(message)
		this.reason = reason
		this.name = "RelayRejection"
	}
}

/**
 * Decode a base64 inner-transaction envelope and extract exactly the fields
 * the guardrails below need. Throws RelayRejection on anything that isn't a
 * plain (non-fee-bump) v1 transaction with at least one contract-invocation
 * operation. No network access — pure XDR decoding.
 */
export async function parseInnerTransaction(
	innerTxXdr: string,
): Promise<ParsedInnerTransaction> {
	const { TransactionBuilder, FeeBumpTransaction, Address } = await import(
		"@stellar/stellar-sdk"
	)

	let tx: import("@stellar/stellar-sdk").Transaction

	try {
		const decoded = TransactionBuilder.fromXDR(
			innerTxXdr,
			networkPassphrase(),
		)
		if (decoded instanceof FeeBumpTransaction) {
			throw new RelayRejection(
				"ALREADY_FEE_BUMP",
				"inner transaction must not already be a fee-bump envelope",
			)
		}
		tx = decoded
	} catch (err) {
		if (err instanceof RelayRejection) throw err
		throw new RelayRejection(
			"INVALID_ENVELOPE",
			`innerTxXdr is not a valid transaction envelope: ${err instanceof Error ? err.message : String(err)}`,
		)
	}

	if (tx.operations.length === 0) {
		throw new RelayRejection("NO_OPERATIONS", "inner transaction has no operations")
	}

	const operations: ParsedOperation[] = tx.operations.map((op) => {
		if (op.type !== "invokeHostFunction") {
			throw new RelayRejection(
				"NON_CONTRACT_OPERATION",
				`operation type "${op.type}" is not a contract invocation — the relayer only fee-bumps LearnVault contract calls`,
			)
		}

		const func = op.func
		if (func.switch().name !== "hostFunctionTypeInvokeContract") {
			throw new RelayRejection(
				"NON_CONTRACT_OPERATION",
				"host function is not a contract invocation",
			)
		}

		const invokeArgs = func.invokeContract()
		let contractId: string
		try {
			contractId = Address.fromScAddress(invokeArgs.contractAddress()).toString()
		} catch {
			throw new RelayRejection(
				"NON_CONTRACT_OPERATION",
				"could not decode invoked contract address",
			)
		}
		const functionName = invokeArgs.functionName().toString()

		return { contractId, functionName }
	})

	return {
		sourceAccount: tx.source,
		feeStroops: BigInt(tx.fee),
		operations,
	}
}

export interface ValidateRelayOptions {
	/** The authenticated learner submitting this relay request. */
	learnerAddress: string
	/** Sum already spent today (stroops) — pass in so the check is pure/testable. */
	spendTodayStroops: bigint
}

/**
 * Apply every guardrail to an already-parsed inner transaction. Pure and
 * synchronous: no DB or network access, so it's directly unit-testable.
 * Throws RelayRejection on the first violation.
 */
export function validateParsedTransaction(
	parsed: ParsedInnerTransaction,
	options: ValidateRelayOptions,
): void {
	if (parsed.sourceAccount !== options.learnerAddress) {
		throw new RelayRejection(
			"SOURCE_MISMATCH",
			"inner transaction source account does not match the authenticated learner",
		)
	}

	const allowlist = buildAllowlist()
	for (const op of parsed.operations) {
		const allowedFunctions = allowlist.get(op.contractId)
		if (!allowedFunctions || !allowedFunctions.has(op.functionName)) {
			throw new RelayRejection(
				"NOT_ALLOWLISTED",
				`operation ${op.functionName} on contract ${op.contractId} is not on the relayer allowlist`,
			)
		}
	}

	if (parsed.feeStroops > SPONSOR_MAX_FEE_STROOPS) {
		throw new RelayRejection(
			"FEE_OVER_CAP",
			`inner transaction fee ${parsed.feeStroops} exceeds the sponsor's per-transaction cap of ${SPONSOR_MAX_FEE_STROOPS}`,
		)
	}

	const projectedSpend = options.spendTodayStroops + SPONSOR_MAX_FEE_STROOPS
	if (projectedSpend > SPONSOR_DAILY_SPEND_CAP_STROOPS) {
		throw new RelayRejection(
			"DAILY_CAP_EXCEEDED",
			`relaying this transaction would exceed the sponsor's daily spend ceiling (spent so far: ${options.spendTodayStroops}, cap: ${SPONSOR_DAILY_SPEND_CAP_STROOPS})`,
		)
	}

	const ratio = Number(projectedSpend) / Number(SPONSOR_DAILY_SPEND_CAP_STROOPS)
	if (ratio >= SPONSOR_DAILY_SPEND_ALERT_RATIO) {
		log.warn(
			{ spendTodayStroops: options.spendTodayStroops.toString(), ratio },
			"[ALERT] Sponsor daily spend approaching the ceiling",
		)
	}
}

function startOfTodayUtc(): Date {
	const now = new Date()
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export interface FeeBumpResult {
	hash: string
}

/**
 * Validate and relay a learner-signed inner transaction: wrap it in a
 * fee-bump paid by the sponsor, submit it, and record the spend. Rejects
 * (throws RelayRejection) before ever touching the network if any guardrail
 * fails — the network round trip only happens for a request that already
 * passed every check.
 */
export async function submitFeeBump(
	innerTxXdr: string,
	learnerAddress: string,
): Promise<FeeBumpResult> {
	if (!SPONSOR_SECRET) {
		throw new RelayRejection(
			"RELAYER_NOT_CONFIGURED",
			"SPONSOR_SECRET not configured — cannot relay transactions",
		)
	}

	const parsed = await parseInnerTransaction(innerTxXdr)
	const spendTodayStroops = await sponsorshipStore.sumSpendSince(startOfTodayUtc())
	validateParsedTransaction(parsed, { learnerAddress, spendTodayStroops })

	const { Keypair, TransactionBuilder, BASE_FEE, rpc } = await import(
		"@stellar/stellar-sdk"
	)

	const server = new rpc.Server(rpcUrlFor())
	const sponsor = Keypair.fromSecret(SPONSOR_SECRET)
	const innerTx = TransactionBuilder.fromXDR(innerTxXdr, networkPassphrase())

	// The fee-bump's baseFee must be at least the inner transaction's own fee
	// rate (buildFeeBumpTransaction throws "Invalid baseFee" otherwise) — a
	// hardcoded BASE_FEE (100 stroops) broke on any inner tx with a higher
	// fee. parsed.feeStroops has already passed the FEE_OVER_CAP check above,
	// so it never exceeds SPONSOR_MAX_FEE_STROOPS.
	const feeBumpBaseFee =
		parsed.feeStroops > BigInt(BASE_FEE)
			? parsed.feeStroops.toString()
			: BASE_FEE

	const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
		sponsor,
		feeBumpBaseFee,
		// innerTx is guaranteed to be a plain Transaction here — parseInnerTransaction
		// already rejected anything that decoded as a FeeBumpTransaction.
		innerTx as import("@stellar/stellar-sdk").Transaction,
		networkPassphrase(),
	)
	feeBumpTx.sign(sponsor)

	const response = await server.sendTransaction(feeBumpTx)
	if (response.status === "ERROR") {
		log.error({ learnerAddress, response }, "Fee-bump submission failed")
		throw new Error(`Fee-bump submission failed: ${response.status}`)
	}

	await sponsorshipStore.recordSpend({
		amountStroops: parsed.feeStroops,
		kind: "fee_bump",
		learnerAddress,
		txHash: response.hash,
	})

	log.info({ learnerAddress, hash: response.hash }, "Relayed fee-bump transaction")
	return { hash: response.hash }
}
