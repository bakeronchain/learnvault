import {
	Account,
	Address,
	BASE_FEE,
	Contract,
	Keypair,
	Transaction,
	TransactionBuilder,
	rpc,
	scValToNative,
	xdr,
} from "@stellar/stellar-sdk"
import { networkPassphrase, rpcUrl } from "../contracts/util"

type AnyRecord = Record<string, unknown>

type WalletSignTransaction =
	| ((xdr: string, opts?: { networkPassphrase?: string }) => Promise<unknown>)
	| undefined

export interface AdminManagedContractState {
	contractId: string
	adminAddress?: string
	paused?: boolean
	tokenAddress?: string
	governanceTokenAddress?: string
	usdcTokenAddress?: string
}

function buildServer(): rpc.Server {
	return new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") })
}

function toArray<T>(value: unknown): T[] {
	if (Array.isArray(value)) return value as T[]
	if (!value || typeof value !== "object") return []

	const maybeVector = value as {
		length?: () => number | { toString(): string }
		get?: (index: number) => T
	}

	if (
		typeof maybeVector.length === "function" &&
		typeof maybeVector.get === "function"
	) {
		const length = Number(maybeVector.length())
		return Array.from(
			{ length: Number.isFinite(length) ? length : 0 },
			(_, i) => maybeVector.get!(i),
		)
	}

	return []
}

function toStringValue(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: undefined
}

function toBooleanValue(value: unknown): boolean | undefined {
	return typeof value === "boolean" ? value : undefined
}

function extractContractDataEntry(entry: unknown): AnyRecord | null {
	if (!entry || typeof entry !== "object") return null

	const record = entry as AnyRecord
	if (typeof record.contractData === "function") {
		return record.contractData() as AnyRecord
	}

	const nestedValue = record.val as AnyRecord | undefined
	if (nestedValue && typeof nestedValue.contractData === "function") {
		return nestedValue.contractData() as AnyRecord
	}

	return null
}

function extractInstanceStorage(contractDataEntry: AnyRecord): unknown[] {
	const contractValue =
		typeof contractDataEntry.val === "function"
			? (contractDataEntry.val() as AnyRecord)
			: null

	if (!contractValue || typeof contractValue.instance !== "function") {
		return []
	}

	const instanceValue = contractValue.instance() as AnyRecord
	if (!instanceValue || typeof instanceValue.storage !== "function") {
		return []
	}

	return toArray(instanceValue.storage())
}

function readStorageEntryValue(
	entry: unknown,
): { key: string; value: unknown } | null {
	if (!entry || typeof entry !== "object") return null

	const record = entry as AnyRecord
	if (typeof record.key !== "function" || typeof record.val !== "function") {
		return null
	}

	try {
		const key = String(scValToNative(record.key() as xdr.ScVal))
		const value = scValToNative(record.val() as xdr.ScVal)
		return { key, value }
	} catch {
		return null
	}
}

async function getContractInstanceStorage(
	contractId: string,
): Promise<Record<string, unknown>> {
	const ledgerKey = xdr.LedgerKey.contractData(
		new xdr.LedgerKeyContractData({
			contract: new Address(contractId).toScAddress(),
			key: xdr.ScVal.scvLedgerKeyContractInstance(),
			durability: xdr.ContractDataDurability.persistent(),
		}),
	)
	const response = (await buildServer().getLedgerEntries(ledgerKey)) as {
		entries?: unknown[]
	}
	const entry = response.entries?.[0]
	const contractDataEntry = extractContractDataEntry(entry)

	if (!contractDataEntry) {
		return {}
	}

	const storageEntries = extractInstanceStorage(contractDataEntry)
	const storage: Record<string, unknown> = {}

	for (const item of storageEntries) {
		const parsed = readStorageEntryValue(item)
		if (parsed) {
			storage[parsed.key] = parsed.value
		}
	}

	return storage
}

