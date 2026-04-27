/**
 * Stellar contract service for triggering on-chain milestone verification.
 *
 * In production this calls the CourseMilestone contract via the Stellar SDK.
 */

import { pool } from "../db/index"
import { getRequestId } from "../lib/request-context"

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet"
const STELLAR_SECRET_KEY = process.env.STELLAR_SECRET_KEY ?? ""
const COURSE_MILESTONE_CONTRACT_ID =
	process.env.COURSE_MILESTONE_CONTRACT_ID ?? ""
const SCHOLAR_NFT_CONTRACT_ID = process.env.SCHOLAR_NFT_CONTRACT_ID ?? ""
const SCHOLARSHIP_TREASURY_CONTRACT_ID =
	process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID ?? ""
const MILESTONE_ESCROW_CONTRACT_ID =
	process.env.MILESTONE_ESCROW_CONTRACT_ID ?? ""
const LEARN_TOKEN_CONTRACT_ID = process.env.LEARN_TOKEN_CONTRACT_ID ?? ""
const GOVERNANCE_TOKEN_CONTRACT_ID =
	process.env.GOVERNANCE_TOKEN_CONTRACT_ID ?? ""

export interface ContractCallResult {
	txHash: string | null
	simulated: boolean
	tokenId?: number
}

export interface ScholarshipProposalParams {
	applicant: string
	amount: number
	programName: string
	programUrl: string
	programDescription: string
	startDate: string
	milestoneTitles: string[]
	milestoneDates: string[]
}

export interface CastVoteParams {
	voter: string
	proposalId: number
	support: boolean
}

export interface CancelProposalParams {
	proposalId: number
}

interface RequestTraceOptions {
	requestId?: string
}

function resolveRequestId(options?: RequestTraceOptions): string | undefined {
	return options?.requestId ?? getRequestId()
}

function buildRequestMemoValue(requestId?: string): string | null {
	if (!requestId) return null
	const compact = requestId.replace(/-/g, "").slice(0, 24)
	if (!compact) return null
	return `rid:${compact}`
}

// --- Admin Validation Cache ---
let cachedAdminAddress: string | null = null
let lastAdminCheckTime: number = 0
const ADMIN_CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds

// --- Retry Utilities ---

/**
 * Determines whether an error is transient and safe to retry.
 * Non-retryable errors: contract reverts, auth failures, missing config.
 */
function isRetryableError(err: unknown): boolean {
	const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
	// Non-retryable: config missing, auth / access-control, contract logic errors
	const nonRetryablePatterns = [
		"not configured",
		"is not the contract admin",
		"contract revert",
		"invalid auth",
		"bad auth",
		"insufficient balance",
		"already verified",
		"already rejected",
	]
	if (nonRetryablePatterns.some((p) => msg.includes(p))) return false

	// Retryable: transient network / rate-limit problems
	const retryablePatterns = [
		"timeout",
		"etimedout",
		"econnreset",
		"econnrefused",
		"enotfound",
		"socket hang up",
		"network",
		"429",
		"too many requests",
		"rate limit",
		"503",
		"service unavailable",
		"server error",
		"sequence number",
	]
	return retryablePatterns.some((p) => msg.includes(p))
}

/**
 * Executes `operation` with exponential back-off retry.
 * Only retries when `isRetryableError` returns true.
 *
 * @param operation  Async function to call
 * @param maxAttempts  Maximum total attempts (default 3)
 * @param label  Human-readable label used in log messages
 */
async function withRetry<T>(
	operation: () => Promise<T>,
	maxAttempts = 3,
	label = "Stellar contract call",
): Promise<T> {
	let lastError: unknown
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await operation()
		} catch (err) {
			lastError = err
			if (attempt === maxAttempts || !isRetryableError(err)) {
				break
			}
			const delayMs = 500 * 2 ** (attempt - 1) // 500 ms, 1 s, 2 s, …
			console.warn(
				`[stellar] ${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms…`,
				err instanceof Error ? err.message : String(err),
			)
			await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
		}
	}
	// Re-throw with retry context attached
	const base = lastError instanceof Error ? lastError : new Error(String(lastError))
	const wrapped = new Error(
		`${base.message} (failed after ${maxAttempts} attempt${maxAttempts === 1 ? "" : "s"})`,
	) as Error & { retriesExhausted: boolean; attempts: number }
	wrapped.retriesExhausted = true
	wrapped.attempts = maxAttempts
	throw wrapped
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

