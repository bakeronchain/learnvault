/**
 * Stellar contract service for triggering on-chain milestone verification.
 *
 * In production this calls the CourseMilestone contract via the Stellar SDK.
 */

import { pool } from "../db/index"

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet"
const STELLAR_SECRET_KEY = process.env.STELLAR_SECRET_KEY ?? ""
const COURSE_MILESTONE_CONTRACT_ID =
	process.env.COURSE_MILESTONE_CONTRACT_ID ?? ""
const SCHOLAR_NFT_CONTRACT_ID = process.env.SCHOLAR_NFT_CONTRACT_ID ?? ""
const SCHOLARSHIP_TREASURY_CONTRACT_ID =
	process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID ?? ""
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

// --- Admin Validation Cache ---
let cachedAdminAddress: string | null = null
let lastAdminCheckTime: number = 0
const ADMIN_CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds

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
}

async function emitRejectionEvent(
	scholarAddress: string,
	courseId: string,
	milestoneId: number,
	reason: string,
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

	try {
		const {
			Keypair,
			Contract,
			TransactionBuilder,
			Networks,
			BASE_FEE,
			rpc,
			xdr,
			Address,
		} = await import("@stellar/stellar-sdk")

		const server = new rpc.Server(
			STELLAR_NETWORK === "mainnet"
				? "https://soroban-rpc.stellar.org"
				: "https://soroban-testnet.stellar.org",
		)

		const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY)
		const account = await server.getAccount(keypair.publicKey())
		const contract = new Contract(SCHOLAR_NFT_CONTRACT_ID)

		// Generate a unique token ID (simple approach: use timestamp)
		const tokenId = Date.now()

		const tx = new TransactionBuilder(account, {
			fee: BASE_FEE,
			networkPassphrase:
				STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
		})
			.addOperation(
				contract.call(
					"mint",
					new Address(scholarAddress).toScVal(),
					xdr.ScVal.scvU64(new xdr.Uint64(tokenId)),
				),
			)
			.setTimeout(30)
			.build()

		const prepared = await server.prepareTransaction(tx)
		prepared.sign(keypair)

		const result = await server.sendTransaction(prepared)
		return { txHash: result.hash, simulated: false, tokenId }
	} catch (err) {
		console.error("[stellar] ScholarNFT mint failed:", err)
		throw new Error(
			`ScholarNFT mint failed: ${err instanceof Error ? err.message : String(err)}`,
		)
	}
}

/**
 * Check if a learner is enrolled in a course on-chain.
 */
async function isEnrolled(
	learnerAddress: string,
	courseId: number,
): Promise<boolean> {
	if (!COURSE_MILESTONE_CONTRACT_ID) {
		console.warn(
			"[stellar] COURSE_MILESTONE_CONTRACT_ID not set — simulating enrollment check",
		)
		return true // In dev mode, assume enrolled
	}

	try {
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
	} catch (err) {
		console.error("[stellar] is_enrolled check failed:", err)
		return false
	}
}

async function submitScholarshipProposal(
	params: ScholarshipProposalParams,
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
}

async function castVote(params: CastVoteParams): Promise<ContractCallResult> {
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

	try {
		const {
			Keypair,
			Contract,
			TransactionBuilder,
			Networks,
			BASE_FEE,
			rpc,
			nativeToScVal,
			Address,
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
}

async function cancelProposal(
	params: CancelProposalParams,
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
}

async function getLearnTokenBalance(address: string): Promise<string> {
	if (!LEARN_TOKEN_CONTRACT_ID) {
		console.warn(
			"[stellar] LEARN_TOKEN_CONTRACT_ID not set — simulating balance",
		)
		return "10000000000" // 1000 LRN
	}
	try {
		const { Contract, Address } = await import("@stellar/stellar-sdk")
		const server = new (await import("@stellar/stellar-sdk")).rpc.Server(
			STELLAR_NETWORK === "mainnet"
				? "https://soroban-rpc.stellar.org"
				: "https://soroban-testnet.stellar.org",
		)
		const contract = new Contract(LEARN_TOKEN_CONTRACT_ID)
		const tx = new (await import("@stellar/stellar-sdk")).TransactionBuilder(
			new (await import("@stellar/stellar-sdk")).Account(
				"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBF3UKJQ2K5RQDD",
				"0",
			),
			{
				fee: "100",
				networkPassphrase:
					STELLAR_NETWORK === "mainnet"
						? (await import("@stellar/stellar-sdk")).Networks.PUBLIC
						: (await import("@stellar/stellar-sdk")).Networks.TESTNET,
			},
		)
			.addOperation(contract.call("balance", new Address(address).toScVal()))
			.setTimeout(30)
			.build()

		const simResult = await server.simulateTransaction(tx)
		if (
			(await import("@stellar/stellar-sdk")).rpc.Api.isSimulationError(
				simResult,
			)
		)
			return "0"
		const { scValToNative } = await import("@stellar/stellar-sdk")
		return scValToNative(simResult.result?.retval!).toString()
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
		const { Contract, Address } = await import("@stellar/stellar-sdk")
		const server = new (await import("@stellar/stellar-sdk")).rpc.Server(
			STELLAR_NETWORK === "mainnet"
				? "https://soroban-rpc.stellar.org"
				: "https://soroban-testnet.stellar.org",
		)
		const contract = new Contract(GOVERNANCE_TOKEN_CONTRACT_ID)
		const tx = new (await import("@stellar/stellar-sdk")).TransactionBuilder(
			new (await import("@stellar/stellar-sdk")).Account(
				"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBF3UKJQ2K5RQDD",
				"0",
			),
			{
				fee: "100",
				networkPassphrase:
					STELLAR_NETWORK === "mainnet"
						? (await import("@stellar/stellar-sdk")).Networks.PUBLIC
						: (await import("@stellar/stellar-sdk")).Networks.TESTNET,
			},
		)
			.addOperation(contract.call("balance", new Address(address).toScVal()))
			.setTimeout(30)
			.build()

		const simResult = await server.simulateTransaction(tx)
		if (
			(await import("@stellar/stellar-sdk")).rpc.Api.isSimulationError(
				simResult,
			)
		)
			return "0"
		const { scValToNative } = await import("@stellar/stellar-sdk")
		return scValToNative(simResult.result?.retval!).toString()
	} catch (err) {
		console.error("[stellar] getGovernanceTokenBalance failed:", err)
		return "0"
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
	getLearnTokenBalance,
	getGovernanceTokenBalance,
	getEnrolledCourses,
	getScholarCredentials,
}
