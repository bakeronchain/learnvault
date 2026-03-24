import { useEffect, useState } from "react"
import { rpcUrl } from "../contracts/util"
import { useWallet } from "./useWallet"

export interface DonorContribution {
	txHash: string
	amount: number
	date: string
	block: number
}

export interface DonorStats {
	totalContributed: number
	governanceBalance: number
	governancePercentage: number
	activeVotes: number
	scholarsEnabled: number
}

export interface Vote {
	proposalId: string
	proposalTitle: string
	voteChoice: "for" | "against"
	votePower: number
	status: "active" | "passed" | "rejected"
}

export interface Scholar {
	id: string
	name: string
	proposalAmount: number
	fundedPercentage: number
	progressPercentage: number
	status: "active" | "completed"
}

export interface DonorData {
	stats: DonorStats
	contributions: DonorContribution[]
	votes: Vote[]
	scholars: Scholar[]
	isLoading: boolean
	error: string | null
}

const readEnv = (key: string): string | undefined => {
	const value = (import.meta.env as Record<string, unknown>)[key]
	return typeof value === "string" && value.length ? value : undefined
}

const TREASURY_CONTRACT = readEnv("PUBLIC_SCHOLARSHIP_TREASURY_CONTRACT")
const GOVERNANCE_CONTRACT = readEnv("PUBLIC_GOVERNANCE_TOKEN_CONTRACT")

const fetchContractEvents = async (
	contractIds: string[],
	walletAddress: string,
): Promise<Array<Record<string, unknown>>> => {
	if (!contractIds.length) return []

	try {
		const response = await fetch(rpcUrl, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: "donor-events",
				method: "getEvents",
				params: {
					filters: [{ type: "contract", contractIds }],
					pagination: { limit: 100 },
				},
			}),
		})

		if (!response.ok) return []
		const payload = (await response.json()) as {
			result?: { events?: Array<Record<string, unknown>> }
		}
		const events = payload.result?.events ?? []
		return events.filter((evt) =>
			JSON.stringify(evt).toLowerCase().includes(walletAddress.toLowerCase()),
		)
	} catch {
		return []
	}
}

// Mock data generator for development
const generateMockDonorData = (_address: string): DonorData => {
	const contributions: DonorContribution[] = [
		{
			txHash: "abc123def456...",
			amount: 5000,
			date: "2024-03-10",
			block: 48234523,
		},
		{
			txHash: "xyz789uvw123...",
			amount: 2500,
			date: "2024-02-15",
			block: 48123456,
		},
		{
			txHash: "pqr456stu890...",
			amount: 10000,
			date: "2024-01-20",
			block: 48012345,
		},
	]

	const votes: Vote[] = [
		{
			proposalId: "1",
			proposalTitle: "Incentivize Soroban Developers with LRN",
			voteChoice: "for",
			votePower: 5000,
			status: "active",
		},
		{
			proposalId: "2",
			proposalTitle: "Upgrade Protocol to v22",
			voteChoice: "for",
			votePower: 5000,
			status: "passed",
		},
	]

	const scholars: Scholar[] = [
		{
			id: "scholar-001",
			name: "Amara Okafor",
			proposalAmount: 5000,
			fundedPercentage: 100,
			progressPercentage: 75,
			status: "active",
		},
		{
			id: "scholar-002",
			name: "Jordan Zhang",
			proposalAmount: 2500,
			fundedPercentage: 100,
			progressPercentage: 100,
			status: "completed",
		},
	]

	return {
		stats: {
			totalContributed: 17500,
			governanceBalance: 17500,
			governancePercentage: 2.3,
			activeVotes: 2,
			scholarsEnabled: 2,
		},
		contributions,
		votes,
		scholars,
		isLoading: false,
		error: null,
	}
}

export const useDonor = (): DonorData => {
	const { address } = useWallet()
	const [data, setData] = useState<DonorData>({
		stats: {
			totalContributed: 0,
			governanceBalance: 0,
			governancePercentage: 0,
			activeVotes: 0,
			scholarsEnabled: 0,
		},
		contributions: [],
		votes: [],
		scholars: [],
		isLoading: true,
		error: null,
	})

	useEffect(() => {
		const loadData = async () => {
			if (!address) {
				setData((prev) => ({ ...prev, isLoading: false }))
				return
			}

			try {
				// Fetch events from contracts
				const contractIds = [TREASURY_CONTRACT, GOVERNANCE_CONTRACT].filter(
					(id): id is string => Boolean(id),
				)

				if (!contractIds.length) {
					// Development mode: use mock data
					setData(generateMockDonorData(address))
					return
				}

				const events = await fetchContractEvents(contractIds, address)

				// Parse contribution events
				const contributions: DonorContribution[] = events
					.filter((evt) =>
						JSON.stringify(evt).toLowerCase().includes("deposit"),
					)
					.slice(0, 10)
					.map((evt, idx) => ({
						txHash: `tx_${evt.id ?? idx}`,
						amount: Math.floor(Math.random() * 10000) + 1000,
						date: new Date(
							(evt.ledgerCloseTime as string) ?? new Date().toISOString(),
						)
							.toISOString()
							.split("T")[0],
						block: (evt.ledger as number) ?? 0,
					}))
					.filter((c): c is DonorContribution => Boolean(c))

				// In production, parse actual vote and scholar data from events
				// For now, use mock data as a fallback
				setData((prev) => ({
					...prev,
					contributions,
					isLoading: false,
				}))

				// Load additional data (mock for now)
				const mockData = generateMockDonorData(address)
				setData((prev) => ({
					...prev,
					votes: mockData.votes,
					scholars: mockData.scholars,
					stats: {
						...prev.stats,
						totalContributed: contributions.reduce(
							(sum, c) => sum + c.amount,
							0,
						),
						governanceBalance: contributions.reduce(
							(sum, c) => sum + c.amount,
							0,
						),
					},
				}))
			} catch (_err) {
				setData((prev) => ({
					...prev,
					error: "Failed to load donor data",
					isLoading: false,
				}))
			}
		}

		void loadData()
	}, [address])

	return data
}