/**
 * Circuit breaker states:
 *   CLOSED    – calls pass through normally (healthy)
 *   OPEN      – calls are rejected immediately (endpoint assumed failed)
 *   HALF_OPEN – a single probe call is allowed to test recovery
 */
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN"

interface CircuitBreakerOptions {
	/** Number of consecutive failures before the circuit opens. Default: 5 */
	failureThreshold?: number
	/** Milliseconds to wait before moving from OPEN → HALF_OPEN. Default: 30 000 */
	resetTimeoutMs?: number
	/** Label used in log messages. Default: "stellar-rpc" */
	label?: string
}

export class CircuitBreaker {
	private state: CircuitState = "CLOSED"
	private consecutiveFailures = 0
	private openedAt: number | null = null

	private readonly failureThreshold: number
	private readonly resetTimeoutMs: number
	private readonly label: string

	constructor(options: CircuitBreakerOptions = {}) {
		this.failureThreshold = options.failureThreshold ?? 5
		this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000
		this.label = options.label ?? "stellar-rpc"
	}

	/** Returns a snapshot of the current circuit state for health checks. */
	getStatus(): {
		state: CircuitState
		consecutiveFailures: number
		openedAt: string | null
	} {
		return {
			state: this.state,
			consecutiveFailures: this.consecutiveFailures,
			openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : null,
		}
	}

	/**
	 * Wrap an async operation with circuit-breaker protection.
	 * Throws `CircuitOpenError` when the circuit is OPEN and the probe window
	 * has not yet elapsed.
	 */
	async call<T>(operation: () => Promise<T>): Promise<T> {
		this.maybeTransitionToHalfOpen()

		if (this.state === "OPEN") {
			throw new CircuitOpenError(
				`[circuit:${this.label}] Circuit is OPEN – Stellar RPC calls are suspended`,
			)
		}

		try {
			const result = await operation()
			this.onSuccess()
			return result
		} catch (err) {
			this.onFailure(err)
			throw err
		}
	}

	// -------------------------------------------------------------------------
	// Private helpers
	// -------------------------------------------------------------------------

	private maybeTransitionToHalfOpen(): void {
		if (
			this.state === "OPEN" &&
			this.openedAt !== null &&
			Date.now() - this.openedAt >= this.resetTimeoutMs
		) {
			this.transition("HALF_OPEN")
		}
	}

	private onSuccess(): void {
		if (this.state === "HALF_OPEN") {
			this.transition("CLOSED")
		}
		this.consecutiveFailures = 0
	}

	private onFailure(err: unknown): void {
		this.consecutiveFailures++

		if (this.state === "HALF_OPEN") {
			// Probe failed – reopen immediately
			this.transition("OPEN")
			return
		}

		if (
			this.state === "CLOSED" &&
			this.consecutiveFailures >= this.failureThreshold
		) {
			this.transition("OPEN")
		} else {
			const msg = err instanceof Error ? err.message : String(err)
			console.warn(
				`[circuit:${this.label}] Failure recorded (${this.consecutiveFailures}/${this.failureThreshold}): ${msg}`,
			)
		}
	}

	private transition(next: CircuitState): void {
		const prev = this.state
		this.state = next

		if (next === "OPEN") {
			this.openedAt = Date.now()
		} else if (next === "CLOSED") {
			this.openedAt = null
			this.consecutiveFailures = 0
		}

		console.warn(
			`[circuit:${this.label}] State transition: ${prev} → ${next}` +
				(next === "OPEN"
					? ` (will probe after ${this.resetTimeoutMs}ms)`
					: ""),
		)
	}
}

/** Error thrown when a call is rejected because the circuit is open. */
export class CircuitOpenError extends Error {
	readonly isCircuitOpen = true

	constructor(message: string) {
		super(message)
		this.name = "CircuitOpenError"
	}
}

/**
 * Shared circuit breaker instance for all Stellar RPC calls.
 *
 * Configuration via environment variables:
 *   STELLAR_CB_FAILURE_THRESHOLD  – consecutive failures before opening (default 5)
 *   STELLAR_CB_RESET_TIMEOUT_MS   – ms before probing recovery (default 30 000)
 */
export const stellarRpcCircuitBreaker = new CircuitBreaker({
	failureThreshold: Number(process.env.STELLAR_CB_FAILURE_THRESHOLD ?? 5),
	resetTimeoutMs: Number(process.env.STELLAR_CB_RESET_TIMEOUT_MS ?? 30_000),
	label: "stellar-rpc",
})

// ---------------------------------------------------------------------------

