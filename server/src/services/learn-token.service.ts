import { logger } from "../lib/logger"
import { getRpcCache, CacheKey, TTL } from "../lib/rpc-cache"

const log = logger.child({ module: "learn-token" })

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet"
const STELLAR_SECRET_KEY = process.env.STELLAR_SECRET_KEY ?? ""
const LEARN_TOKEN_CONTRACT_ID = process.env.LEARN_TOKEN_CONTRACT_ID ?? ""
const SOROBAN_RPC_URL =
	process.env.SOROBAN_RPC_URL ??
	(STELLAR_NETWORK === "mainnet"
		? "https://soroban-rpc.stellar.org"
		: "https://soroban-testnet.stellar.org")

export class InsufficientLrnBalanceError extends Error {
	constructor(
		public readonly holderAddress: string,
		public readonly requested: bigint,
		public readonly available: bigint,
	) {
		super(
			`Insufficient LRN balance for ${holderAddress}: requested ${requested}, available ${available}`,
		)
		this.name = "InsufficientLrnBalanceError"
	}
}

export class SorobanRpcError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown,
	) {
		super(message)
		this.name = "SorobanRpcError"
	}
}

function isRpcFailure(err: unknown): boolean {
	const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
	return (
		msg.includes("timeout") ||
		msg.includes("etimedout") ||
		msg.includes("econnreset") ||
		msg.includes("econnrefused") ||
		msg.includes("network") ||
		msg.includes("503") ||
		msg.includes("502") ||
		msg.includes("rpc") ||
		msg.includes("soroban")
	)
}

async function resolveNetworkPassphrase(): Promise<string> {
	const { Networks } = await import("@stellar/stellar-sdk")
	return STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
}

async function getRpcServer() {
	const { rpc } = await import("@stellar/stellar-sdk")
	return new rpc.Server(SOROBAN_RPC_URL)
}

export async function getLearnTokenBalanceAtomic(
	address: string,
): Promise<bigint> {
	const cache = getRpcCache()
	const cacheKey = CacheKey.learnBalance(address)
	const cached = await cache.get(cacheKey)
	if (cached !== null) {
		try {
			return BigInt(cached)
		} catch {
			/* refetch */
		}
	}

	if (!LEARN_TOKEN_CONTRACT_ID) {
		log.warn("LEARN_TOKEN_CONTRACT_ID not set — simulating balance")
		return 10_000_000_000n
	}

	try {
		const {
			Contract,
			Address,
			rpc,
			TransactionBuilder,
			Account,
			scValToNative,
		} = await import("@stellar/stellar-sdk")
		const server = await getRpcServer()
		const contract = new Contract(LEARN_TOKEN_CONTRACT_ID)
		const passphrase = await resolveNetworkPassphrase()
		const tx = new TransactionBuilder(
			new Account(
				"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBF3UKJQ2K5RQDD",
				"0",
			),
			{
				fee: "100",
				networkPassphrase: passphrase,
			},
		)
			.addOperation(contract.call("balance", new Address(address).toScVal()))
			.setTimeout(30)
			.build()

		const simResult = await server.simulateTransaction(tx)
		if (rpc.Api.isSimulationError(simResult)) {
			throw new SorobanRpcError(
				`Balance simulation failed: ${simResult.error ?? "unknown"}`,
			)
		}

		const raw = scValToNative(simResult.result?.retval!)
		const balance = BigInt(String(raw))
		await cache.set(cacheKey, balance.toString(), TTL.BALANCE)
		return balance
	} catch (err) {
		if (err instanceof SorobanRpcError) throw err
		log.error({ err, address }, "getLearnTokenBalanceAtomic failed")
		throw new SorobanRpcError(
			"Failed to query learn_token balance",
			err,
		)
	}
}

