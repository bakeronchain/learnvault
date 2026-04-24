import { type Api } from "@stellar/stellar-sdk/rpc"
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query"
import { useCallback } from "react"
import { useToast } from "../components/Toast/ToastProvider"
import { type LearnTokenInfo } from "../types/contracts"
import { ErrorCode, createAppError } from "../types/errors"
import { parseError, isUserRejection } from "../utils/errors"
import { logger } from "../utils/logger"
import { useContractIds } from "./useContractIds"
import { useSubscription } from "./useSubscription"
import { useWallet } from "./useWallet"

// ---------------------------------------------------------------------------
// Contract client helpers
// ---------------------------------------------------------------------------

type ContractRecord = Record<string, unknown>

const generatedContractModules = import.meta.glob("../contracts/*.ts")

/**
 * Dynamically loads the generated LearnToken contract client (or its shim).
 * Returns null if the module cannot be found at all.
 */
const loadLearnTokenClient = async (): Promise<ContractRecord | null> => {
	const moduleLoader = generatedContractModules["../contracts/learn_token.ts"]
	if (!moduleLoader) {
		logger.warn(
			createAppError(
				ErrorCode.CONTRACT_NOT_DEPLOYED,
				"LearnToken contract module not found",
				{ contractName: "learn_token" },
			),
		)
		return null
	}

	try {
		const mod = (await moduleLoader()) as ContractRecord

		return (mod.default as ContractRecord) ?? mod
	} catch (err) {
		logger.warn(
			createAppError(
				ErrorCode.CONTRACT_NOT_DEPLOYED,
				"Failed to load LearnToken contract",
				{ contractName: "learn_token" },
				err,
			),
		)
		return null
	}
}

const toMethod = (
	client: ContractRecord,
	name: string,
): ((...args: unknown[]) => Promise<unknown>) | null => {
	const fn = client[name]
	return typeof fn === "function"
		? (fn as (...args: unknown[]) => Promise<unknown>)
		: null
}

/**
 * Unwraps the `.result` property that the Soroban SDK adds to simulation
 * responses. Falls back to the raw value when `.result` is absent.
 */
const unwrapResult = (raw: unknown): unknown => {
	if (raw !== null && typeof raw === "object") {
		const obj = raw as ContractRecord
		if ("result" in obj) return obj.result
	}
	return raw
}