async function ensureAdminRole(): Promise<void> {
	if (!STELLAR_SECRET_KEY) {
		throw new Error(
			"STELLAR_SECRET_KEY not configured — cannot submit on-chain transaction",
		)
	}

	const {
		Keypair,
		Contract,
		TransactionBuilder,
		Networks,
		BASE_FEE,
		rpc,
		scValToNative,
	} = await import("@stellar/stellar-sdk")

	const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY)
	const serverPubKey = keypair.publicKey()

	// 1. Check if we have a valid cached result
	if (Date.now() - lastAdminCheckTime < ADMIN_CACHE_TTL && cachedAdminAddress) {
		if (serverPubKey !== cachedAdminAddress) {
			throw new Error(
				`Server keypair ${serverPubKey} is not the contract admin. Update STELLAR_SECRET_KEY.`,
			)
		}
		return
	}

	// 2. Cache expired or empty: Fetch from the blockchain
	const serverUrl =
		STELLAR_NETWORK === "mainnet"
			? "https://soroban-rpc.stellar.org"
			: "https://soroban-testnet.stellar.org"
	const server = new rpc.Server(serverUrl)

	const account = await server.getAccount(serverPubKey)
	const contract = new Contract(COURSE_MILESTONE_CONTRACT_ID)

	// Build a transaction solely to simulate the admin() getter
	const tx = new TransactionBuilder(account, {
		fee: BASE_FEE,
		networkPassphrase:
			STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
	})
		.addOperation(contract.call("admin"))
		.setTimeout(30)
		.build()

	const simResult = await server.simulateTransaction(tx)

	if (rpc.Api.isSimulationError(simResult)) {
		throw new Error(`Failed to simulate admin() check: ${simResult.error}`)
	}

	if (!simResult.result || !simResult.result.retval) {
		throw new Error("Contract admin() returned no value.")
	}

	// 3. Update the Cache
	cachedAdminAddress = scValToNative(simResult.result.retval) as string
	lastAdminCheckTime = Date.now()

	// 4. Verify Authorization
	if (serverPubKey !== cachedAdminAddress) {
		throw new Error(
			`Server keypair ${serverPubKey} is not the contract admin. Update STELLAR_SECRET_KEY.`,
		)
	}
}

async function callVerifyMilestone(
	scholarAddress: string,
	courseId: string,
	milestoneId: number,
	options: RequestTraceOptions = {},
): Promise<ContractCallResult> {
	if (!STELLAR_SECRET_KEY) {
		throw new Error(
			"STELLAR_SECRET_KEY not configured — cannot submit on-chain transaction",
		)
	}
	if (!COURSE_MILESTONE_CONTRACT_ID) {
		throw new Error(
			"COURSE_MILESTONE_CONTRACT_ID not configured — cannot submit on-chain transaction",
		)
	}

	return stellarRpcCircuitBreaker.call(() => withRetry(async () => {
		try {
			// Enforce access control before doing anything
			await ensureAdminRole()
			// Dynamic import so the SDK is only loaded when actually needed
			const {
				Keypair,
				Contract,
				TransactionBuilder,
				Networks,
				BASE_FEE,
				rpc,
				xdr,
			} = await import("@stellar/stellar-sdk")

			const server = new rpc.Server(
				STELLAR_NETWORK === "mainnet"
					? "https://soroban-rpc.stellar.org"
					: "https://soroban-testnet.stellar.org",
			)

			const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY)
			const account = await server.getAccount(keypair.publicKey())
			const contract = new Contract(COURSE_MILESTONE_CONTRACT_ID)

			const tx = new TransactionBuilder(account, {
				fee: BASE_FEE,
				networkPassphrase:
					STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
			})
				.addOperation(
					contract.call(
						"verify_milestone",
						xdr.ScVal.scvString(scholarAddress),
						xdr.ScVal.scvString(courseId),
						xdr.ScVal.scvU32(milestoneId),
					),
				)
				.setTimeout(30)
				.build()

			const prepared = await server.prepareTransaction(tx)
			prepared.sign(keypair)

			const result = await server.sendTransaction(prepared)
			return { txHash: result.hash, simulated: false }
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			// Bubble up our specific admin error without wrapping it
			if (msg.includes("is not the contract admin")) {
				throw err
			}
			console.error("[stellar] Contract call failed:", err)
			throw new Error(
				"Contract call failed: " +
					(err instanceof Error ? err.message : String(err)),
			)
		}
	}, 3, "callVerifyMilestone"))
}