async function submitSignedTransaction(
	signedTransactionXdr: string,
): Promise<string> {
	try {
		const { Transaction } = await import("@stellar/stellar-sdk")
		const server = await getRpcServer()
		const passphrase = await resolveNetworkPassphrase()
		const tx = new Transaction(signedTransactionXdr, passphrase)
		const result = await server.sendTransaction(tx)
		if (!result.hash) {
			throw new SorobanRpcError("Soroban RPC returned no transaction hash")
		}
		return result.hash
	} catch (err) {
		throw new SorobanRpcError(
			"Soroban RPC call failed while submitting signed burn transaction",
			err,
		)
	}
}

async function submitServerSignedBurn(
	holderAddress: string,
	amountAtomic: bigint,
): Promise<string> {
	if (!STELLAR_SECRET_KEY) {
		throw new SorobanRpcError(
			"STELLAR_SECRET_KEY not configured — cannot submit on-chain burn",
		)
	}
	if (!LEARN_TOKEN_CONTRACT_ID) {
		throw new SorobanRpcError(
			"LEARN_TOKEN_CONTRACT_ID not configured — cannot submit on-chain burn",
		)
	}

	try {
		const {
			Keypair,
			Contract,
			TransactionBuilder,
			Address,
			BASE_FEE,
			nativeToScVal,
		} = await import("@stellar/stellar-sdk")
		const server = await getRpcServer()
		const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY)

		if (keypair.publicKey() !== holderAddress) {
			throw new SorobanRpcError(
				"Burn requires a wallet-signed transaction (signed_transaction)",
			)
		}

		const account = await server.getAccount(keypair.publicKey())
		const contract = new Contract(LEARN_TOKEN_CONTRACT_ID)
		const passphrase = await resolveNetworkPassphrase()
		const tx = new TransactionBuilder(account, {
			fee: BASE_FEE,
			networkPassphrase: passphrase,
		})
			.addOperation(
				contract.call(
					"burn",
					new Address(holderAddress).toScVal(),
					nativeToScVal(amountAtomic, { type: "i128" }),
				),
			)
			.setTimeout(30)
			.build()

		const prepared = await server.prepareTransaction(tx)
		prepared.sign(keypair)
		const result = await server.sendTransaction(prepared)
		if (!result.hash) {
			throw new SorobanRpcError("Soroban RPC returned no transaction hash")
		}
		return result.hash
	} catch (err) {
		if (err instanceof SorobanRpcError) throw err
		throw new SorobanRpcError(
			"Soroban RPC call failed while invoking learn_token.burn",
			err,
		)
	}
}

export interface BurnLearnTokenParams {
	holderAddress: string
	amountAtomic: bigint
	signedTransactionXdr?: string
}

export async function burnLearnToken(
	params: BurnLearnTokenParams,
): Promise<{ txHash: string }> {
	const { holderAddress, amountAtomic, signedTransactionXdr } = params

	if (amountAtomic <= 0n) {
		throw new Error("Burn amount must be positive")
	}

	const balance = await getLearnTokenBalanceAtomic(holderAddress)
	if (balance < amountAtomic) {
		throw new InsufficientLrnBalanceError(
			holderAddress,
			amountAtomic,
			balance,
		)
	}

	let txHash: string
	if (signedTransactionXdr?.trim()) {
		txHash = await submitSignedTransaction(signedTransactionXdr.trim())
	} else {
		txHash = await submitServerSignedBurn(holderAddress, amountAtomic)
	}

	const cache = getRpcCache()
	await cache.set(
		CacheKey.learnBalance(holderAddress),
		(balance - amountAtomic).toString(),
		TTL.BALANCE,
	)

	return { txHash }
}

export function mapBurnError(err: unknown): {
	status: number
	message: string
} {
	if (err instanceof InsufficientLrnBalanceError) {
		return { status: 400, message: "Insufficient LRN balance" }
	}
	if (err instanceof SorobanRpcError || isRpcFailure(err)) {
		return { status: 502, message: "Soroban RPC call failed" }
	}
	if (err instanceof Error && err.message.includes("positive")) {
		return { status: 400, message: err.message }
	}
	return { status: 500, message: "Failed to burn LRN tokens" }
}

export const learnTokenService = {
	getLearnTokenBalanceAtomic,
	burnLearnToken,
	mapBurnError,
}
