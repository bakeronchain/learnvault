import { Users } from "lucide-react"
import React, { useState } from "react"
import {
	useCohorts,
	useCreateCohort,
	useJoinCohort,
	type CohortSummary,
} from "../../hooks/useCohorts"
import { useWallet } from "../../hooks/useWallet"
import { EmptyState } from "../states/emptyState"
import { ErrorState } from "../states/errorState"
import CohortDetailView from "./CohortDetailView"

interface SquadsPanelProps {
	courseSlug: string
}

const DEFAULT_MAX_MEMBERS = 8

function CreateSquadForm({
	courseSlug,
	onCreated,
}: {
	courseSlug: string
	onCreated: (cohortId: number) => void
}) {
	const createCohort = useCreateCohort()
	const [name, setName] = useState("")
	const [startDate, setStartDate] = useState("")
	const [maxMembers, setMaxMembers] = useState(DEFAULT_MAX_MEMBERS)

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault()
		if (!name.trim() || !startDate) return
		createCohort.mutate(
			{
				name: name.trim(),
				course_slug: courseSlug,
				start_date: startDate,
				max_members: maxMembers,
			},
			{
				onSuccess: (cohort) => {
					setName("")
					setStartDate("")
					setMaxMembers(DEFAULT_MAX_MEMBERS)
					onCreated(cohort.id)
				},
			},
		)
	}

	const inputCls =
		"w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-cyan/50"

	return (
		<form
			onSubmit={handleSubmit}
			className="glass-card rounded-3xl border border-white/10 p-6 space-y-4"
			aria-label="Create a squad"
		>
			<h3 className="text-sm font-bold text-white uppercase tracking-widest">
				Start a New Squad
			</h3>
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<label className="block sm:col-span-1">
					<span className="block text-xs text-white/50 mb-1.5">Squad name</span>
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. Night Owls"
						maxLength={100}
						required
						className={inputCls}
					/>
				</label>
				<label className="block">
					<span className="block text-xs text-white/50 mb-1.5">Start date</span>
					<input
						type="date"
						value={startDate}
						onChange={(e) => setStartDate(e.target.value)}
						required
						className={inputCls}
					/>
				</label>
				<label className="block">
					<span className="block text-xs text-white/50 mb-1.5">
						Max members
					</span>
					<input
						type="number"
						min={2}
						max={100}
						value={maxMembers}
						onChange={(e) => setMaxMembers(Number(e.target.value))}
						className={inputCls}
					/>
				</label>
			</div>
			{createCohort.error && (
				<p className="text-sm text-red-400" role="alert">
					{createCohort.error instanceof Error
						? createCohort.error.message
						: "Failed to create squad"}
				</p>
			)}
			<button
				type="submit"
				disabled={createCohort.isPending}
				className="iridescent-border px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
			>
				{createCohort.isPending ? "Creating..." : "Create Squad"}
			</button>
		</form>
	)
}

function SquadCard({
	cohort,
	onOpen,
	onJoin,
	isMemberActionPending,
	canJoin,
}: {
	cohort: CohortSummary
	onOpen: () => void
	onJoin: () => void
	isMemberActionPending: boolean
	canJoin: boolean
}) {
	const isFull = cohort.member_count >= cohort.max_members

	return (
		<article className="glass-card rounded-3xl border border-white/10 p-6 flex flex-col gap-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h3 className="text-lg font-bold text-white truncate">
						{cohort.name}
					</h3>
					<p className="text-sm text-white/50 mt-1">
						Starts{" "}
						{new Date(cohort.start_date).toLocaleDateString(undefined, {
							month: "short",
							day: "numeric",
							year: "numeric",
						})}
					</p>
				</div>
				<span
					className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
						isFull
							? "bg-red-500/15 text-red-300 border-red-400/20"
							: "bg-brand-emerald/15 text-brand-emerald border-brand-emerald/20"
					}`}
				>
					<Users className="w-3.5 h-3.5" aria-hidden="true" />
					{cohort.member_count}/{cohort.max_members}
				</span>
			</div>
			<div className="mt-auto flex items-center gap-3">
				<button
					type="button"
					onClick={onOpen}
					className="flex-1 px-4 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-bold text-white/80 hover:bg-white/[0.08] transition-colors"
				>
					View Squad
				</button>
				<button
					type="button"
					onClick={onJoin}
					disabled={isFull || isMemberActionPending || !canJoin}
					className="flex-1 iridescent-border px-4 py-2 rounded-xl text-sm font-bold text-white transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
				>
					{isFull ? "Full" : "Join"}
				</button>
			</div>
		</article>
	)
}

export const SquadsPanel: React.FC<SquadsPanelProps> = ({ courseSlug }) => {
	const { address } = useWallet()
	const { data: cohorts, isLoading, error, refetch } = useCohorts(courseSlug)
	const joinCohort = useJoinCohort()
	const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null)

	if (selectedCohortId != null) {
		return (
			<CohortDetailView
				cohortId={selectedCohortId}
				onBack={() => setSelectedCohortId(null)}
			/>
		)
	}

	return (
		<div className="animate-in fade-in space-y-8">
			<CreateSquadForm
				courseSlug={courseSlug}
				onCreated={setSelectedCohortId}
			/>

			{joinCohort.error && (
				<p className="text-sm text-red-400" role="alert">
					{joinCohort.error instanceof Error
						? joinCohort.error.message
						: "Failed to join squad"}
				</p>
			)}

			{isLoading ? (
				<div
					className="grid grid-cols-1 sm:grid-cols-2 gap-6"
					aria-busy="true"
					aria-label="Loading squads"
				>
					{[1, 2].map((i) => (
						<div
							key={i}
							className="glass-card rounded-3xl border border-white/10 p-6 h-40 animate-pulse"
						/>
					))}
				</div>
			) : error ? (
				<ErrorState
					message={
						error instanceof Error ? error.message : "Failed to load squads"
					}
					onRetry={() => void refetch()}
				/>
			) : !cohorts || cohorts.length === 0 ? (
				<EmptyState
					icon={Users}
					title="No squads yet"
					description="Be the first to start a study squad for this track — create one above and invite fellow learners."
				/>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
					{cohorts.map((cohort) => (
						<SquadCard
							key={cohort.id}
							cohort={cohort}
							canJoin={Boolean(address)}
							isMemberActionPending={joinCohort.isPending}
							onOpen={() => setSelectedCohortId(cohort.id)}
							onJoin={() =>
								joinCohort.mutate(cohort.id, {
									onSuccess: () => setSelectedCohortId(cohort.id),
								})
							}
						/>
					))}
				</div>
			)}
		</div>
	)
}

export default SquadsPanel