async function emitRejectionEvent(
	scholarAddress: string,
	courseId: string,
	milestoneId: number,
	reason: string,
	options: RequestTraceOptions = {},
): Promise<ContractCallResult> {
	if (!STELLAR_SECRET_KEY) {
		throw new Error(
			"STELLAR_SECRET_KEY not configured — cannot submit on-chain transaction",
		)
	}
	if (!COURSE_MILESTONE_CONTRACT_ID) {
		throw new Error(
			"COURSE_MILESTONE_CONTRACT_ID not configured — cannot submit on-chain transaction",
		)
	}

	return stellarRpcCircuitBreaker.call(() => withRetry(async () => {
		try {
			// Enforce access control before doing anything
			await ensureAdminRole()
			const {
				Keypair,
				Contract,
				TransactionBuilder,
				Networks,
				BASE_FEE,
				rpc,
				xdr,
			} = await import("@stellar/stellar-sdk")

			const server = new rpc.Server(
				STELLAR_NETWORK === "mainnet"
					? "https://soroban-rpc.stellar.org"
					: "https://soroban-testnet.stellar.org",
			)

			const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY)
			const account = await server.getAccount(keypair.publicKey())
			const contract = new Contract(COURSE_MILESTONE_CONTRACT_ID)

			const tx = new TransactionBuilder(account, {
				fee: BASE_FEE,
				networkPassphrase:
					STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
			})
				.addOperation(
					contract.call(
						"reject_milestone",
						xdr.ScVal.scvString(scholarAddress),
						xdr.ScVal.scvString(courseId),
						xdr.ScVal.scvU32(milestoneId),
						xdr.ScVal.scvString(reason),
					),
				)
				.setTimeout(30)
				.build()

			const prepared = await server.prepareTransaction(tx)
			prepared.sign(keypair)

			const result = await server.sendTransaction(prepared)
			return { txHash: result.hash, simulated: false }
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			// Bubble up our specific admin error without wrapping it
			if (msg.includes("is not the contract admin")) {
				throw err
			}
			console.error("[stellar] Rejection event failed:", err)
			throw new Error(
				"Rejection event failed: " +
					(err instanceof Error ? err.message : String(err)),
			)
		}
	}, 3, "emitRejectionEvent"))
}

async function callMintScholarNFT(
	scholarAddress: string,
	metadataUri: string,
): Promise<ContractCallResult & { tokenId?: number }> {
	if (!STELLAR_SECRET_KEY) {
		throw new Error(
			"STELLAR_SECRET_KEY not configured — cannot submit on-chain transaction",
		)
	}
	if (!SCHOLAR_NFT_CONTRACT_ID) {
		throw new Error(
			"SCHOLAR_NFT_CONTRACT_ID not configured — cannot submit on-chain transaction",
		)
	}

	return stellarRpcCircuitBreaker.call(() => withRetry(async () => {
		try {
			const {
				Keypair,
				Contract,
				TransactionBuilder,
				Networks,
				BASE_FEE,
				rpc,
				xdr,
			} = await import("@stellar/stellar-sdk")

			const server = new rpc.Server(
				STELLAR_NETWORK === "mainnet"
					? "https://soroban-rpc.stellar.org"
					: "https://soroban-testnet.stellar.org",
			)

			const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY)
			const account = await server.getAccount(keypair.publicKey())
			const contract = new Contract(SCHOLAR_NFT_CONTRACT_ID)

			const tx = new TransactionBuilder(account, {
				fee: BASE_FEE,
				networkPassphrase:
					STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
			})
				.addOperation(
					contract.call(
						"mint",
						xdr.ScVal.scvString(scholarAddress),
						xdr.ScVal.scvString(metadataUri),
					),
				)
				.setTimeout(30)
				.build()

			const prepared = await server.prepareTransaction(tx)
			prepared.sign(keypair)

			const result = await server.sendTransaction(prepared)
			return { txHash: result.hash, simulated: false }
		} catch (err) {
			console.error("[stellar] ScholarNFT mint failed:", err)
			throw new Error(
				"ScholarNFT mint failed: " +
					(err instanceof Error ? err.message : String(err)),
			)
		}
	}, 3, "callMintScholarNFT"))
}

/**
 * Check if a learner is enrolled in a course on-chain.
 */
