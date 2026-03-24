import React from "react"
import { formatDistanceToNow } from "date-fns"
import {
	useActivityFeed,
	type ActivityEvent,
	type ActivityEventType,
} from "../hooks/useActivityFeed"
import { stellarNetwork } from "../contracts/util"

export interface ActivityFeedProps {
	address: string | undefined
	limit?: number
}

const EVENT_CONFIG: Record<
	ActivityEventType,
	{ icon: string; label: string; color: string }
> = {
	lrn_minted: {
		icon: "\u{1F3C6}",
		label: "LearnToken minted",
		color: "text-yellow-400",
	},
	course_enrolled: {
		icon: "\u{1F4DA}",
		label: "Course enrolled",
		color: "text-blue-400",
	},
	milestone_completed: {
		icon: "\u2705",
		label: "Milestone completed",
		color: "text-emerald-400",
	},
	scholar_nft_minted: {
		icon: "\u{1F393}",
		label: "ScholarNFT minted",
		color: "text-purple-400",
	},
	vote_cast: {
		icon: "\u{1F5F3}\uFE0F",
		label: "Vote cast",
		color: "text-cyan-400",
	},
	funds_disbursed: {
		icon: "\u{1F4B0}",
		label: "Funds disbursed",
		color: "text-green-400",
	},
}

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

function formatRelativeTime(timestamp: string): string {
	try {
		return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
	} catch {
		return "recently"
	}
}

function ActivityEventRow({ event }: { event: ActivityEvent }) {
	const config = EVENT_CONFIG[event.type]

	return (
		<div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-white/[0.03] transition-colors duration-300 group">
			<div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-lg group-hover:border-white/20 transition-colors">
				{config.icon}
			</div>
			<div className="flex-1 min-w-0">
				<p className="text-sm text-white/90 leading-relaxed">
					{event.description}
				</p>
				<div className="flex items-center gap-3 mt-1">
					<span className={`text-[10px] font-bold uppercase tracking-widest ${config.color}`}>
						{config.label}
					</span>
					<span className="text-[10px] text-white/30">
						{formatRelativeTime(event.timestamp)}
					</span>
				</div>
			</div>
			{event.txHash && (
				<a
					href={getExplorerUrl(event.txHash)}
					target="_blank"
					rel="noopener noreferrer"
					className="flex-shrink-0 text-[10px] font-bold uppercase tracking-widest text-brand-cyan/60 hover:text-brand-cyan transition-colors self-center"
					title="View on Stellar Explorer"
				>
					View Tx &rarr;
				</a>
			)}
		</div>
	)
}

function ActivityFeedSkeleton() {
	return (
		<div className="space-y-3">
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className="flex items-start gap-4 p-4">
					<div className="w-10 h-10 rounded-full bg-white/5 animate-pulse" />
					<div className="flex-1 space-y-2">
						<div className="h-4 bg-white/5 rounded-lg w-3/4 animate-pulse" />
						<div className="h-3 bg-white/5 rounded-lg w-1/3 animate-pulse" />
					</div>
				</div>
			))}
		</div>
	)
}

function EmptyState() {
	return (
		<div className="text-center py-16">
			<div className="text-4xl mb-4">🚀</div>
			<p className="text-white/40 text-sm font-medium">
				No activity yet — start learning!
			</p>
		</div>
	)
}

export function ActivityFeed({ address, limit = 10 }: ActivityFeedProps) {
	const { events, isLoading, error, hasMore, loadMore } = useActivityFeed(
		address,
		limit,
	)

	return (
		<section className="mt-16">
			<div className="flex items-center gap-4 mb-8">
				<h2 className="text-2xl font-black tracking-tight">
					Activity Feed
				</h2>
				<div className="h-px flex-1 bg-linear-to-r from-white/10 to-transparent" />
			</div>

			<div className="glass-card rounded-[2.5rem] p-6 overflow-hidden">
				{isLoading ? (
					<ActivityFeedSkeleton />
				) : error ? (
					<div className="text-center py-12">
						<p className="text-red-400/80 text-sm">{error}</p>
					</div>
				) : events.length === 0 ? (
					<EmptyState />
				) : (
					<>
						<div className="divide-y divide-white/5">
							{events.map((event) => (
								<ActivityEventRow key={event.id} event={event} />
							))}
						</div>
						{hasMore && (
							<div className="pt-4 text-center">
								<button
									onClick={loadMore}
									className="px-6 py-2.5 glass rounded-full border border-white/10 hover:border-brand-cyan/30 text-xs font-black uppercase tracking-widest text-white/50 hover:text-brand-cyan transition-all duration-300"
								>
									Load more
								</button>
							</div>
						)}
					</>
				)}
			</div>
		</section>
	)
}

export default ActivityFeed
