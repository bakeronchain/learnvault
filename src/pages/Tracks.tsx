import React, { useState } from "react"
import { Helmet } from "react-helmet"
import { Link } from "react-router-dom"
import { useCourses, useEnrolledCourses } from "../hooks/useCourses"
import { useWallet } from "../hooks/useWallet"
import { type CourseSummary } from "../types/courses"

interface SkillNode {
	course: CourseSummary
	status: "completed" | "available" | "locked"
	completedMilestones: number
	totalMilestones: number
}

interface TrackGroup {
	trackKey: string
	trackLabel: string
	nodes: SkillNode[]
}

const DIFFICULTY_ORDER = { beginner: 0, intermediate: 1, advanced: 2 } as const

const trackLabels: Record<string, string> = {
	defi: "DeFi",
	smartcontracts: "Smart Contracts",
	stellar: "Stellar",
	web3: "Web3",
	blockchain: "Blockchain",
}

function getTrackLabel(trackKey: string): string {
	return trackLabels[trackKey.toLowerCase()] ?? trackKey.replace(/_/g, " ")
}

function buildTracks(
	courses: CourseSummary[],
	enrolledMap: Map<
		string,
		{ completedMilestones: number; totalMilestones: number }
	>,
	isConnected: boolean,
): TrackGroup[] {
	const grouped = new Map<string, CourseSummary[]>()
	for (const course of courses) {
		if (!course.published) continue
		const key = course.trackKey || "other"
		const group = grouped.get(key) ?? []
		group.push(course)
		grouped.set(key, group)
	}

	const tracks: TrackGroup[] = []

	for (const [trackKey, trackCourses] of grouped) {
		const sorted = [...trackCourses].sort(
			(a, b) =>
				(DIFFICULTY_ORDER[a.difficulty] ?? 0) -
				(DIFFICULTY_ORDER[b.difficulty] ?? 0),
		)

		let highestCompletedIndex = -1
		sorted.forEach((course, idx) => {
			const enrolled = enrolledMap.get(course.slug)
			if (!enrolled) return
			const isCompleted =
				enrolled.completedMilestones > 0 &&
				enrolled.completedMilestones >= enrolled.totalMilestones
			if (isCompleted) highestCompletedIndex = idx
		})

		const resolved: SkillNode[] = sorted.map((course, idx) => {
			const enrolled = enrolledMap.get(course.slug)
			const completedMilestones = enrolled?.completedMilestones ?? 0
			const totalMilestones = enrolled?.totalMilestones ?? 0
			const isCompleted =
				enrolled !== undefined &&
				completedMilestones > 0 &&
				completedMilestones >= totalMilestones

			if (!isConnected)
				return {
					course,
					status: "available",
					completedMilestones,
					totalMilestones,
				}
			if (isCompleted)
				return {
					course,
					status: "completed",
					completedMilestones,
					totalMilestones,
				}
			if (idx === 0 || idx <= highestCompletedIndex + 1)
				return {
					course,
					status: "available",
					completedMilestones,
					totalMilestones,
				}
			return { course, status: "locked", completedMilestones, totalMilestones }
		})

		tracks.push({
			trackKey,
			trackLabel: getTrackLabel(trackKey),
			nodes: resolved,
		})
	}

	return tracks.sort((a, b) => a.trackLabel.localeCompare(b.trackLabel))
}

function getRecommendedNext(tracks: TrackGroup[]): CourseSummary | null {
	for (const track of tracks) {
		const available = track.nodes.find((n) => n.status === "available")
		if (available) return available.course
	}
	return null
}

const statusColors = {
	completed: {
		border: "border-brand-emerald/40",
		bg: "bg-brand-emerald/10",
		dot: "bg-brand-emerald",
		label: "Completed",
		text: "text-brand-emerald",
	},
	available: {
		border: "border-brand-cyan/40",
		bg: "bg-brand-cyan/10",
		dot: "bg-brand-cyan animate-pulse",
		label: "Available",
		text: "text-brand-cyan",
	},
	locked: {
		border: "border-white/10",
		bg: "bg-white/5",
		dot: "bg-white/20",
		label: "Locked",
		text: "text-white/30",
	},
}

const difficultyBadge: Record<string, string> = {
	beginner: "text-brand-emerald border-brand-emerald/30",
	intermediate: "text-brand-cyan border-brand-cyan/30",
	advanced: "text-brand-purple border-brand-purple/30",
}