async function isEnrolled(
	learnerAddress: string,
	courseId: number,
	_options: RequestTraceOptions = {},
): Promise<boolean> {
	if (!COURSE_MILESTONE_CONTRACT_ID) {
		console.warn(
			"[stellar] COURSE_MILESTONE_CONTRACT_ID not set — simulating enrollment check",
		)
		return true // In dev mode, assume enrolled
	}

	try {
		return await stellarRpcCircuitBreaker.call(async () => {
			const {
				Contract,
				rpc,
				xdr,
				Address,
				Networks,
				TransactionBuilder,
				Keypair,
			} = await import("@stellar/stellar-sdk")

			const server = new rpc.Server(
				STELLAR_NETWORK === "mainnet"
					? "https://soroban-rpc.stellar.org"
					: "https://soroban-testnet.stellar.org",
			)

			// Get a dummy account for simulation
			const dummyKeypair = Keypair.random()
			const dummyAccount = await server.getAccount(dummyKeypair.publicKey())

			const contract = new Contract(COURSE_MILESTONE_CONTRACT_ID)

			// Create address from learner address
			const learnerScVal = xdr.ScVal.scvAddress(
				new Address(learnerAddress).toScVal() as any,
			)

			const tx = new TransactionBuilder(dummyAccount, {
				fee: "100",
				networkPassphrase:
					STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
			})
				.addOperation(
					contract.call("is_enrolled", learnerScVal, xdr.ScVal.scvU32(courseId)),
				)
				.setTimeout(30)
				.build()

			const simResult = await server.simulateTransaction(tx)

			if (rpc.Api.isSimulationError(simResult)) {
				console.error("[stellar] is_enrolled simulation failed:", simResult.error)
				return false
			}

			if (simResult.result) {
				const { scValToNative } = await import("@stellar/stellar-sdk")
				return scValToNative(simResult.result.retval) as boolean
			}

			return false
		})
	} catch (err) {
		console.error("[stellar] is_enrolled check failed:", err)
		return false
	}
}

async function submitScholarshipProposal(
	params: ScholarshipProposalParams,
	options: RequestTraceOptions = {},
): Promise<ContractCallResult & { proposalId: string | null }> {
	if (!STELLAR_SECRET_KEY) {
		throw new Error(
			"STELLAR_SECRET_KEY not configured — cannot submit on-chain transaction",
		)
	}
	if (!SCHOLARSHIP_TREASURY_CONTRACT_ID) {
		throw new Error(
			"SCHOLARSHIP_TREASURY_CONTRACT_ID not configured — cannot submit on-chain transaction",
		)
	}

	return stellarRpcCircuitBreaker.call(() => withRetry(async () => {
		try {
			const {
				Keypair,
				Contract,
				TransactionBuilder,
				Networks,
				BASE_FEE,
				rpc,
				nativeToScVal,
			} = await import("@stellar/stellar-sdk")

			const server = new rpc.Server(
				STELLAR_NETWORK === "mainnet"
					? "https://soroban-rpc.stellar.org"
					: "https://soroban-testnet.stellar.org",
			)

			const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY)
			const account = await server.getAccount(keypair.publicKey())
			const contract = new Contract(SCHOLARSHIP_TREASURY_CONTRACT_ID)

			const tx = new TransactionBuilder(account, {
				fee: BASE_FEE,
				networkPassphrase:
					STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
			})
				.addOperation(
					contract.call(
						"submit_proposal",
						nativeToScVal(params.applicant, { type: "address" }),
						nativeToScVal(params.amount, { type: "i128" }),
						nativeToScVal(params.programName),
						nativeToScVal(params.programUrl),
						nativeToScVal(params.programDescription),
						nativeToScVal(params.startDate),
						nativeToScVal(params.milestoneTitles),
						nativeToScVal(params.milestoneDates),
					),
				)
				.setTimeout(30)
				.build()

			const prepared = await server.prepareTransaction(tx)
			prepared.sign(keypair)

			const result = await server.sendTransaction(prepared)

			return { txHash: result.hash, proposalId: null, simulated: false }
		} catch (err) {
			console.error("[stellar] Scholarship proposal submission failed:", err)
			throw new Error(
				"Scholarship proposal submission failed: " +
					(err instanceof Error ? err.message : String(err)),
			)
		}
	}, 3, "submitScholarshipProposal"))
}

