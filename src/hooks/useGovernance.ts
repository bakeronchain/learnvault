import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { useWallet } from "./useWallet"

export interface Proposal {
	id: number
	title: string
	description: string
	author: string
	status: "Active" | "Passed" | "Rejected"
	votesFor: bigint
	votesAgainst: bigint
	endDate: number // timestamp
}

const readEnv = (key: string): string | undefined => {
	const value = (import.meta.env as Record<string, unknown>)[key]
	return typeof value === "string" && value.length ? value : undefined
}

const SCHOLARSHIP_TREASURY_CONTRACT = readEnv(
	"PUBLIC_SCHOLARSHIP_TREASURY_CONTRACT",
)
const GOVERNANCE_TOKEN_CONTRACT = readEnv("PUBLIC_GOVERNANCE_TOKEN_CONTRACT")

/**
 * Hook to manage governance interactions: reading proposals, voting power, and casting votes.
 */
export function useGovernance() {
	const { address, signTransaction } = useWallet()
	const queryClient = useQueryClient()

	// Helper to load contract clients
	const loadClient = useCallback(async (path: string) => {
		try {
			const mod = (await import(/* @vite-ignore */ path)) as Record<
				string,
				unknown
			>
			return (mod.default as Record<string, unknown>) ?? mod
		} catch {
			return null
		}
	}, [])

	// Fetch voting power (GOV token balance)
	const { data: votingPower = 0n } = useQuery({
		queryKey: ["governance", "votingPower", address],
		queryFn: async () => {
			if (!address || !GOVERNANCE_TOKEN_CONTRACT) return 0n
			const client = await loadClient("../contracts/governance_token")
			if (!client) return 0n

			// Standard Soroban token 'balance' call
			const balanceFn =
				(client.balance as Function) || (client.get_balance as Function)
			if (typeof balanceFn !== "function") return 0n

			const res = await balanceFn({ id: address, user: address })
			return typeof res === "bigint" ? res : BigInt(res)
		},
		enabled: !!address,
	})

	// Fetch all proposals
	const { data: proposals = [] } = useQuery<Proposal[]>({
		queryKey: ["governance", "proposals"],
		queryFn: async () => {
			if (!SCHOLARSHIP_TREASURY_CONTRACT) return []
			const client = await loadClient("../contracts/scholarship_treasury")
			if (!client) return []

			const getProposalsFn =
				(client.get_proposals as Function) || (client.getProposals as Function)
			if (typeof getProposalsFn !== "function") return []

			const raw = await getProposalsFn()
			// Transform contract response to Proposal interface
			return (Array.isArray(raw) ? raw : []).map((p: any) => ({
				id: Number(p.id ?? 0),
				title: String(p.title ?? ""),
				description: String(p.description ?? ""),
				author: String(p.author ?? p.author_address ?? ""),
				status: (p.status ?? "Active") as Proposal["status"],
				votesFor: BigInt(p.votes_for ?? p.votesFor ?? 0),
				votesAgainst: BigInt(p.votes_against ?? p.votesAgainst ?? 0),
				endDate: Number(p.end_date ?? p.endDate ?? 0),
			}))
		},
	})

	// Check if voter has already voted on a specific proposal
	const hasVoted = useCallback(
		(proposalId: number) => {
			// This could also be a query, but for the requested API we can check cache or fetch.
			// Let's assume we fetch this info or it's part of the proposal list.
			// Implementing as a query-backed check.
			return !!queryClient.getQueryData([
				"governance",
				"voted",
				proposalId,
				address,
			])
		},
		[address, queryClient],
	)

	// Fetch individual 'voted' status for each proposal
	useQuery({
		queryKey: ["governance", "voted", address],
		queryFn: async () => {
			if (!address || !SCHOLARSHIP_TREASURY_CONTRACT || proposals.length === 0)
				return {}
			const client = await loadClient("../contracts/scholarship_treasury")
			if (!client) return {}

			const hasVotedFn =
				(client.has_voted as Function) || (client.hasVoted as Function)
			if (typeof hasVotedFn !== "function") return {}

			const results: Record<number, boolean> = {}
			await Promise.all(
				proposals.map(async (p) => {
					try {
						const voted = await hasVotedFn({
							voter: address,
							proposal_id: p.id,
							proposalId: p.id,
						})
						results[p.id] = !!voted
						// Also update the individual cache
						queryClient.setQueryData(
							["governance", "voted", p.id, address],
							!!voted,
						)
					} catch {
						results[p.id] = false
					}
				}),
			)
			return results
		},
		enabled: !!address && proposals.length > 0,
	})

	// Mutation for casting a vote
	const { mutateAsync: vote, isPending: isVoting } = useMutation({
		mutationFn: async ({
			proposalId,
			support,
		}: {
			proposalId: number
			support: boolean
		}) => {
			if (!address) throw new Error("Wallet not connected")
			if (!SCHOLARSHIP_TREASURY_CONTRACT)
				throw new Error("Contract not configured")

			const client = await loadClient("../contracts/scholarship_treasury")
			if (!client) throw new Error("Contract client not found")

			const voteFn = (client.vote as Function) || (client.cast_vote as Function)
			if (typeof voteFn !== "function") throw new Error("Vote method not found")

			const tx = await voteFn(
				{
					proposal_id: proposalId,
					proposalId: proposalId,
					voter: address,
					support,
				},
				{ publicKey: address },
			)

			// signAndSend is expected on the tx object from generated clients
			if (tx && typeof tx.signAndSend === "function") {
				await tx.signAndSend({ signTransaction })
			}
		},
		onSuccess: (_, { proposalId }) => {
			// Invalidate queries to refresh UI
			void queryClient.invalidateQueries({
				queryKey: ["governance", "proposals"],
			})
			void queryClient.invalidateQueries({ queryKey: ["governance", "voted"] })
			// Optimistically update the specific voted status
			queryClient.setQueryData(
				["governance", "voted", proposalId, address],
				true,
			)
		},
	})

	return {
		votingPower,
		proposals,
		vote: (proposalId: number, support: boolean) =>
			vote({ proposalId, support }),
		isVoting,
		hasVoted,
	}
}
