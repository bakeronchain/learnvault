import { useQuery } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { rpcUrl, stellarNetwork } from "../contracts/util"

export type ActivityEventType =
	| "lrn_minted"
	| "course_enrolled"
	| "milestone_completed"
	| "scholar_nft_minted"
	| "vote_cast"
	| "funds_disbursed"

export type ActivityEventFilter = "deposit" | "disburse" | "all"

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

const readEnv = (key: string): string | undefined => {
	const value = (import.meta.env as Record<string, unknown>)[key]
	return typeof value === "string" && value.length > 0 ? value : undefined
}

const contractIds = {
	learnToken: readEnv("PUBLIC_LEARN_TOKEN_CONTRACT"),
	courseMilestone: readEnv("PUBLIC_COURSE_MILESTONE_CONTRACT"),
	scholarNft: readEnv("PUBLIC_SCHOLAR_NFT_CONTRACT"),
	scholarshipGov: readEnv("PUBLIC_SCHOLARSHIP_GOVERNANCE_CONTRACT"),
	milestoneEscrow: readEnv("VITE_MILESTONE_ESCROW_CONTRACT_ID"),
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
	const ids = [
		contractIds.learnToken,
		contractIds.courseMilestone,
		contractIds.scholarNft,
		contractIds.scholarshipGov,
		contractIds.milestoneEscrow,
	].filter((v): v is string => Boolean(v))

	if (!ids.length) return []

	const response = await fetch(rpcUrl, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: "activity-feed",
			method: "getEvents",
			params: {
				filters: [{ type: "contract", contractIds: ids }],
				pagination: { limit: 100 },
			},
		}),
	})

	if (!response.ok) return []

	const payload = (await response.json()) as {
		result?: { events?: RpcEvent[] }
	}
	const events = payload.result?.events ?? []

	const relevant = walletAddress
		? events.filter((e) =>
				JSON.stringify({
					topic: e.topics ?? e.topic,
					value: e.value,
				})
					.toLowerCase()
					.includes(walletAddress.toLowerCase()),
			)
		: events

	// Apply filter by event type
	let filtered = relevant
	if (filter && filter !== "all") {
		filtered = relevant.filter((e) => {
			const type = classifyEvent(e)
			if (filter === "deposit") {
				// Deposits are token mint/transfer events
				return type === "lrn_minted"
			}
			if (filter === "disburse") {
				// Disbursements are funds_disbursed events
				return type === "funds_disbursed"
			}
			return true
		})
	}

	return filtered.slice(0, limit).map((event, idx) => {
		const type = classifyEvent(event)
		return {
			id: event.id ?? `activity-${idx}`,
			type,
			description: describeEvent(type, event),
			timestamp: event.ledgerCloseTime ?? new Date().toISOString(),
			txHash: event.txHash,
		}
	})
}

export function useActivityFeed(
	address: string | undefined,
	limit = 10,
	filter: ActivityEventFilter = "all",
) {
	const [displayCount, setDisplayCount] = useState(limit)

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