async function castVote(
	params: CastVoteParams,
	options: RequestTraceOptions = {},
): Promise<ContractCallResult> {
	if (!STELLAR_SECRET_KEY) {
		throw new Error(
			"STELLAR_SECRET_KEY not configured — cannot submit on-chain transaction",
		)
	}
	if (!SCHOLARSHIP_TREASURY_CONTRACT_ID) {
		throw new Error(
			"SCHOLARSHIP_TREASURY_CONTRACT_ID not configured — cannot submit on-chain transaction",
		)
	}

	return stellarRpcCircuitBreaker.call(async () => {
		try {
			const {
				Keypair,
				Contract,
				TransactionBuilder,
				Memo,
				Networks,
				BASE_FEE,
				rpc,
				nativeToScVal,
			} = await import("@stellar/stellar-sdk")

			const server = new rpc.Server(
				STELLAR_NETWORK === "mainnet"
					? "https://soroban-rpc.stellar.org"
					: "https://soroban-testnet.stellar.org",
			)

			const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY)
			const account = await server.getAccount(keypair.publicKey())
			const contract = new Contract(SCHOLARSHIP_TREASURY_CONTRACT_ID)

			const txBuilder = new TransactionBuilder(account, {
				fee: BASE_FEE,
				networkPassphrase:
					STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
			})
			const requestMemoValue = buildRequestMemoValue(resolveRequestId(options))
			if (requestMemoValue) {
				txBuilder.addMemo(Memo.text(requestMemoValue))
			}

			const tx = txBuilder
				.addOperation(
					contract.call(
						"vote",
						nativeToScVal(params.voter, { type: "address" }),
						nativeToScVal(params.proposalId, { type: "u32" }),
						nativeToScVal(params.support, { type: "bool" }),
					),
				)
				.setTimeout(30)
				.build()

			const prepared = await server.prepareTransaction(tx)
			prepared.sign(keypair)

			const result = await server.sendTransaction(prepared)

			return { txHash: result.hash, simulated: false }
		} catch (err) {
			console.error("[stellar] Cast vote failed:", err)
			throw new Error(
				"Cast vote failed: " + (err instanceof Error ? err.message : String(err)),
			)
		}
	})
}

async function cancelProposal(
	params: CancelProposalParams,
	options: RequestTraceOptions = {},
): Promise<ContractCallResult> {
	if (!STELLAR_SECRET_KEY) {
		throw new Error(
			"STELLAR_SECRET_KEY not configured â€” cannot submit on-chain transaction",
		)
	}
	if (!SCHOLARSHIP_TREASURY_CONTRACT_ID) {
		throw new Error(
			"SCHOLARSHIP_TREASURY_CONTRACT_ID not configured â€” cannot submit on-chain transaction",
		)
	}

	return stellarRpcCircuitBreaker.call(async () => {
		try {
			const {
				Keypair,
				Contract,
				TransactionBuilder,
				Memo,
				Networks,
				BASE_FEE,
				rpc,
				nativeToScVal,
			} = await import("@stellar/stellar-sdk")

			const server = new rpc.Server(
				STELLAR_NETWORK === "mainnet"
					? "https://soroban-rpc.stellar.org"
					: "https://soroban-testnet.stellar.org",
			)

			const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY)
			const account = await server.getAccount(keypair.publicKey())
			const contract = new Contract(SCHOLARSHIP_TREASURY_CONTRACT_ID)

			const txBuilder = new TransactionBuilder(account, {
				fee: BASE_FEE,
				networkPassphrase:
					STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
			})
			const requestMemoValue = buildRequestMemoValue(resolveRequestId(options))
			if (requestMemoValue) {
				txBuilder.addMemo(Memo.text(requestMemoValue))
			}

			const tx = txBuilder
				.addOperation(
					contract.call(
						"cancel_proposal",
						nativeToScVal(params.proposalId, { type: "u32" }),
					),
				)
				.setTimeout(30)
				.build()

			const prepared = await server.prepareTransaction(tx)
			prepared.sign(keypair)

			const result = await server.sendTransaction(prepared)

			return { txHash: result.hash, simulated: false }
		} catch (err) {
			console.error("[stellar] Cancel proposal failed:", err)
			throw new Error(
				"Cancel proposal failed: " +
					(err instanceof Error ? err.message : String(err)),
			)
		}
	})
}

