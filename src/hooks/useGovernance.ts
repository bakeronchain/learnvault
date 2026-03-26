import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { useToast } from "../components/Toast/ToastProvider"
import { ErrorCode, createAppError } from "../types/errors"
import { type Proposal, type RawContractProposal } from "../types/governance"
import { isUserRejection, parseError } from "../utils/errors"
import { useWallet } from "./useWallet"

export type { Proposal }

type ContractRecord = Record<string, unknown>

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
	const { showSuccess, showError, showInfo } = useToast()

	const asMethod = useCallback(
		(
			client: ContractRecord | null,
			...names: string[]
		): ((...args: unknown[]) => Promise<unknown>) | null => {
			if (!client) return null
			for (const name of names) {
				const maybeMethod = client[name]
				if (typeof maybeMethod === "function") {
					return maybeMethod as (...args: unknown[]) => Promise<unknown>
				}
			}
			return null
		},
		[],
	)

	const unwrapResult = useCallback((value: unknown): unknown => {
		if (!value || typeof value !== "object") return value
		const result = (value as ContractRecord).result
		return result ?? value
	}, [])

	const isErrResult = useCallback((value: unknown): boolean => {
		if (!value || typeof value !== "object") return false
		const maybe = value as ContractRecord
		return typeof maybe.isErr === "function" && maybe.isErr()
	}, [])

	const toBigIntSafe = useCallback(
		(value: unknown): bigint => {
			const resolved = unwrapResult(value)
			if (isErrResult(resolved)) return 0n
			if (typeof resolved === "bigint") return resolved
			if (typeof resolved === "number" && Number.isFinite(resolved)) {
				return BigInt(Math.trunc(resolved))
			}
			if (typeof resolved === "string") {
				try {
					return BigInt(resolved)
				} catch {
					return 0n
				}
			}
			return 0n
		},
		[isErrResult, unwrapResult],
	)

	const toProposalStatus = useCallback(
		(status: unknown): Proposal["status"] => {
			const normalized = String(status ?? "Pending").toLowerCase()
			if (normalized === "approved" || normalized === "passed") return "Passed"
			if (normalized === "rejected") return "Rejected"
			return "Active"
		},
		[],
	)

	const mapProposal = useCallback(
		(
			rawProposal: RawContractProposal,
			fallbackStatus: Proposal["status"],
		): Proposal => ({
			id: Number(rawProposal.id ?? 0),
			title: String(rawProposal.program_name ?? rawProposal.title ?? ""),
			description: String(
				rawProposal.program_description ?? rawProposal.description ?? "",
			),
			author: String(
				rawProposal.applicant ??
					rawProposal.author ??
					rawProposal.author_address ??
					"",
			),
			status: toProposalStatus(rawProposal.status ?? fallbackStatus),
			votesFor: toBigIntSafe(
				rawProposal.yes_votes ??
					rawProposal.votes_for ??
					rawProposal.votesFor ??
					0,
			),
			votesAgainst: toBigIntSafe(
				rawProposal.no_votes ??
					rawProposal.votes_against ??
					rawProposal.votesAgainst ??
					0,
			),
			endDate: Number(
				rawProposal.deadline_ledger ??
					rawProposal.end_date ??
					rawProposal.endDate ??
					0,
			),
		}),
		[toBigIntSafe, toProposalStatus],
	)

	const readContractArray = useCallback(
		async (
			client: ContractRecord | null,
			methodNames: string[],
			argumentVariants: unknown[][],
		): Promise<unknown[]> => {
			for (const methodName of methodNames) {
				const method = asMethod(client, methodName)
				if (!method) continue
				for (const args of argumentVariants) {
					try {
						const raw = await method(...args)
						const resolved = unwrapResult(raw)
						if (Array.isArray(resolved)) return resolved
					} catch {
						continue
					}
				}
			}
			return []
		},
		[asMethod, unwrapResult],
	)

	const sendTxIfNeeded = useCallback(
		async (value: unknown): Promise<unknown> => {
			if (!value || typeof value !== "object") return value
			const maybeTx = value as ContractRecord
			if (typeof maybeTx.signAndSend !== "function") return value
			return maybeTx.signAndSend({ signTransaction })
		},
		[signTransaction],
	)

	const unwrapSendResult = useCallback(
		(value: unknown): unknown => {
			const resolved = unwrapResult(value)
			if (isErrResult(resolved)) {
				const maybeUnwrapErr = (resolved as ContractRecord).unwrapErr
				const errorValue =
					typeof maybeUnwrapErr === "function"
						? (maybeUnwrapErr as () => unknown)()
						: new Error("Transaction failed")
				throw errorValue instanceof Error
					? errorValue
					: new Error(String(errorValue))
			}
			if (
				resolved &&
				typeof resolved === "object" &&
				typeof (resolved as ContractRecord).unwrap === "function"
			) {
				const maybeUnwrap = (resolved as ContractRecord).unwrap as
					| (() => unknown)
					| undefined
				return maybeUnwrap ? maybeUnwrap() : resolved
			}
			return resolved
		},
		[isErrResult, unwrapResult],
	)

	const toBooleanSafe = useCallback(
		(value: unknown): boolean => {
			const resolved = unwrapResult(value)
			if (typeof resolved === "boolean") return resolved
			if (typeof resolved === "number") return resolved !== 0
			if (typeof resolved === "string") {
				const normalized = resolved.trim().toLowerCase()
				return (
					normalized === "true" || normalized === "yes" || normalized === "for"
				)
			}
			if (resolved && typeof resolved === "object") {
				const maybe = resolved as ContractRecord
				if (typeof maybe.support === "boolean") return maybe.support
				if (typeof maybe.vote === "boolean") return maybe.vote
				if (typeof maybe.value === "boolean") return maybe.value
			}
			return false
		},
		[unwrapResult],
	)

	// Helper to load contract clients
	const loadClient = useCallback(async (path: string) => {
		try {
			const mod = (await import(/* @vite-ignore */ path)) as Record<
				string,
				unknown
			>
			return (mod.default as Record<string, unknown>) ?? mod
		} catch (err) {
			console.warn(
				createAppError(
					ErrorCode.CONTRACT_NOT_DEPLOYED,
					"Contract not available",
					{ contractPath: path },
					err,
				),
			)
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

			const balanceFn = asMethod(client, "balance", "get_balance", "getBalance")
			if (!balanceFn) return 0n

			for (const args of [
				[{ account: address }],
				[{ user: address }],
				[{ id: address }],
				[{ account: address, user: address, id: address }],
				[address],
			]) {
				try {
					const result = await balanceFn(...args)
					return toBigIntSafe(result)
				} catch {
					continue
				}
			}

			return 0n
		},
		enabled: !!address,
	})

	// Fetch all proposals
	const { data: proposals = [], isLoading: isLoadingProposals } = useQuery<
		Proposal[]
	>({
		queryKey: ["governance", "proposals"],
		queryFn: async () => {
			if (!SCHOLARSHIP_TREASURY_CONTRACT) return []
			const client = await loadClient("../contracts/scholarship_treasury")
			if (!client) return []

			const pending = await readContractArray(
				client,
				["get_active_proposals", "getActiveProposals"],
				[[]],
			)
			const approved = await readContractArray(
				client,
				["get_proposals_by_status", "getProposalsByStatus"],
				[["Approved"], [{ status: "Approved" }], [{ tag: "Approved" }]],
			)
			const rejected = await readContractArray(
				client,
				["get_proposals_by_status", "getProposalsByStatus"],
				[["Rejected"], [{ status: "Rejected" }], [{ tag: "Rejected" }]],
			)

			const grouped = [
				...pending.map((proposal) =>
					mapProposal(proposal as RawContractProposal, "Active"),
				),
				...approved.map((proposal) =>
					mapProposal(proposal as RawContractProposal, "Passed"),
				),
				...rejected.map((proposal) =>
					mapProposal(proposal as RawContractProposal, "Rejected"),
				),
			]

			if (grouped.length > 0) return grouped

			const fallback = await readContractArray(
				client,
				["get_proposals", "getProposals"],
				[[]],
			)
			return fallback.map((proposal) =>
				mapProposal(proposal as RawContractProposal, "Active"),
			)
		},
	})

	// Check if voter has already voted on a specific proposal
	const hasVoted = useCallback(
		(proposalId: number, voterAddress?: string) => {
			const resolvedAddress = voterAddress ?? address
			if (!resolvedAddress) return false
			return !!queryClient.getQueryData([
				"governance",
				"voted",
				proposalId,
				resolvedAddress,
			])
		},
		[address, queryClient],
	)

	const getVoteChoice = useCallback(
		(proposalId: number, voterAddress?: string): boolean | null => {
			const resolvedAddress = voterAddress ?? address
			if (!resolvedAddress) return null
			const cached = queryClient.getQueryData([
				"governance",
				"voteChoice",
				proposalId,
				resolvedAddress,
			])
			return typeof cached === "boolean" ? cached : null
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

			const hasVotedFn = asMethod(client, "has_voted", "hasVoted")
			const voteChoiceFn = asMethod(
				client,
				"get_vote",
				"getVote",
				"vote_of",
				"voteOf",
			)
			if (!hasVotedFn) return {}

			const results: Record<number, boolean> = {}
			await Promise.all(
				proposals.map(async (p) => {
					try {
						const voted = await hasVotedFn({
							voter: address,
							proposal_id: p.id,
						})
						results[p.id] = Boolean(unwrapResult(voted))
						// Also update the individual cache
						queryClient.setQueryData(
							["governance", "voted", p.id, address],
							results[p.id],
						)
						if (results[p.id] && voteChoiceFn) {
							for (const args of [
								[{ voter: address, proposal_id: p.id }],
								[{ address, proposal_id: p.id }],
								[p.id, address],
							]) {
								try {
									const choice = await voteChoiceFn(...args)
									queryClient.setQueryData(
										["governance", "voteChoice", p.id, address],
										toBooleanSafe(choice),
									)
									break
								} catch {
									continue
								}
							}
						}
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
	const { mutateAsync: castVote, isPending: isVoting } = useMutation({
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

			const voteFn = asMethod(client, "vote", "cast_vote")
			if (!voteFn) throw new Error("Vote method not found")

			const tx = await voteFn(
				{
					proposal_id: proposalId,
					voter: address,
					support,
				},
				{ publicKey: address },
			)

			const sendResult = await sendTxIfNeeded(tx)
			unwrapSendResult(sendResult)
		},
		onSuccess: (_, { proposalId, support }) => {
			showSuccess("Vote submitted successfully!")
			// Invalidate queries to refresh UI
			void queryClient.invalidateQueries({
				queryKey: ["governance", "proposals"],
			})
			void queryClient.invalidateQueries({
				queryKey: ["governance", "voted"],
			})
			// Optimistically update the specific voted status
			queryClient.setQueryData(
				["governance", "voted", proposalId, address],
				true,
			)
			queryClient.setQueryData(
				["governance", "voteChoice", proposalId, address],
				support,
			)
		},

		onError: (error: unknown) => {
			if (isUserRejection(error)) {
				showInfo("Vote cancelled")
				return
			}
			const appError = parseError(error)
			const message =
				appError.code === ErrorCode.WALLET_NOT_CONNECTED
					? "Please connect your wallet to vote"
					: appError.code === ErrorCode.CONTRACT_NOT_DEPLOYED
						? "Voting is not available on this network"
						: "Vote failed. Already voted or voting closed."
			showError(message)
		},
	})

	return {
		votingPower,
		proposals,
		isLoadingProposals,
		castVote: (proposalId: number, support: boolean) =>
			castVote({ proposalId, support }),
		isVoting,
		hasVoted,
		getVoteChoice,
		walletAddress: address,
	}
}