async function simulateContractCall(
	contractId: string,
	methodName: string,
	args: xdr.ScVal[] = [],
): Promise<xdr.ScVal | null> {
	const sourceAccount = new Account(Keypair.random().publicKey(), "0")
	const operation = new Contract(contractId).call(methodName, ...args)
	const transaction = new TransactionBuilder(sourceAccount, {
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

async function queryBooleanState(
	contractId: string,
	methodName: string,
): Promise<boolean | undefined> {
	try {
		const result = await simulateContractCall(contractId, methodName)
		if (!result) return undefined

		return toBooleanValue(scValToNative(result))
	} catch {
		return undefined
	}
}

function resolveSignedTransactionXdr(
	value: unknown,
	fallbackXdr: string,
): string {
	if (typeof value === "string" && value.trim()) return value
	if (!value || typeof value !== "object") return fallbackXdr

	const record = value as AnyRecord
	for (const key of ["signedTransaction", "signedTxXdr", "xdr"]) {
		const candidate = record[key]
		if (typeof candidate === "string" && candidate.trim()) {
			return candidate
		}
	}

	return fallbackXdr
}

function extractTransactionHash(
	value: unknown,
	seen = new Set<unknown>(),
): string | undefined {
	if (value == null) return undefined
	if (typeof value === "string") {
		const match = value.match(/\b[a-f0-9]{64}\b/i)
		return match?.[0]
	}
	if (typeof value !== "object" || seen.has(value)) return undefined
	seen.add(value)

	for (const nested of Object.values(value as AnyRecord)) {
		const match = extractTransactionHash(nested, seen)
		if (match) return match
	}

	return undefined
}

export async function getScholarshipTreasuryState(
	contractId: string,
): Promise<AdminManagedContractState> {
	const storage = await getContractInstanceStorage(contractId)
	const paused =
		(await queryBooleanState(contractId, "is_paused")) ??
		toBooleanValue(storage.PAUSED)

	return {
		contractId,
		adminAddress: toStringValue(storage.ADMIN),
		paused,
		governanceTokenAddress: toStringValue(storage.GOV),
		usdcTokenAddress: toStringValue(storage.USDC),
	}
}

export async function getCourseMilestoneState(
	contractId: string,
): Promise<AdminManagedContractState> {
	const storage = await getContractInstanceStorage(contractId)
	const paused =
		(await queryBooleanState(contractId, "is_paused")) ??
		toBooleanValue(storage.PAUSED)

	return {
		contractId,
		adminAddress: toStringValue(storage.ADMIN),
		paused,
		tokenAddress: toStringValue(storage.LRN_TKN),
	}
}

export async function invokeContractMethod(options: {
	contractId: string
	methodName: string
	sourceAddress: string
	signTransaction: WalletSignTransaction
	args?: xdr.ScVal[]
}): Promise<string> {
	const {
		contractId,
		methodName,
		sourceAddress,
		signTransaction,
		args = [],
	} = options

	if (!signTransaction) {
		throw new Error("Wallet does not support signing")
	}

	const sourceAccount = await buildServer().getAccount(sourceAddress)
	const transaction = new TransactionBuilder(sourceAccount, {
		fee: BASE_FEE,
		networkPassphrase,
	})
		.addOperation(new Contract(contractId).call(methodName, ...args))
		.setTimeout(30)
		.build()
	const prepared = await buildServer().prepareTransaction(transaction)
	const signed = await Promise.resolve(
		signTransaction(prepared.toXDR(), { networkPassphrase }),
	)
	const signedXdr = resolveSignedTransactionXdr(signed, prepared.toXDR())
	const response = await buildServer().sendTransaction(
		new Transaction(signedXdr, networkPassphrase),
	)

	if (response.status === "ERROR") {
		const errorResult =
			typeof response.errorResult === "string"
				? response.errorResult
				: undefined
		throw new Error(
			errorResult
				? `Transaction failed: ${errorResult}`
				: "Transaction failed to submit",
		)
	}

	return response.hash ?? extractTransactionHash(response) ?? ""
}