async function reclaimInactiveEscrow(
	proposalId: number,
	options: RequestTraceOptions = {},
): Promise<ContractCallResult> {
	if (!STELLAR_SECRET_KEY) {
		throw new Error(
			"STELLAR_SECRET_KEY not configured — cannot submit on-chain transaction",
		)
	}
	if (!MILESTONE_ESCROW_CONTRACT_ID) {
		throw new Error(
			"MILESTONE_ESCROW_CONTRACT_ID not configured — cannot submit on-chain transaction",
		)
	}

	return stellarRpcCircuitBreaker.call(async () => {
		try {
			const {
				Keypair,
				Contract,
				TransactionBuilder,
				Memo,
				Networks,
				BASE_FEE,
				rpc,
				nativeToScVal,
			} = await import("@stellar/stellar-sdk")

			const server = new rpc.Server(
				STELLAR_NETWORK === "mainnet"
					? "https://soroban-rpc.stellar.org"
					: "https://soroban-testnet.stellar.org",
			)

			const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY)
			const account = await server.getAccount(keypair.publicKey())
			const contract = new Contract(MILESTONE_ESCROW_CONTRACT_ID)

			const txBuilder = new TransactionBuilder(account, {
				fee: BASE_FEE,
				networkPassphrase:
					STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
			})
			const requestMemoValue = buildRequestMemoValue(resolveRequestId(options))
			if (requestMemoValue) {
				txBuilder.addMemo(Memo.text(requestMemoValue))
			}

			const tx = txBuilder
				.addOperation(
					contract.call(
						"reclaim_inactive",
						nativeToScVal(proposalId, { type: "u32" }),
					),
				)
				.setTimeout(30)
				.build()

			const prepared = await server.prepareTransaction(tx)
			prepared.sign(keypair)

			const result = await server.sendTransaction(prepared)
			return { txHash: result.hash, simulated: false }
		} catch (err) {
			console.error("[stellar] reclaim_inactive failed:", err)
			throw new Error(
				"reclaim_inactive failed: " +
					(err instanceof Error ? err.message : String(err)),
			)
		}
	})
}

async function getLearnTokenBalance(address: string): Promise<string> {
	if (!LEARN_TOKEN_CONTRACT_ID) {
		console.warn(
			"[stellar] LEARN_TOKEN_CONTRACT_ID not set — simulating balance",
		)
		return "10000000000" // 1000 LRN
	}
	try {
		return await stellarRpcCircuitBreaker.call(async () => {
			const { Contract, Address, rpc, TransactionBuilder, Account, Networks } = await import("@stellar/stellar-sdk")
			const server = new rpc.Server(
				STELLAR_NETWORK === "mainnet"
					? "https://soroban-rpc.stellar.org"
					: "https://soroban-testnet.stellar.org",
			)
			const contract = new Contract(LEARN_TOKEN_CONTRACT_ID)
			const tx = new TransactionBuilder(
				new Account("GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBF3UKJQ2K5RQDD", "0"),
				{
					fee: "100",
					networkPassphrase: STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
				},
			)
				.addOperation(contract.call("balance", new Address(address).toScVal()))
				.setTimeout(30)
				.build()
			const simResult = await server.simulateTransaction(tx)
			if (rpc.Api.isSimulationError(simResult)) return "0"
			const { scValToNative } = await import("@stellar/stellar-sdk")
			return scValToNative(simResult.result?.retval!).toString()
		})
	} catch (err) {
		console.error("[stellar] getLearnTokenBalance failed:", err)
		return "0"
	}
}

async function getGovernanceTokenBalance(address: string): Promise<string> {
	if (!GOVERNANCE_TOKEN_CONTRACT_ID) {
		console.warn(
			"[stellar] GOVERNANCE_TOKEN_CONTRACT_ID not set — simulating balance",
		)
		return "1250000000"
	}
	try {
		return await stellarRpcCircuitBreaker.call(async () => {
			const { Contract, Address, rpc, TransactionBuilder, Account, Networks } = await import("@stellar/stellar-sdk")
			const server = new rpc.Server(
				STELLAR_NETWORK === "mainnet"
					? "https://soroban-rpc.stellar.org"
					: "https://soroban-testnet.stellar.org",
			)
			const contract = new Contract(GOVERNANCE_TOKEN_CONTRACT_ID)
			const tx = new TransactionBuilder(
				new Account("GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBF3UKJQ2K5RQDD", "0"),
				{
					fee: "100",
					networkPassphrase: STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
				},
			)
				.addOperation(contract.call("balance", new Address(address).toScVal()))
				.setTimeout(30)
				.build()
			const simResult = await server.simulateTransaction(tx)
			if (rpc.Api.isSimulationError(simResult)) return "0"
			const { scValToNative } = await import("@stellar/stellar-sdk")
			return scValToNative(simResult.result?.retval!).toString()
		})
	} catch (err) {
		console.error("[stellar] getGovernanceTokenBalance failed:", err)
		return "0"
	}
}

