import { useCallback, useEffect, useMemo, useState } from "react"
import {
	LEARN_TOKEN_CONTRACT,
	SCHOLARSHIP_MIN_LRN,
	SCHOLARSHIP_TREASURY_CONTRACT,
	amountToAtomicUnits,
	atomicUnitsToDisplayAmount,
	createStoredScholarshipProposal,
	parseDisplayBalance,
	readStoredScholarshipProposals,
	scholarshipApplicationSchema,
	storeScholarshipProposal,
	type ScholarshipApplicationFormValues,
	type StoredScholarshipProposal,
} from "../util/scholarshipApplications"
import { useNotification } from "./useNotification"
import { useWallet } from "./useWallet"

type AnyRecord = Record<string, unknown>
type NumberLike = bigint | number | string

type GeneratedModuleLoader = (() => Promise<unknown>) | undefined

type EligibilitySource = "contract" | "wallet" | "disconnected"

const generatedContractModules = import.meta.glob("../contracts/*.ts")

const getModuleLoader = (suffix: string): GeneratedModuleLoader =>
	Object.entries(generatedContractModules).find(([path]) =>
		path.endsWith(suffix),
	)?.[1]

const learnTokenLoader = getModuleLoader("/learn_token.ts")
const scholarshipTreasuryLoader = getModuleLoader("/scholarship_treasury.ts")

const asMethod = (
	value: unknown,
	name: string,
): ((...args: unknown[]) => unknown) | null => {
	if (!value || typeof value !== "object") return null
	const maybeMethod = (value as AnyRecord)[name]
	return typeof maybeMethod === "function"
		? (maybeMethod as (...args: unknown[]) => unknown)
		: null
}

const loadGeneratedClient = async (
	loader: GeneratedModuleLoader,
): Promise<AnyRecord | null> => {
	if (!loader) return null
	const mod = await loader()
	if (!mod || typeof mod !== "object") return null
	if ("default" in mod && mod.default && typeof mod.default === "object") {
		return mod.default as AnyRecord
	}
	return mod as AnyRecord
}

const callFirst = async (
	client: AnyRecord,
	methodNames: string[],
	argumentVariants: unknown[][],
): Promise<unknown> => {
	for (const methodName of methodNames) {
		const method = asMethod(client, methodName)
		if (!method) continue
		for (const args of argumentVariants) {
			try {
				return await Promise.resolve(method(...args))
			} catch {
				continue
			}
		}
	}
	throw new Error(`No compatible method found: ${methodNames.join(", ")}`)
}

const sendTxIfNeeded = async (
	maybeTx: unknown,
	signTransaction: ((...args: unknown[]) => unknown) | undefined,
): Promise<unknown> => {
	if (!maybeTx || typeof maybeTx !== "object") return maybeTx
	const tx = maybeTx as AnyRecord
	if (typeof tx.signAndSend === "function") {
		return (tx.signAndSend as (...args: unknown[]) => Promise<unknown>)({
			signTransaction,
		})
	}
	return maybeTx
}

const formatUnknownError = (value: unknown): string => {
	if (value instanceof Error) return value.message
	if (typeof value === "string") return value
	try {
		return JSON.stringify(value)
	} catch {
		return "Transaction failed"
	}
}

const unwrapSendResult = (value: unknown): unknown => {
	if (!value || typeof value !== "object") return value
	const maybe = value as AnyRecord
	const nestedResult = maybe.result
	if (nestedResult && typeof nestedResult === "object") {
		const typedResult = nestedResult as AnyRecord
		if (typeof typedResult.isErr === "function" && typedResult.isErr()) {
			const errorValue =
				typeof typedResult.unwrapErr === "function"
					? typedResult.unwrapErr()
					: "Transaction failed"
			throw new Error(formatUnknownError(errorValue))
		}
		if (typeof typedResult.unwrap === "function") {
			return typedResult.unwrap()
		}
	}
	if (typeof maybe.unwrap === "function") {
		return maybe.unwrap()
	}
	return value
}

const extractNumberLike = (value: unknown, depth = 0): NumberLike | null => {
	if (depth > 5 || value == null) return null
	if (typeof value === "bigint" || typeof value === "number") return value
	if (typeof value === "string") {
		const trimmed = value.trim()
		return /^-?\d+$/.test(trimmed) ? trimmed : null
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = extractNumberLike(item, depth + 1)
			if (found != null) return found
		}
		return null
	}
	if (typeof value === "object") {
		for (const key of ["value", "amount", "balance", "result", "id"]) {
			if (key in value) {
				const found = extractNumberLike((value as AnyRecord)[key], depth + 1)
				if (found != null) return found
			}
		}
		for (const nested of Object.values(value as AnyRecord)) {
			const found = extractNumberLike(nested, depth + 1)
			if (found != null) return found
		}
	}
	return null
}

const extractProposalId = (value: unknown, depth = 0): number | null => {
	if (depth > 5 || value == null) return null
	if (typeof value === "number" && Number.isInteger(value)) return value
	if (
		typeof value === "bigint" &&
		value <= BigInt(Number.MAX_SAFE_INTEGER) &&
		value >= BigInt(Number.MIN_SAFE_INTEGER)
	) {
		return Number(value)
	}
	if (typeof value === "string" && /^\d+$/.test(value.trim())) {
		return Number(value)
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = extractProposalId(item, depth + 1)
			if (found != null) return found
		}
		return null
	}
	if (typeof value === "object") {
		for (const key of ["proposalId", "proposal_id", "id", "value"]) {
			if (key in value) {
				const found = extractProposalId((value as AnyRecord)[key], depth + 1)
				if (found != null) return found
			}
		}
		for (const nested of Object.values(value as AnyRecord)) {
			const found = extractProposalId(nested, depth + 1)
			if (found != null) return found
		}
	}
	return null
}