const NodeCard: React.FC<{
	node: SkillNode
	isRecommended: boolean
	isSelected: boolean
	onClick: () => void
}> = ({ node, isRecommended, isSelected, onClick }) => {
	const colors = statusColors[node.status]
	const isLocked = node.status === "locked"

	return (
		<button
			onClick={onClick}
			disabled={isLocked}
			className={`relative w-full text-left p-5 rounded-2xl border transition-all duration-200 ${colors.bg} ${colors.border} ${isLocked ? "cursor-default opacity-50" : "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"} ${isSelected ? "ring-2 ring-white/30" : ""}`}
			aria-label={`${node.course.title} — ${colors.label}`}
		>
			{isRecommended && (
				<span className="absolute -top-2 -right-2 text-[9px] font-black uppercase tracking-widest bg-brand-cyan text-black px-2 py-0.5 rounded-full">
					Next
				</span>
			)}
			<div className="flex items-start gap-3">
				<span
					className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`}
				/>
				<div className="min-w-0">
					<p
						className={`font-black text-sm leading-tight ${isLocked ? "text-white/30" : "text-white"}`}
					>
						{node.course.title}
					</p>
					<div className="flex items-center gap-2 mt-1.5 flex-wrap">
						<span
							className={`text-[9px] font-black uppercase tracking-widest border px-1.5 py-0.5 rounded-md ${difficultyBadge[node.course.difficulty] ?? "text-white/40 border-white/10"}`}
						>
							{node.course.difficulty}
						</span>
						{node.status === "completed" && node.totalMilestones > 0 && (
							<span className="text-[9px] text-white/40 font-bold">
								{node.completedMilestones}/{node.totalMilestones} milestones
							</span>
						)}
					</div>
				</div>
			</div>
		</button>
	)
}

const CourseDetailPanel: React.FC<{ node: SkillNode; onClose: () => void }> = ({
	node,
	onClose,
}) => {
	const colors = statusColors[node.status]
	return (
		<div className="glass-card p-8 rounded-3xl border border-white/10 animate-in slide-in-from-right duration-200">
			<div className="flex items-start justify-between mb-4">
				<span
					className={`text-[9px] font-black uppercase tracking-widest ${colors.text}`}
				>
					{colors.label}
				</span>
				<button
					onClick={onClose}
					className="text-white/40 hover:text-white text-xl leading-none"
					aria-label="Close"
				>
					×
				</button>
			</div>
			<h3 className="text-xl font-black text-white mb-2">
				{node.course.title}
			</h3>
			<p className="text-sm text-white/50 mb-6 leading-relaxed">
				{node.course.description}
			</p>
			<div className="flex flex-wrap gap-2 mb-6">
				<span
					className={`text-[9px] font-black uppercase tracking-widest border px-2 py-1 rounded-lg ${difficultyBadge[node.course.difficulty] ?? "text-white/40 border-white/10"}`}
				>
					{node.course.difficulty}
				</span>
				<span className="text-[9px] font-black uppercase tracking-widest text-white/40 border border-white/10 px-2 py-1 rounded-lg">
					{node.course.track}
				</span>
			</div>
			{node.status !== "locked" ? (
				<Link
					to={`/courses/${node.course.slug}`}
					className="block w-full text-center py-3 rounded-2xl bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan font-black text-sm uppercase tracking-widest hover:bg-brand-cyan/30 transition-colors"
				>
					{node.status === "completed" ? "Review Course" : "Start Course"}
				</Link>
			) : (
				<p className="text-center text-xs text-white/30 font-bold">
					Complete earlier courses to unlock
				</p>
			)}
		</div>
	)
}

const Tracks: React.FC = () => {
	const { courses, isLoading: coursesLoading } = useCourses()
	const { enrolledCourses, isLoading: enrolledLoading } = useEnrolledCourses()
	const { address } = useWallet()
	const [selectedNode, setSelectedNode] = useState<SkillNode | null>(null)

	const enrolledMap = new Map(
		enrolledCourses.map((ec) => [
			ec.courseId,
			{
				completedMilestones: ec.completedCount,
				totalMilestones: ec.totalCount,
			},
		]),
	)

	const tracks = buildTracks(courses, enrolledMap, Boolean(address))
	const recommended = address ? getRecommendedNext(tracks) : null
	const isLoading = coursesLoading || enrolledLoading

	const handleNodeClick = (node: SkillNode) => {
		setSelectedNode((prev) =>
			prev?.course.id === node.course.id ? null : node,
		)
	}

	return (
		<div className="p-8 max-w-7xl mx-auto min-h-screen text-white animate-in fade-in duration-700">
			<Helmet>
				<title>Skill Tracks — LearnVault</title>
				<meta
					name="description"
					content="Explore LearnVault learning tracks and skill trees. See how courses build on each other and plan your path."
				/>
			</Helmet>

			<header className="text-center mb-16 relative">
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brand-purple/20 blur-[100px] rounded-full -z-10" />
				<h1 className="text-6xl font-black mb-4 tracking-tighter text-gradient">
					Skill Tracks
				</h1>
				<p className="text-white/40 text-lg max-w-xl mx-auto font-medium">
					See how courses connect, track your progress, and find what to learn
					next.
				</p>
			</header>

			{!address && (
				<div className="mb-10 glass-card p-5 rounded-2xl border border-white/5 text-center text-sm text-white/40">
					Connect your wallet to see your progress and unlock recommendations.
				</div>
			)}

			{recommended && (
				<div className="mb-10">
					<div className="glass-card p-6 rounded-3xl border border-brand-cyan/20 flex items-center gap-4">
						<span className="text-2xl">🎯</span>
						<div className="min-w-0">
							<p className="text-[10px] uppercase font-black tracking-widest text-brand-cyan mb-1">
								Recommended Next
							</p>
							<p className="font-black text-white">{recommended.title}</p>
							<p className="text-xs text-white/40 mt-0.5">
								{recommended.track} · {recommended.difficulty}
							</p>
						</div>
						<Link
							to={`/courses/${recommended.slug}`}
							className="ml-auto flex-shrink-0 px-5 py-2.5 rounded-xl bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan font-black text-xs uppercase tracking-widest hover:bg-brand-cyan/30 transition-colors"
						>
							Start
						</Link>
					</div>
				</div>
			)}

			{isLoading ? (
				<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={i}
							className="glass-card rounded-3xl p-6 animate-pulse space-y-4"
						>
							<div className="h-5 w-32 rounded-full bg-white/10" />
							{Array.from({ length: 3 }).map((_, j) => (
								<div key={j} className="h-16 rounded-2xl bg-white/5" />
							))}
						</div>
					))}
				</div>
			) : tracks.length === 0 ? (
				<div className="text-center text-white/30 py-24">
					<p className="text-4xl mb-4">🌱</p>
					<p className="font-black text-xl">No tracks yet</p>
					<p className="text-sm mt-2">Check back once courses are published.</p>
				</div>
			) : (
				<div className="flex flex-col lg:flex-row gap-6">
					<div className="flex-1 min-w-0">
						<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
							{tracks.map((track) => (
								<div
									key={track.trackKey}
									className="glass-card p-6 rounded-3xl border border-white/5"
								>
									<div className="flex items-center gap-2 mb-5">
										<h2 className="text-base font-black text-white">
											{track.trackLabel}
										</h2>
										<span className="text-[9px] font-black uppercase tracking-widest text-white/30 border border-white/10 px-2 py-0.5 rounded-full">
											{track.nodes.length} courses
										</span>
									</div>

									<div className="relative space-y-2">
										{track.nodes.map((node, idx) => (
											<div key={node.course.id} className="relative">
												{idx < track.nodes.length - 1 && (
													<div className="absolute left-[18px] top-full h-2 w-px bg-white/10 z-0" />
												)}
												<NodeCard
													node={node}
													isRecommended={recommended?.id === node.course.id}
													isSelected={
														selectedNode?.course.id === node.course.id
													}
													onClick={() => handleNodeClick(node)}
												/>
											</div>
										))}
									</div>

									<div className="mt-5 flex gap-3 text-[9px] font-black uppercase tracking-widest text-white/20">
										<span className="flex items-center gap-1">
											<span className="w-1.5 h-1.5 rounded-full bg-brand-emerald" />{" "}
											Done
										</span>
										<span className="flex items-center gap-1">
											<span className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />{" "}
											Available
										</span>
										<span className="flex items-center gap-1">
											<span className="w-1.5 h-1.5 rounded-full bg-white/20" />{" "}
											Locked
										</span>
									</div>
								</div>
							))}
						</div>
					</div>

					{selectedNode && (
						<div className="lg:w-80 xl:w-96 flex-shrink-0">
							<div className="sticky top-6">
								<CourseDetailPanel
									node={selectedNode}
									onClose={() => setSelectedNode(null)}
								/>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

export default Tracks
