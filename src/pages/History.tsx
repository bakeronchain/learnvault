import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import React, { useMemo } from "react"
import { Link } from "react-router-dom"
import { stellarNetwork } from "../contracts/util"
import { useWallet } from "../hooks/useWallet"
import { API_URL } from "../lib/api"

type ApiEvent = {
	id: number
	contract: string
	event_type: string
	data: unknown
	ledger_sequence: string | number
	created_at: string
	tx_hash?: string | null
}

type HistoryItem = {
	id: string
	type: string
	course: string
	amount: string
	date: string
	txHash?: string
}

const HISTORY_LIMIT = 100

function getExplorerUrl(txHash: string): string {
	switch (stellarNetwork) {
		case "PUBLIC":
			return `https://stellar.expert/explorer/public/tx/${txHash}`
		case "TESTNET":
			return `https://stellar.expert/explorer/testnet/tx/${txHash}`
		case "FUTURENET":
			return `https://stellar.expert/explorer/futurenet/tx/${txHash}`
		default:
			return `https://stellar.expert/explorer/testnet/tx/${txHash}`
	}
}

function normalizeEventType(eventType: string): string {
	const normalized = eventType.toLowerCase()
	if (normalized.includes("submitted")) return "Milestone Submitted"
	if (normalized.includes("course_done")) return "Course Completed"
	if (normalized.includes("ms_done") || normalized.includes("milestone")) {
		return "Milestone Approved"
	}
	if (normalized.includes("minted") && normalized.includes("scholar")) {
		return "NFT Minted"
	}
	if (normalized.includes("mint")) return "LRN Minted"
	if (normalized.includes("enroll")) return "Course Enrolled"

	return eventType
		.split(/[._:]/g)
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ")
}

function findValueByKeys(data: unknown, keys: string[]): string | undefined {
	const wanted = new Set(keys.map((key) => key.toLowerCase()))
	const queue: unknown[] = [data]

	while (queue.length > 0) {
		const current = queue.shift()
		if (Array.isArray(current)) {
			queue.push(...current)
			continue
		}

		if (!current || typeof current !== "object") {
			continue
		}

		for (const [rawKey, value] of Object.entries(current)) {
			if (wanted.has(rawKey.toLowerCase())) {
				if (
					typeof value === "string" ||
					typeof value === "number" ||
					typeof value === "bigint"
				) {
					return String(value)
				}
			}

			if (value && typeof value === "object") {
				queue.push(value)
			}
		}
	}

	return undefined
}

function formatDate(date: string): string {
	try {
		return format(new Date(date), "MMM d, yyyy HH:mm")
	} catch {
		return date
	}
}

async function fetchHistory(address: string): Promise<ApiEvent[]> {
	const endpoint = `${API_URL}/api/events?address=${encodeURIComponent(address)}&limit=${HISTORY_LIMIT}`
	const response = await fetch(endpoint)
	if (!response.ok) {
		throw new Error("Failed to fetch activity history")
	}

	const payload = (await response.json()) as { data?: ApiEvent[] }
	return Array.isArray(payload.data) ? payload.data : []
}

const History: React.FC = () => {
	const { address } = useWallet()

	const {
		data: events = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["history", address],
		queryFn: () => fetchHistory(address ?? ""),
		enabled: Boolean(address),
		staleTime: 30_000,
		refetchInterval: 60_000,
	})

	const items = useMemo<HistoryItem[]>(
		() =>
			events.map((event) => {
				const course =
					findValueByKeys(event.data, ["course_id", "courseid", "course"]) ??
					"-"
				const amount =
					findValueByKeys(event.data, [
						"amount",
						"lrn_reward",
						"tokens_amount",
						"reward",
					]) ?? "-"
				const txHash =
					typeof event.tx_hash === "string" && event.tx_hash.length > 0
						? event.tx_hash
						: undefined

				return {
					id: String(event.id),
					type: normalizeEventType(event.event_type),
					course,
					amount,
					date: formatDate(event.created_at),
					txHash,
				}
			}),
		[events],
	)

	if (!address) {
		return (
			<div className="max-w-5xl mx-auto px-4 py-12">
				<div className="glass-card rounded-[2.5rem] p-8 sm:p-12 border border-white/10 text-center">
					<h1 className="text-3xl sm:text-4xl font-black mb-4 text-gradient">
						Activity History
					</h1>
					<p className="text-white/60 mb-6">
						Connect your wallet to view on-chain activity.
					</p>
					<Link
						to="/"
						className="inline-block w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-white/10 hover:border-white/20 text-white font-bold"
					>
						Connect Wallet
					</Link>
				</div>
			</div>
		)
	}

	return (
		<div className="max-w-6xl mx-auto px-4 py-10 sm:py-12">
			<header className="mb-8">
				<h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gradient">
					Activity History
				</h1>
				<p className="text-white/50 mt-2">
					Recent on-chain actions for {address.slice(0, 6)}...{address.slice(-4)}
				</p>
			</header>

			<div className="glass-card rounded-[2rem] border border-white/10 p-4 sm:p-6">
				{isLoading ? (
					<div className="space-y-3">
						{Array.from({ length: 6 }).map((_, index) => (
							<div
								key={index}
								className="h-20 rounded-2xl bg-white/5 animate-pulse"
							/>
						))}
					</div>
				) : error ? (
					<div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-100 text-sm">
						{error instanceof Error ? error.message : "Failed to load activity"}
					</div>
				) : items.length === 0 ? (
					<div className="rounded-2xl border border-white/10 p-8 text-center text-white/50">
						No transactions found for this wallet yet.
					</div>
				) : (
					<div className="space-y-3">
						{items.map((item) => (
							<article
								key={item.id}
								className="rounded-2xl border border-white/10 p-4 sm:p-5 bg-white/[0.02]"
							>
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
									<div className="text-sm sm:text-base font-bold text-white">
										{item.type}
									</div>
									<div className="text-xs text-white/40">{item.date}</div>
								</div>
								<div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
									<div className="rounded-xl border border-white/10 p-3">
										<div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
											Course
										</div>
										<div className="text-white/80 break-all">{item.course}</div>
									</div>
									<div className="rounded-xl border border-white/10 p-3">
										<div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
											Amount
										</div>
										<div className="text-brand-cyan font-bold break-all">
											{item.amount}
										</div>
									</div>
									<div className="rounded-xl border border-white/10 p-3">
										<div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
											Transaction
										</div>
										{item.txHash ? (
											<a
												href={getExplorerUrl(item.txHash)}
												target="_blank"
												rel="noopener noreferrer"
												className="text-brand-cyan hover:text-brand-cyan/80 font-semibold break-all"
											>
												{item.txHash}
											</a>
										) : (
											<span className="text-white/50">Unavailable</span>
										)}
									</div>
								</div>
							</article>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

export default History
