import { useEffect, useState } from "react"
import { useToast } from "../components/Toast/ToastProvider"
import { rpcUrl } from "../contracts/util"
import type {
	DonorData,
	DonorContribution,
	Vote,
	RpcEvent,
	DonorStats,
import {
	type DonorData,
	type DonorContribution,
	type DonorStats,
	type Vote,
	type RpcEvent,
} from "../types/contracts"
import { useContractIds } from "./useContractIds"
import { useWallet } from "./useWallet"

export type {
	DonorContribution,
	DonorStats,
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
	contributions: [],
	votes: [],
	scholars: [],
	isLoading: false,
	error: null,
	isEmpty: true,
})

const toDate = (input?: string): string => {
	if (!input) return new Date().toISOString().split("T")[0] ?? ""
	const d = new Date(input)
	return Number.isNaN(d.getTime())
		? (new Date().toISOString().split("T")[0] ?? "")
		: (d.toISOString().split("T")[0] ?? "")
}

const stringify = (value: unknown): string =>
	JSON.stringify(value ?? null).toLowerCase()

const extractNumber = (value: unknown): number => {
	const text = stringify(value)
	const match = text.match(/(\d{1,18})/)
	return match ? Number.parseInt(match[1] ?? "0", 10) : 0
}

const readContractEvents = async (
	contractIds: string[],
	walletAddress: string,
): Promise<RpcEvent[]> => {
	if (!contractIds.length) return []
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
	return events.filter((evt) =>
		stringify(evt).includes(walletAddress.toLowerCase()),
	)
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

			setData((prev) => ({ ...prev, isLoading: true, error: null }))
			try {
				const contractIds = [scholarshipTreasury, governanceToken].filter(
					(id): id is string => Boolean(id),
				)
				const events = await readContractEvents(contractIds, address)
				const contributions: DonorContribution[] = events
					.filter((evt) =>
						stringify({
							topic: evt.topics ?? evt.topic,
							value: evt.value,
						}).includes("deposit"),
					)
					.map((evt, i) => ({
						txHash: evt.txHash ?? evt.id ?? `deposit-${i}`,
						amount: extractNumber(evt.value),
						date: toDate(evt.ledgerCloseTime),
						block: evt.ledger ?? 0,
					}))
					.filter((entry) => entry.amount > 0)

				const votes: Vote[] = events
					.filter((evt) =>
						stringify({
							topic: evt.topics ?? evt.topic,
							value: evt.value,
						}).includes("vote"),
					)
					.map((evt, i): Vote => {
						const text = stringify(evt.value)
						return {
							proposalId: String(i + 1),
							proposalTitle: `Proposal #${i + 1}`,
							voteChoice: text.includes("false") ? "against" : "for",
							votePower: extractNumber(evt.value),
							status: "active" as const,
						}
					})
					.filter((entry) => entry.votePower > 0)

				const totalContributed = contributions.reduce(
					(sum, c) => sum + c.amount,
					0,
				)
				const scholarsFunded = new Set(
					events
						.filter((evt) => stringify(evt).includes("disburse"))
						.map((evt) => evt.txHash ?? evt.id ?? ""),
				).size

				const next: DonorData = {
					stats: {
						total_contributed: BigInt(totalContributed),
						votes_cast: votes.length,
						scholars_funded: scholarsFunded,
					},
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
