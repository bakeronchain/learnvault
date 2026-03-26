/**
 * Stellar contract service for triggering on-chain milestone verification.
 *
 * In production this calls the CourseMilestone contract via the Stellar SDK.
 * When STELLAR_SECRET_KEY is not configured it falls back to a simulation
 * so the rest of the API remains functional in dev/test environments.
 */

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet"
const STELLAR_SECRET_KEY = process.env.STELLAR_SECRET_KEY ?? ""
const COURSE_MILESTONE_CONTRACT_ID =
	process.env.COURSE_MILESTONE_CONTRACT_ID ?? ""
const SCHOLAR_NFT_CONTRACT_ID = process.env.SCHOLAR_NFT_CONTRACT_ID ?? ""
const SCHOLARSHIP_TREASURY_CONTRACT_ID =
	process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID ?? ""

export interface ContractCallResult {
	txHash: string | null
	simulated: boolean
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

// --- Admin Validation Cache ---
let cachedAdminAddress: string | null = null
let lastAdminCheckTime: number = 0
const ADMIN_CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds
async function ensureAdminRole(): Promise<void> {
	const { Keypair, Contract, TransactionBuilder, Networks, BASE_FEE, rpc, scValToNative } =
		await import("@stellar/stellar-sdk")

	const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY)
	const serverPubKey = keypair.publicKey()

	// 1. Check if we have a valid cached result
	if (Date.now() - lastAdminCheckTime < ADMIN_CACHE_TTL && cachedAdminAddress) {
		if (serverPubKey !== cachedAdminAddress) {
			throw new Error(`Server keypair ${serverPubKey} is not the contract admin. Update STELLAR_SECRET_KEY.`)
		}
		return
	}

	// 2. Cache expired or empty: Fetch from the blockchain
	const serverUrl = STELLAR_NETWORK === "mainnet"
		? "https://soroban-rpc.stellar.org"
		: "https://soroban-testnet.stellar.org"
	const server = new rpc.Server(serverUrl)

	const account = await server.getAccount(serverPubKey)
	const contract = new Contract(COURSE_MILESTONE_CONTRACT_ID)

	// Build a transaction solely to simulate the admin() getter
	const tx = new TransactionBuilder(account, {
		fee: BASE_FEE,
		networkPassphrase: STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
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
		throw new Error(`Server keypair ${serverPubKey} is not the contract admin. Update STELLAR_SECRET_KEY.`)
	}
}
async function callVerifyMilestone(
	scholarAddress: string,
	courseId: string,
	milestoneId: number,
): Promise<ContractCallResult> {
	if (!STELLAR_SECRET_KEY || !COURSE_MILESTONE_CONTRACT_ID) {
		console.warn(
			"[stellar] STELLAR_SECRET_KEY or COURSE_MILESTONE_CONTRACT_ID not set — simulating contract call",
		)
		return {
			txHash: `sim_${Date.now()}_${Math.random().toString(36).slice(2)}`,
			simulated: true,
		}
	}

	try {
		// Enforce access control before doing anything
		await ensureAdminRole()
		// Dynamic import so the SDK is only loaded when actually needed
		const { Keypair, Contract, TransactionBuilder, Networks, BASE_FEE, rpc } =
			await import("@stellar/stellar-sdk")

		const server = new rpc.Server(
			STELLAR_NETWORK === "mainnet"
				? "https://soroban-rpc.stellar.org"
				: "https://soroban-testnet.stellar.org",
		)

		const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY)
		const account = await server.getAccount(keypair.publicKey())
		const contract = new Contract(COURSE_MILESTONE_CONTRACT_ID)

		const { xdr } = await import("@stellar/stellar-sdk")

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
	if (!STELLAR_SECRET_KEY || !COURSE_MILESTONE_CONTRACT_ID) {
		console.warn("[stellar] Simulating rejection event emission")
		return {
			txHash: `sim_reject_${Date.now()}`,
			simulated: true,
		}
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
): Promise<ContractCallResult> {
	if (!STELLAR_SECRET_KEY || !SCHOLAR_NFT_CONTRACT_ID) {
		console.warn(
			"[stellar] STELLAR_SECRET_KEY or SCHOLAR_NFT_CONTRACT_ID not set — simulating mint",
		)
		return {
			txHash: `sim_mint_${Date.now()}_${Math.random().toString(36).slice(2)}`,
			simulated: true,
		}
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
		const { Contract, rpc, xdr, Address, Networks, TransactionBuilder } =
			await import("@stellar/stellar-sdk")
async function submitScholarshipProposal(
	params: ScholarshipProposalParams,
): Promise<ContractCallResult & { proposalId: string | null }> {
	if (!STELLAR_SECRET_KEY || !SCHOLARSHIP_TREASURY_CONTRACT_ID) {
		console.warn(
			"[stellar] STELLAR_SECRET_KEY or SCHOLARSHIP_TREASURY_CONTRACT_ID not set — simulating proposal submission",
		)
		return {
			txHash: `sim_prop_${Date.now()}`,
			proposalId: `${Math.floor(Math.random() * 1000)}`,
			simulated: true,
		}
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

		const contract = new Contract(COURSE_MILESTONE_CONTRACT_ID)

		// Use a mock account for simulation
		const mockAccount = new Address(learnerAddress).toScVal()

		const tx = new TransactionBuilder(
			{
				source: "GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBF3UKJQ2K5RQDD",
				fee: "100",
				networkPassphrase:
					STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
			},
		)
			.addOperation(
				contract.call(
					"is_enrolled",
					xdr.ScVal.scvAddress(mockAccount),
					xdr.ScVal.scvU32(courseId),
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
		const prepared = await server.prepareTransaction(tx)
		prepared.sign(keypair)

		const result = await server.sendTransaction(prepared)

		// We might need to wait for the transaction to be included in a ledger to get the result (proposal ID)
		// but for now we return the hash.
		return { txHash: result.hash, proposalId: null, simulated: false }
	} catch (err) {
		console.error("[stellar] Scholarship proposal submission failed:", err)
		throw new Error(
			"Scholarship proposal submission failed: " +
				(err instanceof Error ? err.message : String(err)),
		)
	}
}

export const stellarContractService = {
	callVerifyMilestone,
	emitRejectionEvent,
	callMintScholarNFT,
	isEnrolled,
	submitScholarshipProposal,
}