const HEX_HASH_PATTERN = /\b[a-f0-9]{64}\b/i

const extractTransactionHash = (
	value: unknown,
	seen = new Set<unknown>(),
): string | undefined => {
	if (value == null) return undefined
	if (typeof value === "string") {
		return HEX_HASH_PATTERN.test(value)
			? value.match(HEX_HASH_PATTERN)?.[0]
			: undefined
	}
	if (typeof value !== "object") return undefined
	if (seen.has(value)) return undefined
	seen.add(value)
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = extractTransactionHash(item, seen)
			if (found) return found
		}
		return undefined
	}
	for (const nested of Object.values(value as AnyRecord)) {
		const found = extractTransactionHash(nested, seen)
		if (found) return found
	}
	return undefined
}

const fallbackProposalId = () => `${Date.now()}`

export const useScholarshipApplication = () => {
	const { address, balances, signTransaction } = useWallet()
	const { addNotification } = useNotification()
	const [isCheckingEligibility, setIsCheckingEligibility] = useState(false)
	const [eligibilityBalance, setEligibilityBalance] = useState(0)
	const [eligibilitySource, setEligibilitySource] =
		useState<EligibilitySource>("disconnected")
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [latestSubmittedProposal, setLatestSubmittedProposal] =
		useState<StoredScholarshipProposal | null>(null)

	const walletLrnBalance = useMemo(() => {
		const line = Object.values(balances).find(
			(balance) =>
				"asset_code" in balance &&
				typeof balance.asset_code === "string" &&
				balance.asset_code.toUpperCase() === "LRN",
		)
		return parseDisplayBalance(line?.balance)
	}, [balances])

	const refreshEligibility = useCallback(async () => {
		if (!address) {
			setEligibilityBalance(0)
			setEligibilitySource("disconnected")
			return
		}

		setIsCheckingEligibility(true)
		try {
			const client = await loadGeneratedClient(learnTokenLoader)
			if (client && LEARN_TOKEN_CONTRACT) {
				const rawBalance = await callFirst(
					client,
					["balance", "balance_of", "balanceOf", "get_balance", "getBalance"],
					[
						[{ account: address }],
						[{ owner: address }],
						[{ user: address }],
						[{ account: address }, { publicKey: address }],
						[address],
					],
				)
				const resolved = unwrapSendResult(rawBalance)
				const numericValue = extractNumberLike(resolved)
				if (numericValue != null) {
					setEligibilityBalance(atomicUnitsToDisplayAmount(numericValue))
					setEligibilitySource("contract")
					return
				}
			}
		} catch {
			// fall through to the wallet balance fallback
		} finally {
			setIsCheckingEligibility(false)
		}

		setEligibilityBalance(walletLrnBalance)
		setEligibilitySource("wallet")
	}, [address, walletLrnBalance])

	useEffect(() => {
		void refreshEligibility()
	}, [refreshEligibility])

	useEffect(() => {
		if (!address) {
			setLatestSubmittedProposal(null)
			return
		}
		setLatestSubmittedProposal(
			readStoredScholarshipProposals().find(
				(proposal) => proposal.applicant === address,
			) ?? null,
		)
	}, [address])

	const eligible = eligibilityBalance >= SCHOLARSHIP_MIN_LRN
	const lrnGap = Math.max(0, SCHOLARSHIP_MIN_LRN - eligibilityBalance)

	const submitApplication = useCallback(
		async (
			values: ScholarshipApplicationFormValues,
		): Promise<StoredScholarshipProposal> => {
			if (!address) {
				throw new Error(
					"Connect your wallet before submitting a scholarship proposal",
				)
			}

			const parsed = scholarshipApplicationSchema.parse(values)
			if (eligibilityBalance < SCHOLARSHIP_MIN_LRN) {
				throw new Error(
					`You need at least ${SCHOLARSHIP_MIN_LRN} LRN before you can apply`,
				)
			}

			setIsSubmitting(true)
			try {
				let source: StoredScholarshipProposal["source"] = "local-fallback"
				let proposalId = fallbackProposalId()
				let txHash: string | undefined

				const response = await fetch("/api/scholarships/apply", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						applicant_address: address,
						full_name: parsed.programName,
						course_id: "Scholarship", // Default or extracted
						motivation: parsed.programDescription,
						evidence_url: parsed.programUrl,
					}),
				})

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}))
					throw new Error(errorData.error || "Failed to submit application to backend")
				}

				const result = await response.json()
				proposalId = String(result.proposal_id || fallbackProposalId())
				txHash = result.tx_hash
				source = txHash ? "on-chain" : "local-fallback"

				const proposal = createStoredScholarshipProposal(parsed, {
					applicant: address,
					proposalId,
					source,
					txHash,
				})
				storeScholarshipProposal(proposal)
				setLatestSubmittedProposal(proposal)
				addNotification(
					source === "on-chain"
						? "Scholarship proposal submitted successfully"
						: "Scholarship proposal saved in local fallback mode",
					source === "on-chain" ? "success" : "warning",
				)
				return proposal
			} catch (error) {
				const message = formatUnknownError(error)
				addNotification(message, "error")
				throw error
			} finally {
				setIsSubmitting(false)
			}
		},
		[address, addNotification, eligibilityBalance, signTransaction],
	)

	return {
		eligible,
		eligibilityBalance,
		eligibilitySource,
		isCheckingEligibility,
		isSubmitting,
		latestSubmittedProposal,
		lrnGap,
		minLrnRequired: SCHOLARSHIP_MIN_LRN,
		refreshEligibility,
		submitApplication,
	}
}
