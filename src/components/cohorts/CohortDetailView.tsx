import { ArrowLeft, Crown, Users } from "lucide-react"
import React from "react"
import {
	useCohortDetail,
	useJoinCohort,
	useLeaveCohort,
} from "../../hooks/useCohorts"
import { useWallet } from "../../hooks/useWallet"
import { AddressDisplay } from "../AddressDisplay"
import CommentSection from "../CommentSection"
import CourseProgressBar from "../CourseProgressBar"
import { ErrorState } from "../states/errorState"

interface CohortDetailViewProps {
	cohortId: number
	onBack: () => void
}

const RING_RADIUS = 52
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function GroupCompletionRing({ pct }: { pct: number }) {
	const clamped = Math.max(0, Math.min(100, pct))
	const offset = RING_CIRCUMFERENCE * (1 - clamped / 100)

	return (
		<div
			className="relative w-32 h-32 shrink-0"
			role="img"
			aria-label={`Group completion: ${clamped}%`}
		>
			<svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
				<circle
					cx="60"
					cy="60"
					r={RING_RADIUS}
					fill="none"
					stroke="rgba(255,255,255,0.08)"
					strokeWidth="10"
				/>
				<circle
					cx="60"
					cy="60"
					r={RING_RADIUS}
					fill="none"
					stroke={clamped >= 100 ? "#34d399" : "#22d3ee"}
					strokeWidth="10"
					strokeLinecap="round"
					strokeDasharray={RING_CIRCUMFERENCE}
					strokeDashoffset={offset}
					style={{ transition: "stroke-dashoffset 0.7s ease" }}
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span className="text-2xl font-black text-white tabular-nums">
					{clamped}%
				</span>
				<span className="text-[10px] font-black uppercase tracking-widest text-white/40">
					Group
				</span>
			</div>
		</div>
	)
}

export const CohortDetailView: React.FC<CohortDetailViewProps> = ({
	cohortId,
	onBack,
}) => {
	const { address } = useWallet()
	const { data: cohort, isLoading, error, refetch } = useCohortDetail(cohortId)
	const joinCohort = useJoinCohort()
	const leaveCohort = useLeaveCohort()

	if (isLoading) {
		return (
			<div
				className="glass-card rounded-3xl border border-white/10 p-8 animate-pulse"
				aria-busy="true"
			>
				<div className="h-6 w-48 bg-white/10 rounded mb-4" />
				<div className="h-32 w-32 bg-white/10 rounded-full mb-4" />
				<div className="h-4 w-full bg-white/10 rounded" />
			</div>
		)
	}

	if (error || !cohort) {
		return (
			<ErrorState
				message={
					error instanceof Error ? error.message : "Failed to load squad"
				}
				onRetry={() => void refetch()}
			/>
		)
	}

	const isMember = Boolean(
		address && cohort.members.some((m) => m.learner_addr === address),
	)
	const isFull = cohort.member_count >= cohort.max_members
	const actionPending = joinCohort.isPending || leaveCohort.isPending

	return (
		<div className="animate-in fade-in space-y-8">
			<button
				type="button"
				onClick={onBack}
				className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/50 hover:text-white transition-colors"
			>
				<ArrowLeft className="w-4 h-4" aria-hidden="true" />
				All Squads
			</button>

			<div className="glass-card rounded-3xl border border-white/10 p-6 md:p-8">
				<div className="flex flex-col md:flex-row md:items-center gap-6">
					<GroupCompletionRing pct={cohort.group_completion_pct} />
					<div className="flex-1 min-w-0">
						<h2 className="text-2xl font-bold text-white mb-2">
							{cohort.name}
						</h2>
						<p className="text-sm text-white/50 mb-1 flex items-center gap-2">
							<Users className="w-4 h-4" aria-hidden="true" />
							{cohort.member_count}/{cohort.max_members} members
						</p>
						<p className="text-sm text-white/50">
							Starts{" "}
							{new Date(cohort.start_date).toLocaleDateString(undefined, {
								year: "numeric",
								month: "long",
								day: "numeric",
							})}
						</p>
					</div>
					<div>
						{isMember ? (
							<button
								type="button"
								disabled={actionPending}
								onClick={() => leaveCohort.mutate(cohort.id)}
								className="px-5 py-2.5 rounded-xl border border-red-400/30 text-red-300 text-sm font-bold hover:bg-red-400/10 transition-colors disabled:opacity-50"
							>
								{leaveCohort.isPending ? "Leaving..." : "Leave Squad"}
							</button>
						) : (
							<button
								type="button"
								disabled={actionPending || isFull || !address}
								onClick={() => joinCohort.mutate(cohort.id)}
								className="iridescent-border px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
							>
								{isFull
									? "Squad Full"
									: joinCohort.isPending
										? "Joining..."
										: "Join Squad"}
							</button>
						)}
					</div>
				</div>
				{(joinCohort.error || leaveCohort.error) && (
					<p className="mt-4 text-sm text-red-400" role="alert">
						{joinCohort.error instanceof Error
							? joinCohort.error.message
							: leaveCohort.error instanceof Error
								? leaveCohort.error.message
								: "Something went wrong"}
					</p>
				)}
			</div>

			<section
				className="glass-card rounded-3xl border border-white/10 p-6 md:p-8"
				aria-label="Squad leaderboard"
			>
				<h3 className="text-lg font-bold text-white mb-6 uppercase tracking-widest text-sm">
					Leaderboard
				</h3>
				<ol className="space-y-5">
					{cohort.members.map((member, index) => (
						<li key={member.learner_addr} className="flex items-center gap-4">
							<span
								className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-black ${
									index === 0
										? "bg-yellow-400/20 text-yellow-300"
										: "bg-white/[0.06] text-white/50"
								}`}
							>
								{index === 0 ? (
									<Crown className="w-4 h-4" aria-label="Top of squad" />
								) : (
									index + 1
								)}
							</span>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2 mb-1.5">
									<AddressDisplay
										address={member.learner_addr}
										showExplorerLink={false}
									/>
									{member.learner_addr === address && (
										<span className="text-[10px] font-black uppercase tracking-widest text-brand-cyan">
											You
										</span>
									)}
								</div>
								<CourseProgressBar
									completed={member.milestones_completed}
									total={member.total_milestones}
									size="sm"
									animate={false}
								/>
							</div>
						</li>
					))}
				</ol>
			</section>

			{isMember && (
				<section aria-label="Squad discussion">
					<h3 className="text-lg font-bold text-white mb-4 uppercase tracking-widest text-sm">
						Squad Discussion
					</h3>
					<CommentSection proposalId={`cohort-${cohort.id}`} />
				</section>
			)}
		</div>
	)
}

export default CohortDetailView
