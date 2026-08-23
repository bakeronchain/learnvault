import { Contract, nativeToScVal } from "@stellar/stellar-sdk"
import { prepareAndConfirmTransaction } from "./soroban-transaction"

export class GovernanceTokenError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "GovernanceTokenError"
	}
}

type SignTransactionFn = (
	xdr: string,
	opts?: { networkPassphrase?: string; address?: string; path?: string },
) => Promise<{ signedTxXdr: string; signerAddress?: string }>

interface DelegateParams {
	contractId: string
	delegator: string
	delegatee: string
	networkPassphrase: string
	rpcUrl: string
	signTransaction: SignTransactionFn
	timeout?: number
}

export async function delegate({
	contractId,
	delegator,
	delegatee,
	networkPassphrase,
	rpcUrl,
	signTransaction,
	timeout,
}: DelegateParams): Promise<string> {
	try {
		const contract = new Contract(contractId)
		const operation = contract.call(
			"delegate",
			nativeToScVal(delegator, { type: "address" }),
			nativeToScVal(delegatee, { type: "address" }),
		)

		return await prepareAndConfirmTransaction({
			operation,
			address: delegator,
			networkPassphrase,
			rpcUrl,
			signTransaction,
			timeout,
		})
	} catch (error) {
		throw new GovernanceTokenError(
			error instanceof Error ? error.message : "Failed to delegate",
		)
	}
}
