import { useQuery } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { rpcUrl, stellarNetwork } from "../contracts/util"
import { useContractIds } from "./useContractIds"

export type ActivityEventType =
	| "lrn_minted"
	| "course_enrolled"
	| "milestone_completed"
	| "scholar_nft_minted"
	| "vote_cast"
	| "funds_disbursed"

export type ActivityEventFilter = "deposit" | "disburse" | "followed" | "all"

export interface ActivityEvent {
	id: string
	type: ActivityEventType
	description: string
	timestamp: string
	txHash?: string
}

interface RpcEvent {
	id?: string
	ledger?: number
	ledgerCloseTime?: string
	topic?: unknown[]
	topics?: unknown[]
	value?: unknown
	txHash?: string
}

function classifyEvent(event: RpcEvent): ActivityEventType {
	const text = JSON.stringify({
		topic: event.topics ?? event.topic,
		value: event.value,
	}).toLowerCase()

	if (text.includes("mint") && text.includes("nft")) return "scholar_nft_minted"
	if (text.includes("mint") || text.includes("transfer")) return "lrn_minted"
	if (text.includes("enroll")) return "course_enrolled"
	if (text.includes("complete") || text.includes("milestone"))
		return "milestone_completed"
	if (text.includes("vote")) return "vote_cast"
	if (text.includes("disburse") || text.includes("escrow"))
		return "funds_disbursed"

	return "lrn_minted"
}

function describeEvent(type: ActivityEventType, event: RpcEvent): string {
	const text = JSON.stringify({
		topic: event.topics ?? event.topic,
		value: event.value,
	}).toLowerCase()

	switch (type) {
		case "lrn_minted":
			return "Earned LRN for completing a lesson"
		case "course_enrolled":
			return "Enrolled in a new course"
		case "milestone_completed": {
			const milestoneMatch = text.match(/milestone[^"]*?(\d+)/)
			return milestoneMatch
				? `Completed milestone #${milestoneMatch[1]}`
				: "Completed a milestone"
		}
		case "scholar_nft_minted":
			return "Earned a ScholarNFT credential"
		case "vote_cast": {
			const proposalMatch = text.match(/proposal[^"]*?(\d+)/)
			return proposalMatch
				? `Voted on Proposal #${proposalMatch[1]}`
				: "Cast a governance vote"
		}
		case "funds_disbursed":
			return "Received scholarship funds"
	}
}

async function fetchActivityEvents(
	walletAddress: string | undefined,
	limit: number,
	filter?: ActivityEventFilter,
): Promise<ActivityEvent[]> {
	const params = new URLSearchParams()
	params.append("limit", limit.toString())

	if (walletAddress && filter !== "followed") {
		params.append("address", walletAddress)
	}

	if (filter === "followed") {
		params.append("followed_only", "true")
	}

	if (filter === "deposit") {
		params.append("type", "LearnToken::Mint") // Example, backend might need adjustment if more types
	}

	const response = await fetch(`/api/events?${params.toString()}`, {
		headers: {
			Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
		},
	})

	if (!response.ok) return []

	const payload = (await response.json()) as {
		data?: Array<{
			id: number
			contract: string
			event_type: string
			data: any
			ledger_sequence: string
			created_at: string
			tx_hash: string | null
		}>
	}
	const events = payload.data ?? []

	return events.map((event) => {
		const type = classifyBackendEvent(event.event_type, event.data)
		return {
			id: String(event.id),
			type,
			description: describeBackendEvent(type, event.data),
			timestamp: event.created_at,
			txHash: event.tx_hash || undefined,
		}
	})
}

function classifyBackendEvent(eventType: string, data: any): ActivityEventType {
	const text = (eventType + JSON.stringify(data)).toLowerCase()
	if (text.includes("mint") && text.includes("nft")) return "scholar_nft_minted"
	if (text.includes("mint") || text.includes("transfer")) return "lrn_minted"
	if (text.includes("enroll")) return "course_enrolled"
	if (text.includes("complete") || text.includes("milestone"))
		return "milestone_completed"
	if (text.includes("vote")) return "vote_cast"
	if (text.includes("disburse") || text.includes("escrow"))
		return "funds_disbursed"
	return "lrn_minted"
}

function describeBackendEvent(type: ActivityEventType, data: any): string {
	const text = JSON.stringify(data).toLowerCase()
	switch (type) {
		case "lrn_minted":
			return "Earned LRN for completing a lesson"
		case "course_enrolled":
			return "Enrolled in a new course"
		case "milestone_completed":
			return "Completed a milestone"
		case "scholar_nft_minted":
			return "Earned a ScholarNFT credential"
		case "vote_cast":
			return "Cast a governance vote"
		case "funds_disbursed":
			return "Received scholarship funds"
		default:
			return "Activity recorded"
	}
}

export function useActivityFeed(
	address: string | undefined,
	limit = 10,
	filter: ActivityEventFilter = "all",
) {
	const [displayCount, setDisplayCount] = useState(limit)
	const {
		learnToken,
		courseMilestone,
		scholarNft,
		governanceToken,
		milestoneEscrow,
	} = useContractIds()

	const { data, isLoading, error } = useQuery({
		queryKey: ["activity-feed", address, filter],
		queryFn: () => fetchActivityEvents(address, 100, filter),
		enabled: true,
		staleTime: 30_000,
		refetchInterval: 60_000,
	})

	const events = data?.slice(0, displayCount) ?? []
	const hasMore = (data?.length ?? 0) > displayCount

	const loadMore = useCallback(() => {
		setDisplayCount((prev) => prev + limit)
	}, [limit])

	return {
		events,
		isLoading,
		error: error ? "Failed to load activity" : null,
		hasMore,
		loadMore,
	}
}
