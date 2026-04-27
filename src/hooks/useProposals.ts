import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useWallet } from "./useWallet"

const API_BASE = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000"

export type BackendProposalStatus = "pending" | "approved" | "rejected"

export interface ProposalRecord {
	id: number
	title: string
	description: string
	authorAddress: string
	amount: number
	votesFor: bigint
	votesAgainst: bigint
	status: BackendProposalStatus
	deadline: string | null
	createdAt: string | null
	userVoteSupport: boolean | null
	isVotingOpen: boolean
	displayStatus: "Voting Open" | "Voting Closed" | "Passed" | "Rejected"
}

export interface CreateProposalInput {
	author_address: string
	title: string
	description: string
	requested_amount: string
	evidence_url?: string
}

interface ProposalListResponse {
	proposals: ProposalRecord[]
	total: number
	page: number
}

interface ProposalApiRow {
	id: number | string
	author_address: string
	title: string
	description: string
	amount: number | string
	votes_for: number | string
	votes_against: number | string
	status: BackendProposalStatus
	deadline: string | null
	created_at: string | null
	user_vote_support: boolean | null
}

const parseBigInt = (value: number | string | null | undefined) => {
	try {
		return BigInt(value ?? 0)
	} catch {
		return 0n
	}
}

const isVotingOpen = (
	status: BackendProposalStatus,
	deadline: string | null,
) => {
	if (status !== "pending") return false
	if (!deadline) return true
	return new Date(deadline).getTime() > Date.now()
}

export const getProposalDisplayStatus = (proposal: {
	status: BackendProposalStatus
	deadline: string | null
}) => {
	if (proposal.status === "approved") return "Passed" as const
	if (proposal.status === "rejected") return "Rejected" as const
	return isVotingOpen(proposal.status, proposal.deadline)
		? ("Voting Open" as const)
		: ("Voting Closed" as const)
}

export const mapProposal = (row: ProposalApiRow): ProposalRecord => {
	const deadline = row.deadline ?? null
	return {
		id: Number(row.id),
		title: row.title,
		description: row.description,
		authorAddress: row.author_address,
		amount:
			typeof row.amount === "number"
				? row.amount
				: Number.parseFloat(row.amount ?? "0"),
		votesFor: parseBigInt(row.votes_for),
		votesAgainst: parseBigInt(row.votes_against),
		status: row.status,
		deadline,
		createdAt: row.created_at ?? null,
		userVoteSupport:
			typeof row.user_vote_support === "boolean" ? row.user_vote_support : null,
		isVotingOpen: isVotingOpen(row.status, deadline),
		displayStatus: getProposalDisplayStatus({
			status: row.status,
			deadline,
		}),
	}
}

async function readJson<T>(response: Response): Promise<T> {
	const data = (await response.json().catch(() => ({}))) as T & {
		error?: string
		message?: string
	}

	if (!response.ok) {
		throw new Error(
			data.message ||
				data.error ||
				`Request failed (status ${response.status}). Check your connection and try again.`,
		)
	}

	return data
}

export async function fetchProposals(
	address?: string,
): Promise<ProposalListResponse> {
	const url = new URL(`${API_BASE}/api/proposals`)
	if (address) {
		url.searchParams.set("viewer_address", address)
	}

	const response = await fetch(url.toString())
	const data = await readJson<{
		proposals: ProposalApiRow[]
		total: number
		page: number
	}>(response)

	return {
		proposals: data.proposals.map(mapProposal),
		total: data.total,
		page: data.page,
	}
}

async function fetchProposal(
	proposalId: number,
	address?: string,
): Promise<ProposalRecord> {
	const url = new URL(`${API_BASE}/api/proposals/${proposalId}`)
	if (address) {
		url.searchParams.set("viewer_address", address)
	}

	const response = await fetch(url.toString())
	const data = await readJson<ProposalApiRow>(response)
	return mapProposal(data)
}

