import { useEffect, useState } from "react"
import { useToast } from "../components/Toast/ToastProvider"
import { rpcUrl } from "../contracts/util"
import {
	type DonorData,
	type DonorContribution,
	type DonorStats,
	type DonorImpact,
	type Vote,
	type RpcEvent,
	type Scholar,
} from "../types/contracts"
import { useContractIds } from "./useContractIds"
import { useWallet } from "./useWallet"

export type {
	DonorContribution,
	DonorStats,
	DonorImpact,
	Vote,
	Scholar,
	DonorData,
} from "../types/contracts"

const emptyStats: DonorStats = {
	total_contributed: 0n,
	votes_cast: 0,
	scholars_funded: 0,
}

const makeEmptyData = (): DonorData => ({
	stats: emptyStats,
	impact: null,
	contributions: [],
	votes: [],
	scholars: [],
	isLoading: false,
	error: null,
	isEmpty: true,
})

const toDate = (input?: string): string => {
	if (!input) return new Date().toISOString().split("T")[0] ?? ""
	const date = new Date(input)
	return Number.isNaN(date.getTime())
		? (new Date().toISOString().split("T")[0] ?? "")
		: (date.toISOString().split("T")[0] ?? "")
}

const stringify = (value: unknown): string =>
	JSON.stringify(value ?? null).toLowerCase()

const extractNumber = (value: unknown): number => {
	const text = stringify(value)
	const match = text.match(/(\d{1,18})/)
	return match ? Number.parseInt(match[1] ?? "0", 10) : 0
}

const fetchDonorImpact = async (address: string): Promise<DonorImpact | null> => {
	try {
		const response = await fetch(`/api/donors/${address}/impact`)
		if (!response.ok) return null
		return (await response.json()) as DonorImpact
	} catch {
		return null
	}
}

const readContractEvents = async (
	contractIds: string[],
	walletAddress: string,
): Promise<RpcEvent[]> => {
	if (contractIds.length === 0) return []

	const response = await fetch(rpcUrl, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: "donor-events",
			method: "getEvents",
			params: {
				filters: [{ type: "contract", contractIds }],
				pagination: { limit: 200 },
			},
		}),
	})

	if (!response.ok) return []
	const payload = (await response.json()) as {
		result?: { events?: RpcEvent[] }
	}
	const events = payload.result?.events ?? []
	return events.filter((event) => stringify(event).includes(walletAddress.toLowerCase()))
}

export const useDonor = (): DonorData => {
	const { address } = useWallet()
	const { scholarshipTreasury, governanceToken } = useContractIds()
	const { showError } = useToast()
	const [data, setData] = useState<DonorData>({
		...makeEmptyData(),
		isLoading: true,
	})

	useEffect(() => {
		let cancelled = false

		const run = async () => {
			if (!address) {
				if (!cancelled) setData(makeEmptyData())
				return
			}

			setData((previous) => ({ ...previous, isLoading: true, error: null }))
			try {
				const contractIds = [scholarshipTreasury, governanceToken].filter(
					(id): id is string => Boolean(id),
				)

				const [events, impact] = await Promise.all([
					readContractEvents(contractIds, address),
					fetchDonorImpact(address),
				])

				const contributions: DonorContribution[] = events
					.filter((event) =>
						stringify({
							topic: event.topics ?? event.topic,
							value: event.value,
						}).includes("deposit"),
					)
					.map((event, index) => ({
						txHash: event.txHash ?? event.id ?? `deposit-${index}`,
						amount: extractNumber(event.value),
						date: toDate(event.ledgerCloseTime),
						block: event.ledger ?? 0,
					}))
					.filter((entry) => entry.amount > 0)

				const votes: Vote[] = events
					.filter((event) =>
						stringify({
							topic: event.topics ?? event.topic,
							value: event.value,
						}).includes("vote"),
					)
					.map((event, index): Vote => {
						const text = stringify(event.value)
						return {
							proposalId: String(index + 1),
							proposalTitle: `Proposal #${index + 1}`,
							voteChoice: text.includes("false") ? "against" : "for",
							votePower: extractNumber(event.value),
							status: "active",
						}
					})
					.filter((entry) => entry.votePower > 0)

				const totalContributed = contributions.reduce(
					(sum, contribution) => sum + contribution.amount,
					0,
				)
				const scholarsFunded = new Set(
					events
						.filter((event) => stringify(event).includes("disburse"))
						.map((event) => event.txHash ?? event.id ?? ""),
				).size

				const next: DonorData = {
					stats: {
						total_contributed: BigInt(totalContributed),
						votes_cast: votes.length,
						scholars_funded: scholarsFunded,
					},
					impact,
					contributions,
					votes,
					scholars: [],
					isLoading: false,
					error: null,
					isEmpty: contributions.length === 0 && votes.length === 0,
				}

				if (!cancelled) setData(next)
			} catch {
				if (!cancelled) {
					setData({
						...makeEmptyData(),
						error: "Failed to load donor data",
					})
				}
				showError("Failed to load donor data")
			}
		}

		void run()
		return () => {
			cancelled = true
		}
	}, [address, scholarshipTreasury, governanceToken, showError])

	return data
}
