import {
	Address,
	Contract,
	rpc,
	scValToNative,
	xdr,
} from "@stellar/stellar-sdk"
import { networkPassphrase, rpcUrl } from "../contracts/util"

function buildServer(): rpc.Server {
	return new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") })
}

function learnerScVal(address: string): xdr.ScVal {
	return new Address(address).toScVal()
}

function courseIdScVal(courseId: string): xdr.ScVal {
	return xdr.ScVal.scvString(courseId)
}

async function simulateContractCall(
	contractId: string,
	methodName: string,
	args: xdr.ScVal[],
): Promise<xdr.ScVal | null> {
	const { Keypair, TransactionBuilder, BASE_FEE, Account } =
		await import("@stellar/stellar-sdk")
	const source = new Account(Keypair.random().publicKey(), "0")
	const operation = new Contract(contractId).call(methodName, ...args)
	const transaction = new TransactionBuilder(source, {
		fee: BASE_FEE,
		networkPassphrase,
	})
		.addOperation(operation)
		.setTimeout(30)
		.build()

	const result = await buildServer().simulateTransaction(transaction)

	if (rpc.Api.isSimulationError(result)) {
		const message =
			typeof result.error === "string"
				? result.error
				: JSON.stringify(result.error)
		throw new Error(message)
	}

	return result.result?.retval ?? null
}

export async function queryIsEnrolled(
	contractId: string,
	learnerAddress: string,
	courseId: string,
): Promise<boolean> {
	const retval = await simulateContractCall(contractId, "is_enrolled", [
		learnerScVal(learnerAddress),
		courseIdScVal(courseId),
	])
	if (!retval) return false
	return Boolean(scValToNative(retval))
}

export async function submitEnrollTransaction(options: {
	contractId: string
	learnerAddress: string
	courseId: string
	signTransaction: (
		xdr: string,
		opts?: { networkPassphrase?: string },
	) => Promise<unknown>
}): Promise<string> {
	const { invokeContractMethod } = await import("../util/sorobanAdmin")
	return invokeContractMethod({
		contractId: options.contractId,
		methodName: "enroll",
		sourceAddress: options.learnerAddress,
		signTransaction: options.signTransaction,
		args: [
			learnerScVal(options.learnerAddress),
			courseIdScVal(options.courseId),
		],
	})
}
