import { useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Api } from "@stellar/stellar-sdk/rpc"
import { useContractIds } from "./useContractIds"
import { useNotification } from "./useNotification"
import { useSubscription } from "./useSubscription"
import { useWallet } from "./useWallet"

// ---------------------------------------------------------------------------
// Contract client helpers
// ---------------------------------------------------------------------------

type ContractRecord = Record<string, unknown>

/**
 * Dynamically loads the generated LearnToken contract client (or its shim).
 * Returns null if the module cannot be found at all.
 */
const loadLearnTokenClient = async (): Promise<ContractRecord | null> => {
  try {
    const mod = (await import("../contracts/learn_token")) as ContractRecord
    return (mod.default as ContractRecord) ?? mod
  } catch {
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

const BALANCE_STALE_TIME = 5 * 60 * 1000 // 5 minutes

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
  const { addNotification } = useNotification()
  const queryClient = useQueryClient()

  const targetAddress = address ?? walletAddress
  const contractReady = isDeployed(contractId)

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
      addNotification("LearnTokens minted successfully", "success")
    },

    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Mint failed"
      addNotification(message, "error")
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
