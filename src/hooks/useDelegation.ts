import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { useToast } from "../components/Toast/ToastProvider"
import { useWallet } from "./useWallet"

const API_BASE = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000"

const STELLAR_ADDRESS_RE = /^G[A-Z0-9]{55}$/

interface DelegationState {
	address: string
	delegatee: string | null
	is_delegating: boolean
	own_balance: string
	delegated_to_me: string
	voting_power: string
}

async function fetchDelegation(address: string): Promise<DelegationState> {
	const res = await fetch(`${API_BASE}/api/governance/delegation/${address}`)
	if (!res.ok) {
		const payload = (await res.json().catch(() => ({}))) as { error?: string }
		throw new Error(payload.error ?? "Failed to fetch delegation state")
	}
	return res.json() as Promise<DelegationState>
}

export function useDelegation() {
	const { address, signTransaction } = useWallet()
	const queryClient = useQueryClient()
	const { showSuccess, showError, showInfo } = useToast()

	const queryKey = ["delegation", address]

	const { data, isLoading, error, refetch } = useQuery({
		queryKey,
		queryFn: () => fetchDelegation(address!),
		enabled: Boolean(address),
		staleTime: 30_000,
	})

	const loadClient = useCallback(async () => {
		try {
			const mod = (await import(
				/* @vite-ignore */ "../contracts/governance_token"
			)) as Record<string, unknown>
			return (mod.default as Record<string, unknown>) ?? mod
		} catch {
			return null
		}
	}, [])

	const delegateMutation = useMutation({
		mutationFn: async (delegatee: string) => {
			if (!address)
				throw new Error(
					"Wallet not connected — connect your wallet to delegate.",
				)
			if (!STELLAR_ADDRESS_RE.test(delegatee))
				throw new Error("Enter a valid Stellar address starting with G.")
			if (delegatee === address)
				throw new Error("You cannot delegate to yourself.")

			const client = await loadClient()
			if (!client)
				throw new Error(
					"Governance token contract not available on this network.",
				)

			const delegateFn = client.delegate as
				| ((...args: unknown[]) => Promise<unknown>)
				| undefined
			if (typeof delegateFn !== "function")
				throw new Error(
					"delegate() method not found — contract client may be a stub.",
				)

			const tx = await delegateFn(
				{ delegator: address, delegatee },
				{ publicKey: address },
			)

			if (
				tx &&
				typeof tx === "object" &&
				typeof (tx as Record<string, unknown>).signAndSend === "function"
			) {
				showInfo("Waiting for wallet approval…")
				await (
					tx as { signAndSend: (opts: unknown) => Promise<unknown> }
				).signAndSend({ signTransaction })
			}
		},
		onSuccess: (_: void, delegatee: string) => {
			showSuccess(
				`Voting power delegated to ${delegatee.slice(0, 6)}…${delegatee.slice(-4)}`,
			)
			void queryClient.invalidateQueries({ queryKey })
			void queryClient.invalidateQueries({
				queryKey: ["proposals", "votingPower", address],
			})
		},
		onError: (err: unknown) => {
			showError(
				err instanceof Error
					? err.message
					: "Delegation failed. Please try again.",
			)
		},
	})

	const undelegateMutation = useMutation({
		mutationFn: async () => {
			if (!address)
				throw new Error(
					"Wallet not connected — connect your wallet to undelegate.",
				)

			const client = await loadClient()
			if (!client)
				throw new Error(
					"Governance token contract not available on this network.",
				)

			const undelegateFn = client.undelegate as
				| ((...args: unknown[]) => Promise<unknown>)
				| undefined
			if (typeof undelegateFn !== "function")
				throw new Error(
					"undelegate() method not found — contract client may be a stub.",
				)

			const tx = await undelegateFn(
				{ delegator: address },
				{ publicKey: address },
			)

			if (
				tx &&
				typeof tx === "object" &&
				typeof (tx as Record<string, unknown>).signAndSend === "function"
			) {
				showInfo("Waiting for wallet approval…")
				await (
					tx as { signAndSend: (opts: unknown) => Promise<unknown> }
				).signAndSend({ signTransaction })
			}
		},
		onSuccess: () => {
			showSuccess("Delegation removed — your voting power is fully restored.")
			void queryClient.invalidateQueries({ queryKey })
			void queryClient.invalidateQueries({
				queryKey: ["proposals", "votingPower", address],
			})
		},
		onError: (err: unknown) => {
			showError(
				err instanceof Error
					? err.message
					: "Failed to remove delegation. Please try again.",
			)
		},
	})

	return {
		delegatee: data?.delegatee ?? null,
		isDelegating: data?.is_delegating ?? false,
		ownBalance: data?.own_balance ?? "0",
		delegatedToMe: data?.delegated_to_me ?? "0",
		votingPower: data?.voting_power ?? "0",
		isLoading,
		error,
		refetch,
		delegateTo: (delegatee: string) => delegateMutation.mutateAsync(delegatee),
		undelegate: () => undelegateMutation.mutateAsync(),
		isDelegating_: delegateMutation.isPending,
		isUndelegating: undelegateMutation.isPending,
		isUpdating: delegateMutation.isPending || undelegateMutation.isPending,
	}
}