const toBigInt = (value: unknown): bigint => {
	if (typeof value === "bigint") return value
	if (typeof value === "number" && Number.isFinite(value))
		return BigInt(Math.trunc(value))
	if (typeof value === "string") {
		try {
			return BigInt(value)
		} catch {
			/* fall through */
		}
	}
	return 0n
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Prefix used to invalidate all balance entries at once (e.g. after any mint).
const BALANCE_QUERY_KEY_PREFIX = ["learnToken", "balance"] as const

const BALANCE_STALE_TIME = 30 * 1000 // 30 seconds

// The expected contract version this client was generated against.
const EXPECTED_CONTRACT_VERSION = "1.0.0"

// The LearnToken contract emits a MilestoneCompleted event. Soroban encodes
// the first topic as a Symbol from the #[contractevent] struct name. The SDK
// uses symbol_short! which is capped at 9 chars, so the actual on-chain topic
// is "mint" — the short prefix the contract function is known by.
// Adjust here if introspecting the deployed contract shows a different value.
const MINT_EVENT_TOPIC = "mint"

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface UseLearnTokenResult {
	/** Learner's LRN balance. `undefined` when no wallet is connected. */
	balance: bigint | undefined
	isLoading: boolean
	/**
	 * Mint LRN tokens to `to`. Admin-only on the contract side.
	 * `courseId` is required by the on-chain `mint(to, amount, course_id)` call.
	 */
	mint: (to: string, amount: bigint, courseId: string) => Promise<void>
	isMinting: boolean
}

/**
 * Encapsulates all LearnToken contract interactions.
 *
 * @param address - Override the address whose balance is read. Defaults to
 *                  the connected wallet address.
 */
export function useLearnToken(address?: string): UseLearnTokenResult {
	const { address: walletAddress, signTransaction } = useWallet()
	const { learnToken: contractId, isDeployed } = useContractIds()
	const { showSuccess, showError, showInfo } = useToast()
	const queryClient = useQueryClient()

	const targetAddress = address ?? walletAddress
	const contractReady = isDeployed(contractId)

	// ---------------------------------------------------------------------------
	// Version check — warn if deployed contract version doesn't match expected
	// ---------------------------------------------------------------------------

	useQuery({
		queryKey: ["learnToken", "version", contractId],
		queryFn: async (): Promise<string | null> => {
			const client = await loadLearnTokenClient()
			if (!client || !contractReady) return null

			const fn = toMethod(client, "get_version")
			if (!fn) return null

			try {
				const raw = await fn({})
				const version = String(unwrapResult(raw) ?? "")
				if (version && version !== EXPECTED_CONTRACT_VERSION) {
					logger.warn(
						`[LearnToken] Version mismatch: expected ${EXPECTED_CONTRACT_VERSION}, got ${version}. ` +
							"Client bindings may be out of date.",
					)
				}
				return version
			} catch {
				return null
			}
		},
		enabled: contractReady,
		staleTime: Infinity,
	})

	// ---------------------------------------------------------------------------
	// Balance query
	// ---------------------------------------------------------------------------

	const balanceQueryKey = [...BALANCE_QUERY_KEY_PREFIX, targetAddress] as const

	const { data: balance, isLoading } = useQuery({
		queryKey: balanceQueryKey,
		queryFn: async (): Promise<bigint> => {
			const client = await loadLearnTokenClient()
			if (!client || !contractReady) return 0n

			const fn = toMethod(client, "balance")
			if (!fn) return 0n

			const raw = await fn({ account: targetAddress, id: targetAddress })

			// The shim's errResult signals that the generated client is not yet
			// available; degrade gracefully to zero rather than surfacing an error.
			const resolved = unwrapResult(raw)
			if (
				resolved !== null &&
				typeof resolved === "object" &&
				typeof (resolved as ContractRecord).isErr === "function" &&
				((resolved as ContractRecord).isErr as () => boolean)()
			) {
				return 0n
			}

			return toBigInt(resolved)
		},
		// Only fetch when there is an address to look up.
		enabled: targetAddress !== undefined,
		staleTime: BALANCE_STALE_TIME,
	})

	// ---------------------------------------------------------------------------
	// Real-time refresh via mint events
	// ---------------------------------------------------------------------------

	const onMintEvent = useCallback(
		(_event: Api.EventResponse): void => {
			// Invalidate all balance entries so the leaderboard, profile, etc.
			// all pick up the new balance without waiting for the stale timer.
			void queryClient.invalidateQueries({ queryKey: BALANCE_QUERY_KEY_PREFIX })
		},
		[queryClient],
	)

	// contractId falls back to "" (no-op) when the contract is not yet deployed.
	useSubscription(contractId ?? "", MINT_EVENT_TOPIC, onMintEvent)

	// ---------------------------------------------------------------------------
	// Mint mutation (admin only)
	// ---------------------------------------------------------------------------

	const { mutateAsync, isPending: isMinting } = useMutation({
		mutationFn: async ({
			to,
			amount,
			courseId,
		}: {
			to: string
			amount: bigint
			courseId: string
		}): Promise<void> => {
			const client = await loadLearnTokenClient()
			if (!client || !contractReady) {
				throw new Error("LearnToken contract is not deployed")
			}

			const fn = toMethod(client, "mint")
			if (!fn) throw new Error("mint method not found on LearnToken client")

			// The generated Soroban client returns a transaction builder object;
			// the shim returns the same shape with signAndSend always throwing.
			const rawTx = await fn(
				{ to, amount, course_id: courseId },
				{ publicKey: walletAddress ?? "" },
			)

			if (
				rawTx !== null &&
				typeof rawTx === "object" &&
				typeof (rawTx as ContractRecord).signAndSend === "function"
			) {
				await (
					(rawTx as ContractRecord).signAndSend as (opts: {
						signTransaction: typeof signTransaction
					}) => Promise<unknown>
				)({ signTransaction })
			}
		},

		onSuccess: () => {
			// Eagerly invalidate so callers see the updated balance immediately.
			void queryClient.invalidateQueries({ queryKey: BALANCE_QUERY_KEY_PREFIX })
			showSuccess("LearnTokens minted successfully")
		},

		onError: (error: unknown) => {
			if (isUserRejection(error)) {
				showInfo("Mint cancelled")
				return
			}
			const appError = parseError(error)
			const message =
				appError.code === ErrorCode.CONTRACT_NOT_DEPLOYED
					? "LearnToken contract is not available on this network"
					: appError.code === ErrorCode.WALLET_NOT_CONNECTED
						? "Please connect your wallet to mint tokens"
						: "Mint failed. Please try again."
			showError(message)
		},
	})

	const mint = useCallback(
		async (to: string, amount: bigint, courseId: string): Promise<void> => {
			await mutateAsync({ to, amount, courseId })
		},
		[mutateAsync],
	)

	// ---------------------------------------------------------------------------
	// Return value
	// ---------------------------------------------------------------------------

	return {
		// Explicitly return undefined (not 0n) when there is no wallet, so callers
		// can distinguish "not connected" from "connected but zero balance".
		balance: targetAddress === undefined ? undefined : balance,
		isLoading,
		mint,
		isMinting,
	}
}

/**
 * Sum of LRN across several Stellar addresses. Uses the same query keys as
 * {@link useLearnToken} so the balance cache is shared.
 */
export function useLrnTotalForLinkedWallets(addresses: string[]) {
	const { learnToken: contractId, isDeployed } = useContractIds()
	const contractReady = isDeployed(contractId)

	const results = useQueries({
		queries: addresses.map((targetAddress) => ({
			queryKey: [...BALANCE_QUERY_KEY_PREFIX, targetAddress] as const,
			queryFn: async (): Promise<bigint> => {
				const client = await loadLearnTokenClient()
				if (!client || !contractReady) return 0n

				const fn = toMethod(client, "balance")
				if (!fn) return 0n

				const raw = await fn({ account: targetAddress, id: targetAddress })
				const resolved = unwrapResult(raw)
				if (
					resolved !== null &&
					typeof resolved === "object" &&
					typeof (resolved as ContractRecord).isErr === "function" &&
					((resolved as ContractRecord).isErr as () => boolean)()
				) {
					return 0n
				}

				return toBigInt(resolved)
			},
			enabled: contractReady && targetAddress.length > 0,
			staleTime: BALANCE_STALE_TIME,
		})),
	})

	const isLoading = results.some((r) => r.isLoading)
	const total = results.reduce((acc, r) => acc + toBigInt(r.data), 0n)

	return { total, isLoading }
}