async function fetchVotingPower(address?: string): Promise<bigint> {
	if (!address) return 0n

	const response = await fetch(
		`${API_BASE}/api/governance/voting-power/${address}`,
	)
	const data = await readJson<{ gov_balance: string }>(response)
	return parseBigInt(data.gov_balance)
}

export function useProposals() {
	const { address } = useWallet()
	const queryClient = useQueryClient()

	const proposalsQuery = useQuery({
		queryKey: ["proposals", address],
		queryFn: () => fetchProposals(address),
		staleTime: 60 * 1000,
	})

	const votingPowerQuery = useQuery({
		queryKey: ["proposals", "votingPower", address],
		queryFn: () => fetchVotingPower(address),
		enabled: Boolean(address),
		staleTime: 60 * 1000,
	})

	const createProposalMutation = useMutation({
		mutationFn: async (payload: CreateProposalInput) => {
			const response = await fetch(`${API_BASE}/api/proposals`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			})

			return readJson<{ proposal_id: number; tx_hash: string }>(response)
		},
		onSuccess: async (created) => {
			await queryClient.invalidateQueries({
				queryKey: ["proposals"],
			})
			await queryClient.invalidateQueries({
				queryKey: ["proposal", created.proposal_id],
			})
		},
	})

	const castVoteMutation = useMutation({
		mutationFn: async ({
			proposalId,
			support,
		}: {
			proposalId: number
			support: boolean
		}) => {
			if (!address) {
				throw new Error(
					"Wallet not connected — connect your wallet using the button in the navigation to vote.",
				)
			}

			const response = await fetch(`${API_BASE}/api/governance/vote`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					proposal_id: proposalId,
					voter_address: address,
					support,
				}),
			})

			return readJson<{
				tx_hash: string
				votes_for: string
				votes_against: string
			}>(response)
		},
		onSuccess: async (_data, variables) => {
			await queryClient.invalidateQueries({
				queryKey: ["proposals"],
			})
			await queryClient.invalidateQueries({
				queryKey: ["proposal", variables.proposalId],
			})
			await queryClient.invalidateQueries({
				queryKey: ["proposals", "votingPower", address],
			})
		},
	})

	const cancelProposalMutation = useMutation({
		mutationFn: async (proposalId: number) => {
			if (!address) {
				throw new Error("Connect your wallet to cancel proposal")
			}

			const response = await fetch(
				`${API_BASE}/api/proposals/${proposalId}/cancel`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						author_address: address,
					}),
				},
			)

			return readJson<{ message: string }>(response)
		},
		onSuccess: async (_data, proposalId) => {
			await queryClient.invalidateQueries({
				queryKey: ["proposals"],
			})
			await queryClient.invalidateQueries({
				queryKey: ["proposal", proposalId],
			})
		},
	})

	return {
		proposals: proposalsQuery.data?.proposals ?? [],
		total: proposalsQuery.data?.total ?? 0,
		page: proposalsQuery.data?.page ?? 1,
		isLoading: proposalsQuery.isLoading,
		error: proposalsQuery.error,
		refetch: proposalsQuery.refetch,
		votingPower: votingPowerQuery.data ?? 0n,
		isLoadingVotingPower: votingPowerQuery.isLoading,
		isVotingPowerError: votingPowerQuery.isError,
		createProposal: createProposalMutation.mutateAsync,
		isSubmittingProposal: createProposalMutation.isPending,
		castVote: castVoteMutation.mutateAsync,
		isVoting: castVoteMutation.isPending,
		cancelProposal: cancelProposalMutation.mutateAsync,
		isCancelling: cancelProposalMutation.isPending,
		walletAddress: address,
	}
}

export function useProposal(proposalId: number | null) {
	const { address } = useWallet()

	return useQuery({
		queryKey: ["proposal", proposalId, address],
		queryFn: () => fetchProposal(proposalId as number, address),
		enabled: proposalId !== null,
		staleTime: 60 * 1000,
	})
}