async function getGovernanceVotingPower(address: string): Promise<string> {
	if (!GOVERNANCE_TOKEN_CONTRACT_ID) {
		console.warn(
			"[stellar] GOVERNANCE_TOKEN_CONTRACT_ID not set — simulating voting power",
		)
		return "1250000000"
	}
	try {
		return await stellarRpcCircuitBreaker.call(async () => {
			const { Contract, Address, rpc, TransactionBuilder, Account, Networks } = await import("@stellar/stellar-sdk")
			const server = new rpc.Server(
				STELLAR_NETWORK === "mainnet"
					? "https://soroban-rpc.stellar.org"
					: "https://soroban-testnet.stellar.org",
			)
			const contract = new Contract(GOVERNANCE_TOKEN_CONTRACT_ID)
			const tx = new TransactionBuilder(
				new Account("GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBF3UKJQ2K5RQDD", "0"),
				{
					fee: "100",
					networkPassphrase: STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
				},
			)
				.addOperation(
					contract.call("get_voting_power", new Address(address).toScVal()),
				)
				.setTimeout(30)
				.build()
			const simResult = await server.simulateTransaction(tx)
			if (rpc.Api.isSimulationError(simResult)) return "0"
			const { scValToNative } = await import("@stellar/stellar-sdk")
			return scValToNative(simResult.result?.retval!).toString()
		})
	} catch (err) {
		console.error("[stellar] getGovernanceVotingPower failed:", err)
		return "0"
	}
}

async function getGovernanceDelegation(
	address: string,
): Promise<string | null> {
	if (!GOVERNANCE_TOKEN_CONTRACT_ID) return null
	try {
		return await stellarRpcCircuitBreaker.call(async () => {
			const { Contract, Address, rpc, TransactionBuilder, Account, Networks } = await import("@stellar/stellar-sdk")
			const server = new rpc.Server(
				STELLAR_NETWORK === "mainnet"
					? "https://soroban-rpc.stellar.org"
					: "https://soroban-testnet.stellar.org",
			)
			const contract = new Contract(GOVERNANCE_TOKEN_CONTRACT_ID)
			const tx = new TransactionBuilder(
				new Account("GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBF3UKJQ2K5RQDD", "0"),
				{
					fee: "100",
					networkPassphrase: STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
				},
			)
				.addOperation(
					contract.call("get_delegate", new Address(address).toScVal()),
				)
				.setTimeout(30)
				.build()
			const simResult = await server.simulateTransaction(tx)
			if (rpc.Api.isSimulationError(simResult)) return null
			const { scValToNative } = await import("@stellar/stellar-sdk")
			const raw = scValToNative(simResult.result?.retval!)
			// Option<Address> → null (None) or an Address string (Some)
			return typeof raw === "string" ? raw : null
		})
	} catch (err) {
		console.error("[stellar] getGovernanceDelegation failed:", err)
		return null
	}
}

async function getEnrolledCourses(address: string): Promise<string[]> {
	if (!COURSE_MILESTONE_CONTRACT_ID) {
		console.warn(
			"[stellar] COURSE_MILESTONE_CONTRACT_ID not set — simulating enrollments",
		)
		return ["stellar-basics", "defi-101"]
	}
	return ["stellar-basics", "defi-101"]
}

async function getScholarCredentials(address: string): Promise<any[]> {
	try {
		const result = await pool.query(
			`SELECT 
				sn.token_id,
				sn.course_id,
				c.title as course_title,
				sn.metadata_uri,
				sn.minted_at as issued_at,
				sn.revoked
			 FROM scholar_nfts sn
			 LEFT JOIN courses c ON sn.course_id = c.slug
			 WHERE sn.scholar_address = $1
			 ORDER BY sn.minted_at DESC`,
			[address],
		)

		type NftRow = {
			token_id: string | number
			course_id: string
			course_title: string | null
			metadata_uri: string | null
			issued_at: Date
			revoked: boolean
		}
		return result.rows.map((row: NftRow) => ({
			token_id: Number(row.token_id),
			course_id: row.course_id,
			course_title: row.course_title || "Unknown Course",
			issued_at: row.issued_at.toISOString(),
			metadata_uri: row.metadata_uri,
			revoked: row.revoked,
		}))
	} catch (err) {
		console.error("[stellar] getScholarCredentials failed:", err)
		return []
	}
}


export const stellarContractService = {
	callVerifyMilestone,
	emitRejectionEvent,
	callMintScholarNFT,
	isEnrolled,
	submitScholarshipProposal,
	castVote,
	cancelProposal,
	reclaimInactiveEscrow,
	getLearnTokenBalance,
	getGovernanceTokenBalance,
	getGovernanceVotingPower,
	getGovernanceDelegation,
	getEnrolledCourses,
	getScholarCredentials,
}
