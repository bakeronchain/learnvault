import {
	BASE_FEE,
	rpc,
	Transaction,
	TransactionBuilder,
	type xdr,
} from "@stellar/stellar-sdk"

export class SorobanTransactionError extends Error {
	constructor(
		message: string,
		public readonly hash?: string,
	) {
		super(message)
		this.name = "SorobanTransactionError"
	}
}

type SignTransactionFn = (
	xdr: string,
	opts?: { networkPassphrase?: string; address?: string; path?: string },
) => Promise<{ signedTxXdr: string; signerAddress?: string }>

interface PrepareAndConfirmOptions {
	operation: xdr.Operation
	address: string
	networkPassphrase: string
	rpcUrl: string
	signTransaction: SignTransactionFn
	timeout?: number
	pollInterval?: number
}

const isLocalRpcUrl = (url: string): boolean => {
	try {
		const { hostname } = new URL(url)
		return ["localhost", "127.0.0.1", "::1"].includes(hostname)
	} catch {
		return false
	}
}

export async function prepareAndConfirmTransaction({
	operation,
	address,
	networkPassphrase,
	rpcUrl,
	signTransaction,
	timeout = 30_000,
	pollInterval = 1_000,
}: PrepareAndConfirmOptions): Promise<string> {
	const server = new rpc.Server(rpcUrl, { allowHttp: isLocalRpcUrl(rpcUrl) })

	try {
		const sourceAccount = await server.getAccount(address)
		const transaction = new TransactionBuilder(sourceAccount, {
			fee: BASE_FEE,
			networkPassphrase,
		})
			.addOperation(operation)
			.setTimeout(30)
			.build()
		const prepared = await server.prepareTransaction(transaction)
		const signed = await signTransaction(prepared.toXDR(), {
			networkPassphrase,
		})

		if (!signed.signedTxXdr?.trim()) {
			throw new SorobanTransactionError(
				"Wallet signature required but not provided",
			)
		}

		const response = await server.sendTransaction(
			new Transaction(signed.signedTxXdr, networkPassphrase),
		)
		if (response.status === "ERROR") {
			throw new SorobanTransactionError("Transaction failed to submit")
		}

		const txHash = response.hash
		if (!txHash) {
			throw new SorobanTransactionError(
				"Transaction submitted but no hash was returned",
			)
		}

		const startedAt = Date.now()
		while (Date.now() - startedAt < timeout) {
			const confirmed = await server.getTransaction(txHash)
			if (confirmed.status === "SUCCESS") return txHash
			if (confirmed.status === "FAILED") {
				throw new SorobanTransactionError("Transaction failed on-chain", txHash)
			}
			await new Promise((resolve) => setTimeout(resolve, pollInterval))
		}

		throw new SorobanTransactionError(
			`Transaction confirmation timed out after ${timeout}ms`,
			txHash,
		)
	} catch (error) {
		if (error instanceof SorobanTransactionError) throw error
		throw new SorobanTransactionError(
			error instanceof Error ? error.message : "Transaction failed",
		)
	}
}
