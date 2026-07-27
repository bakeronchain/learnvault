import { Link } from "react-router-dom"
import { Clock, Tag, Coins } from "lucide-react"
import type { Bounty, BountyStatus } from "../types/bounty"

function statusColor(status: BountyStatus): string {
	switch (status) {
		case "open":
			return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
		case "claimed":
			return "bg-amber-500/20 text-amber-400 border-amber-500/30"
		case "submitted":
			return "bg-blue-500/20 text-blue-400 border-blue-500/30"
		case "approved":
		case "paid":
			return "bg-brand-purple/20 text-brand-purple border-brand-purple/30"
		case "cancelled":
			return "bg-white/10 text-white/40 border-white/10"
		default:
			return "bg-white/10 text-white/50 border-white/10"
	}
}

function formatTimeLeft(deadline: string | null): string | null {
	if (!deadline) return null
	const now = Date.now()
	const end = new Date(deadline).getTime()
	const diff = end - now
	if (diff <= 0) return "Expired"
	const hours = Math.floor(diff / (1000 * 60 * 60))
	const days = Math.floor(hours / 24)
	const remHours = hours % 24
	if (days > 0) return `${days}d ${remHours}h left`
	return `${hours}h left`
}

function shortenAddress(addr: string): string {
	if (!addr || addr.length <= 10) return addr
	return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

export default function BountyCard({ bounty }: { bounty: Bounty }) {
	const timeLeft = formatTimeLeft(bounty.deadline)

	return (
		<Link
			to={`/bounties/${bounty.id}`}
			className="glass-card block rounded-[1.75rem] border border-white/5 p-6 hover:border-white/15 hover:shadow-lg hover:shadow-brand-cyan/5 transition-all duration-200 group"
		>
			<div className="flex items-start justify-between gap-3 mb-3">
				<h3 className="text-base font-bold text-white leading-snug group-hover:text-brand-cyan transition-colors line-clamp-2">
					{bounty.title}
				</h3>
				<span
					className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${statusColor(bounty.status)}`}
				>
					{bounty.status}
				</span>
			</div>

			<p className="text-sm text-white/50 line-clamp-2 mb-4">{bounty.description}</p>

			<div className="flex flex-wrap gap-1.5 mb-4">
				{bounty.skill_tags?.slice(0, 4).map((tag) => (
					<span
						key={tag}
						className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/60"
					>
						<Tag className="h-2.5 w-2.5" />
						{tag}
					</span>
				))}
				{bounty.skill_tags && bounty.skill_tags.length > 4 && (
					<span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/40">
						+{bounty.skill_tags.length - 4}
					</span>
				)}
			</div>

			<div className="flex items-center justify-between text-xs text-white/40">
				<div className="flex items-center gap-1.5">
					<Coins className="h-3.5 w-3.5 text-brand-emerald" />
					<span className="font-bold text-brand-emerald text-sm">
						{bounty.reward_usdc} USDC
					</span>
				</div>
				<div className="flex items-center gap-3">
					{timeLeft && (
						<span className="flex items-center gap-1">
							<Clock className="h-3 w-3" />
							{timeLeft}
						</span>
					)}
					<span>{shortenAddress(bounty.sponsor_addr)}</span>
				</div>
			</div>
		</Link>
	)
}
