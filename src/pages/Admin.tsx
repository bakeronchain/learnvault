import { useQuery } from "@tanstack/react-query"
import React, { useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import { useNavigate } from "react-router-dom"
import TxHashLink from "../components/TxHashLink"
import {
	useAdminStats,
	useAdminMilestones,
	type BatchMilestoneResponse,
	type MilestoneSubmission,
} from "../hooks/useAdmin"
import {
	useAdminContracts,
	useTreasuryPauseControl,
} from "../hooks/useAdminContracts"
import { useWallet } from "../hooks/useWallet"
import {
	useWikiPages,
	useCreateWikiPage,
	useUpdateWikiPage,
	useDeleteWikiPage,
	type WikiPage,
} from "../hooks/useWiki"
import { apiFetchJson } from "../lib/api"
import { getAuthToken } from "../util/auth"
import { shortenContractId } from "../util/contract"

type AdminSection =
	| "courses"
	| "milestones"
	| "users"
	| "wiki"
	| "treasury"
	| "contracts"
type CourseStatus = "draft" | "published"

interface AdminCourse {
	id: string
	slug: string
	title: string
	status: CourseStatus
	students: number
	track: string
	difficulty: string
}

interface ScholarLookupResponse {
	address: string
	lrn_balance: string
	enrolled_courses: string[]
	completed_milestones: number
	pending_milestones: number
	credentials: unknown[]
	joined_at: string
}

type CourseListResponse = {
	data?: ApiCourse[]
}

type ApiCourse = {
	id: number | string
	slug?: string
	title?: string
	track?: string
	difficulty?: string
	published?: boolean
	studentsCount?: number
	students_count?: number
}

const sectionDescriptions: Record<AdminSection, string> = {
	courses: "Live course records from the backend course catalog.",
	milestones: "Review milestone reports and approvals.",
	users: "Lookup learner profiles by wallet address.",
	wiki: "Create and edit platform documentation and guides.",
	treasury: "Monitor and manage live treasury controls.",
	contracts: "Inspect deployed contract addresses and on-chain state.",
}

const STATUSES = ["pending", "approved", "rejected"] as const

const formatDate = (value: string | undefined): string => {
	if (!value) return "—"

	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return value

	return date.toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	})
}

const formatCount = (value: number): string =>
	value.toLocaleString("en-US", { maximumFractionDigits: 0 })

const renderAddress = (value: string | undefined) =>
	value ? shortenContractId(value, 6, 6) : "Not available"

const mapAdminCourse = (course: ApiCourse): AdminCourse => ({
	id: String(course.id),
	slug: course.slug || String(course.id),
	title: course.title || "Untitled Course",
	status: course.published ? "published" : "draft",
	students: Number(course.studentsCount ?? course.students_count ?? 0),
	track: course.track || "General",
	difficulty: course.difficulty || "beginner",
})

function useAdminCoursesList() {
	return useQuery({
		queryKey: ["admin", "courses"],
		queryFn: async (): Promise<AdminCourse[]> => {
			const response = await apiFetchJson<CourseListResponse | ApiCourse[]>(
				"/api/courses?includeUnpublished=true&limit=100",
				{
					auth: true,
				},
			)
			const courses = Array.isArray(response) ? response : (response.data ?? [])
			return courses.map(mapAdminCourse)
		},
		staleTime: 60 * 1000,
	})
}

const ConfirmDialog: React.FC<{
	action: "approve" | "reject"
	milestone: MilestoneSubmission
	onConfirm: () => void
	onCancel: () => void
}> = ({ action, milestone, onConfirm, onCancel }) => (
	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="dialog-title"
		className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
	>
		<div className="glass border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
			<h2 id="dialog-title" className="text-lg font-semibold text-white mb-2">
				{action === "approve" ? "Approve Milestone" : "Reject Milestone"}
			</h2>
			<p className="text-sm text-white/60 mb-1">
				Learner:{" "}
				<span className="font-mono text-white/90">
					{milestone.learnerAddress}
				</span>
			</p>
			<p className="text-sm text-white/60 mb-4">
				Course: <span className="text-white/90">{milestone.course}</span>
			</p>
			<p className="text-sm text-white/60 mb-6">
				Are you sure you want to{" "}
				<strong
					className={action === "approve" ? "text-emerald-400" : "text-red-400"}
				>
					{action}
				</strong>{" "}
				this submission?
			</p>
			<div className="flex gap-3 justify-end">
				<button
					type="button"
					onClick={onCancel}
					className="px-4 py-2 text-sm rounded-xl border border-white/10 text-white/60 hover:text-white transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={onConfirm}
					className={`px-4 py-2 text-sm rounded-xl font-medium transition-colors ${
						action === "approve"
							? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
							: "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
					}`}
				>
					Confirm {action === "approve" ? "Approval" : "Rejection"}
				</button>
			</div>
		</div>
	</div>
)

const MilestoneStatsBar: React.FC = () => {
	const { stats, loading, error, fetchStats } = useAdminStats()

	useEffect(() => {
		void fetchStats()
	}, [fetchStats])

	const items = [
		{
			label: "Pending",
			value: stats?.pendingMilestones ?? "—",
			color: "text-yellow-400",
		},
		{
			label: "Approved Today",
			value: stats?.approvedToday ?? "—",
			color: "text-emerald-400",
		},
		{
			label: "Rejected Today",
			value: stats?.rejectedToday ?? "—",
			color: "text-red-400",
		},
	]

	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
			{error && (
				<p className="md:col-span-3 text-xs text-red-400">
					Could not load stats — {error}. Refresh the page to try again.
				</p>
			)}
			{items.map((item) => (
				<div
					key={item.label}
					className="glass border border-white/5 rounded-xl p-4"
				>
					<p className="text-xs text-white/40 uppercase tracking-widest mb-1">
						{item.label}
					</p>
					<p
						className={`text-2xl font-bold ${item.color} ${
							loading ? "opacity-40 animate-pulse" : ""
						}`}
					>
						{item.value}
					</p>
				</div>
			))}
		</div>
	)
}

const EvidenceLink: React.FC<{ value: string }> = ({ value }) => {
	if (!value) {
		return <span className="text-xs text-white/30">No evidence</span>
	}

	if (/^https?:\/\//.test(value)) {
		return (
			<a
				href={value}
				target="_blank"
				rel="noreferrer"
				className="text-xs text-brand-cyan hover:underline"
			>
				Open link
			</a>
		)
	}

	return <TxHashLink hash={value} />
}

const Admin: React.FC = () => {
	const [activeSection, setActiveSection] = useState<AdminSection>("courses")
	const navigate = useNavigate()
	const authToken = getAuthToken()

	useEffect(() => {
		if (!authToken) {
			void navigate("/")
		}
	}, [authToken, navigate])

	if (!authToken) return null

	return (
		<div className="flex min-h-screen text-white">
			<aside className="w-72 glass border-r border-white/5 p-8 flex flex-col gap-8">
				<nav className="flex flex-col gap-2">
					{(
						[
							"courses",
							"milestones",
							"users",
							"wiki",
							"treasury",
							"contracts",
						] as const
					).map((section) => (
						<button
							key={section}
							type="button"
							className={`w-full text-left px-4 py-3 rounded-xl capitalize ${
								activeSection === section
									? "bg-white/10 text-brand-cyan"
									: "text-white/60 hover:text-white"
							}`}
							onClick={() => setActiveSection(section)}
						>
							{section}
						</button>
					))}
				</nav>
				<p className="text-sm text-white/70">
					{sectionDescriptions[activeSection]}
				</p>
			</aside>

			<main className="flex-1 p-10">
				{activeSection === "courses" && <CourseManagement />}
				{activeSection === "milestones" && <MilestoneQueue />}
				{activeSection === "users" && <UserLookup />}
				{activeSection === "wiki" && <WikiManagement />}
				{activeSection === "treasury" && <TreasuryControls />}
				{activeSection === "contracts" && <ContractInfo />}
			</main>
		</div>
	)
}

const CourseManagement: React.FC = () => {
	const {
		data: courses = [],
		isLoading,
		error,
		refetch,
	} = useAdminCoursesList()
	const errorMessage = error instanceof Error ? error.message : null

	return (
		<section>
			<div className="flex items-center justify-between gap-4 mb-6">
				<div>
					<h1 className="text-3xl font-semibold text-white">Courses</h1>
					<p className="text-sm text-white/50 mt-1">
						Published and draft courses pulled from `/api/courses`.
					</p>
				</div>
				<button
					type="button"
					onClick={() => void refetch()}
					className="px-4 py-2 rounded-xl border border-white/10 text-sm text-white/70 hover:text-white hover:border-white/20 transition-colors"
				>
					Refresh
				</button>
			</div>

			{errorMessage && (
				<p className="text-sm text-red-400 mb-4">
					Could not load courses — {errorMessage}. Use the Refresh button above
					to retry.
				</p>
			)}

			<div className="grid gap-4">
				{isLoading && (
					<div className="glass border border-white/5 rounded-2xl p-6 text-sm text-white/40 animate-pulse">
						Loading live course records…
					</div>
				)}

				{!isLoading && courses.length === 0 && (
					<div className="glass border border-white/5 rounded-2xl p-6">
						<p className="text-white/70">No courses found.</p>
					</div>
				)}

				{courses.map((course) => (
					<div
						key={course.id}
						className="glass border border-white/5 rounded-2xl p-5"
					>
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<h2 className="text-lg font-medium text-white">
									{course.title}
								</h2>
								<p className="text-sm text-white/40 mt-1">{course.slug}</p>
							</div>
							<span
								className={`text-xs px-3 py-1 rounded-full border ${
									course.status === "published"
										? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
										: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10"
								}`}
							>
								{course.status}
							</span>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-sm">
							<div className="rounded-xl border border-white/5 bg-white/3 p-3">
								<p className="text-white/40 text-xs uppercase tracking-widest mb-1">
									Track
								</p>
								<p className="text-white/80">{course.track}</p>
							</div>
							<div className="rounded-xl border border-white/5 bg-white/3 p-3">
								<p className="text-white/40 text-xs uppercase tracking-widest mb-1">
									Difficulty
								</p>
								<p className="text-white/80 capitalize">{course.difficulty}</p>
							</div>
							<div className="rounded-xl border border-white/5 bg-white/3 p-3">
								<p className="text-white/40 text-xs uppercase tracking-widest mb-1">
									Students
								</p>
								<p className="text-white/80">{formatCount(course.students)}</p>
							</div>
						</div>
					</div>
				))}
			</div>
		</section>
	)
}

const MilestoneQueue: React.FC = () => {
	const { data: courseOptionsData = [], error: courseOptionsError } =
		useAdminCoursesList()
	const {
		milestones,
		total,
		page,
		pageSize,
		loading,
		error,
		fetchMilestones,
		approveMilestone,
		rejectMilestone,
	} = useAdminMilestones()
	const courseOptions = useMemo(
		() => ["All", ...courseOptionsData.map((course) => course.slug)],
		[courseOptionsData],
	)
	const [courseFilter, setCourseFilter] = useState("All")
	const [statusFilter, setStatusFilter] =
		useState<(typeof STATUSES)[number]>("pending")
	const [dialog, setDialog] = useState<{
		action: "approve" | "reject"
		milestone: MilestoneSubmission
	} | null>(null)

	useEffect(() => {
		void fetchMilestones(1, {
			course: courseFilter !== "All" ? courseFilter : undefined,
			status: statusFilter,
		})
	}, [courseFilter, statusFilter, fetchMilestones])

	const handlePageChange = (newPage: number) => {
		void fetchMilestones(newPage, {
			course: courseFilter !== "All" ? courseFilter : undefined,
			status: statusFilter,
		})
	}

	const handleConfirm = async () => {
		if (!dialog) return
		const { action, milestone } = dialog
		setDialog(null)
		if (action === "approve") {
			await approveMilestone(milestone.id)
		} else {
			await rejectMilestone(milestone.id)
		}
	}

	const pendingMilestones = milestones.filter(
		(milestone) => milestone.status === "pending",
	)
	const allPendingOnPageSelected =
		pendingMilestones.length > 0 &&
		pendingMilestones.every((milestone) =>
			selectedMilestoneIds.includes(milestone.id),
		)
	const selectedCount = selectedMilestoneIds.length

	const toggleMilestoneSelection = (milestoneId: string) => {
		setSelectedMilestoneIds((prev) =>
			prev.includes(milestoneId)
				? prev.filter((id) => id !== milestoneId)
				: [...prev, milestoneId],
		)
	}

	const toggleSelectAllPending = () => {
		setSelectedMilestoneIds((prev) => {
			if (allPendingOnPageSelected) {
				return prev.filter(
					(id) => !pendingMilestones.some((milestone) => milestone.id === id),
				)
			}

			const nextIds = new Set(prev)
			pendingMilestones.forEach((milestone) => nextIds.add(milestone.id))
			return Array.from(nextIds)
		})
	}

	const runBatchAction = async (action: "approve" | "reject") => {
		if (selectedMilestoneIds.length === 0) return

		const ids = [...selectedMilestoneIds]
		setBatchState({
			action,
			total: ids.length,
			inProgress: true,
			results: null,
		})

		try {
			const result =
				action === "approve"
					? await batchApproveMilestones(ids)
					: await batchRejectMilestones(ids)

			setBatchState({
				action,
				total: ids.length,
				inProgress: false,
				results: result,
			})

			if (result?.results.length) {
				const succeededIds = new Set(
					result.results
						.filter((item) => item.success)
						.map((item) => item.reportId),
				)
				setSelectedMilestoneIds((prev) =>
					prev.filter((id) => !succeededIds.has(id)),
				)
			}
		} catch {
			setBatchState({
				action,
				total: ids.length,
				inProgress: false,
				results: null,
			})
		}
	}

	const totalPages = Math.max(1, Math.ceil(total / pageSize))
	const coursesErrorMessage =
		courseOptionsError instanceof Error ? courseOptionsError.message : null

	return (
		<section>
			<MilestoneStatsBar />

			<div className="flex flex-wrap gap-3 mb-4 items-center">
				<div className="flex items-center gap-2">
					<label
						htmlFor="course-filter"
						className="text-xs text-white/40 uppercase tracking-widest"
					>
						Course
					</label>
					<select
						id="course-filter"
						value={courseFilter}
						onChange={(e) => setCourseFilter(e.target.value)}
						className="glass border border-white/10 text-white/80 text-sm rounded-xl px-3 py-1.5 bg-transparent focus:outline-none focus:border-white/20"
					>
						{courseOptions.map((course) => (
							<option key={course} value={course} className="bg-gray-900">
								{course}
							</option>
						))}
					</select>
				</div>
				<div className="flex items-center gap-2">
					<label
						htmlFor="status-filter"
						className="text-xs text-white/40 uppercase tracking-widest"
					>
						Status
					</label>
					<select
						id="status-filter"
						value={statusFilter}
						onChange={(e) =>
							setStatusFilter(e.target.value as (typeof STATUSES)[number])
						}
						className="glass border border-white/10 text-white/80 text-sm rounded-xl px-3 py-1.5 bg-transparent focus:outline-none focus:border-white/20"
					>
						{STATUSES.map((status) => (
							<option key={status} value={status} className="bg-gray-900">
								{status}
							</option>
						))}
					</select>
				</div>
			</div>

			{coursesErrorMessage && (
				<p className="text-xs text-red-400 mb-2">
					Could not load course filters — {coursesErrorMessage}. Filters may be
					incomplete.
				</p>
			)}

			{error && (
				<p className="text-xs text-red-400 mb-4">
					Could not load milestones — {error}. Try refreshing the page.
				</p>
			)}

			<div className="overflow-x-auto rounded-2xl border border-white/5 glass">
				<table className="w-full text-left">
					<thead>
						<tr className="border-b border-white/5 text-xs uppercase tracking-widest text-white/40">
							<th className="py-3 px-4 font-medium">Learner</th>
							<th className="py-3 px-4 font-medium">Course</th>
							<th className="py-3 px-4 font-medium">Submitted</th>
							<th className="py-3 px-4 font-medium">Evidence</th>
							<th className="py-3 px-4 font-medium">Status</th>
							<th className="py-3 px-4 font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{loading && (
							<tr>
								<td
									colSpan={6}
									className="py-12 text-center text-sm text-white/40 animate-pulse"
								>
									Loading milestones…
								</td>
							</tr>
						)}

						{!loading && milestones.length === 0 && (
							<tr>
								<td colSpan={6} className="py-12 text-center">
									<p className="text-white/40 text-sm">
										No milestone submissions found.
									</p>
									<p className="text-white/20 text-xs mt-1">
										Try adjusting your filters or check back later.
									</p>
								</td>
							</tr>
						)}

						{!loading &&
							milestones.map((milestone) => {
								const statusStyles: Record<
									MilestoneSubmission["status"],
									string
								> = {
									pending:
										"text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
									approved:
										"text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
									rejected: "text-red-400 bg-red-400/10 border-red-400/30",
								}

								return (
									<tr
										key={milestone.id}
										className="border-b border-white/5 hover:bg-white/3 transition-colors"
									>
										<td className="py-3 px-4">
											<span className="font-mono text-xs text-white/50">
												{shortenContractId(milestone.learnerAddress, 8, 4)}
											</span>
										</td>
										<td className="py-3 px-4 text-sm text-white/80">
											{milestone.course}
										</td>
										<td className="py-3 px-4 text-sm text-white/50">
											{formatDate(milestone.submittedAt)}
										</td>
										<td className="py-3 px-4">
											<EvidenceLink value={milestone.evidenceLink} />
										</td>
										<td className="py-3 px-4">
											<span
												className={`text-xs px-2 py-0.5 rounded-full border ${statusStyles[milestone.status]}`}
											>
												{milestone.status}
											</span>
										</td>
										<td className="py-3 px-4">
											{milestone.status === "pending" && (
												<div className="flex gap-2">
													<button
														type="button"
														onClick={() =>
															setDialog({
																action: "approve",
																milestone,
															})
														}
														className="px-3 py-1 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
													>
														Approve
													</button>
													<button
														type="button"
														onClick={() =>
															setDialog({
																action: "reject",
																milestone,
															})
														}
														className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
													>
														Reject
													</button>
												</div>
											)}
										</td>
									</tr>
								)
							})}
					</tbody>
				</table>
			</div>

			{total > pageSize && (
				<div className="flex items-center justify-between mt-4 text-sm text-white/40">
					<span>
						Page {page} of {totalPages} ({total} total)
					</span>
					<div className="flex gap-2">
						<button
							type="button"
							disabled={page <= 1}
							onClick={() => handlePageChange(page - 1)}
							className="px-3 py-1 rounded-xl border border-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
						>
							← Prev
						</button>
						<button
							type="button"
							disabled={page >= totalPages}
							onClick={() => handlePageChange(page + 1)}
							className="px-3 py-1 rounded-xl border border-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
						>
							Next →
						</button>
					</div>
				</div>
			)}

			{dialog && (
				<ConfirmDialog
					action={dialog.action}
					milestone={dialog.milestone}
					onConfirm={() => void handleConfirm()}
					onCancel={() => setDialog(null)}
				/>
			)}
		</section>
	)
}

const UserLookup: React.FC = () => {
	const [search, setSearch] = useState("")
	const [submittedAddress, setSubmittedAddress] = useState<string | null>(null)
	const [validationError, setValidationError] = useState<string | null>(null)
	const {
		data: userData,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["admin", "scholar", submittedAddress],
		queryFn: () =>
			apiFetchJson<ScholarLookupResponse>(
				`/api/scholars/${encodeURIComponent(submittedAddress!)}`,
			),
		enabled: Boolean(submittedAddress),
		retry: false,
	})

	const handleLookup = () => {
		const address = search.trim()
		if (!address) {
			setValidationError("Enter a wallet address to lookup a scholar.")
			return
		}

		setValidationError(null)
		setSubmittedAddress(address)
	}

	const errorMessage = error instanceof Error ? error.message : null

	return (
		<section>
			<div className="mb-6">
				<h1 className="text-3xl font-semibold text-white">Scholar Lookup</h1>
				<p className="text-sm text-white/50 mt-1">
					Live scholar data from the backend profile endpoint.
				</p>
			</div>

			<div className="glass border border-white/5 rounded-2xl p-5">
				<div className="flex flex-col sm:flex-row gap-3">
					<input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Enter a Stellar wallet address"
						className="flex-1 rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
					/>
					<button
						type="button"
						onClick={handleLookup}
						className="px-5 py-3 rounded-xl bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 hover:bg-brand-cyan/30 transition-colors"
					>
						Lookup
					</button>
				</div>

				{validationError && (
					<p className="text-xs text-red-400 mt-3">{validationError}</p>
				)}
				{errorMessage && (
					<p className="text-xs text-red-400 mt-3">
						Could not load scholar profile — {errorMessage}. Check the address
						and try again.
					</p>
				)}

				{isLoading && (
					<p className="text-sm text-white/40 mt-4 animate-pulse">
						Loading scholar profile…
					</p>
				)}

				{userData && !isLoading && (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
						<div className="rounded-xl border border-white/5 bg-white/3 p-4">
							<p className="text-xs text-white/40 uppercase tracking-widest mb-1">
								Address
							</p>
							<p className="text-sm font-mono text-white/85 break-all">
								{userData.address}
							</p>
						</div>
						<div className="rounded-xl border border-white/5 bg-white/3 p-4">
							<p className="text-xs text-white/40 uppercase tracking-widest mb-1">
								LRN Balance
							</p>
							<p className="text-sm text-white/85">
								{userData.lrn_balance} LRN
							</p>
						</div>
						<div className="rounded-xl border border-white/5 bg-white/3 p-4">
							<p className="text-xs text-white/40 uppercase tracking-widest mb-1">
								Enrolled Courses
							</p>
							<p className="text-sm text-white/85">
								{userData.enrolled_courses.length > 0
									? userData.enrolled_courses.join(", ")
									: "No enrollments"}
							</p>
						</div>
						<div className="rounded-xl border border-white/5 bg-white/3 p-4">
							<p className="text-xs text-white/40 uppercase tracking-widest mb-1">
								Completed Milestones
							</p>
							<p className="text-sm text-white/85">
								{formatCount(userData.completed_milestones)}
							</p>
						</div>
						<div className="rounded-xl border border-white/5 bg-white/3 p-4">
							<p className="text-xs text-white/40 uppercase tracking-widest mb-1">
								Pending Milestones
							</p>
							<p className="text-sm text-white/85">
								{formatCount(userData.pending_milestones)}
							</p>
						</div>
						<div className="rounded-xl border border-white/5 bg-white/3 p-4">
							<p className="text-xs text-white/40 uppercase tracking-widest mb-1">
								Credentials
							</p>
							<p className="text-sm text-white/85">
								{formatCount(userData.credentials.length)}
							</p>
						</div>
						<div className="rounded-xl border border-white/5 bg-white/3 p-4 sm:col-span-2 lg:col-span-3">
							<p className="text-xs text-white/40 uppercase tracking-widest mb-1">
								Joined
							</p>
							<p className="text-sm text-white/85">
								{formatDate(userData.joined_at)}
							</p>
						</div>
					</div>
				)}
			</div>
		</section>
	)
}

const TreasuryControls: React.FC = () => {
	const { address } = useWallet()
	const { data, isLoading, error, refetch } = useAdminContracts()
	const {
		pauseTreasury,
		unpauseTreasury,
		isPending,
		error: actionError,
	} = useTreasuryPauseControl()
	const [lastTxHash, setLastTxHash] = useState<string | null>(null)
	const treasuryState = data?.scholarshipTreasuryState
	const queryError = error instanceof Error ? error.message : null
	const isPaused = treasuryState?.paused ?? false
	const treasuryStatusLabel =
		treasuryState?.paused === true
			? "Paused"
			: treasuryState?.paused === false
				? "Active"
				: "Unknown"
	const treasuryStatusTone =
		treasuryState?.paused === true
			? "text-red-400"
			: treasuryState?.paused === false
				? "text-emerald-400"
				: "text-white/50"
	const connectedAdmin =
		address && treasuryState?.adminAddress
			? address === treasuryState.adminAddress
			: Boolean(address)

	const handleToggle = async () => {
		try {
			const txHash = isPaused ? await unpauseTreasury() : await pauseTreasury()
			setLastTxHash(txHash || null)
			await refetch()
		} catch {
			setLastTxHash(null)
		}
	}

	return (
		<section>
			<div className="mb-6">
				<h1 className="text-3xl font-semibold text-white">Treasury Controls</h1>
				<p className="text-sm text-white/50 mt-1">
					Live scholarship treasury pause state and admin action.
				</p>
			</div>

			<div className="glass border border-white/5 rounded-2xl p-6">
				{queryError && (
					<p className="text-sm text-red-400 mb-4">
						Could not load treasury contract state — {queryError}. Check your
						network connection and try again.
					</p>
				)}

				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
					<div className="rounded-xl border border-white/5 bg-white/3 p-4">
						<p className="text-xs text-white/40 uppercase tracking-widest mb-1">
							Contract
						</p>
						<p className="text-sm font-mono text-white/85 break-all">
							{treasuryState?.contractId || "Not configured"}
						</p>
					</div>
					<div className="rounded-xl border border-white/5 bg-white/3 p-4">
						<p className="text-xs text-white/40 uppercase tracking-widest mb-1">
							Admin
						</p>
						<p className="text-sm font-mono text-white/85 break-all">
							{treasuryState?.adminAddress || "Unavailable"}
						</p>
					</div>
					<div className="rounded-xl border border-white/5 bg-white/3 p-4">
						<p className="text-xs text-white/40 uppercase tracking-widest mb-1">
							Pause Status
						</p>
						<p className={`text-sm ${treasuryStatusTone}`}>
							{isLoading ? "Loading…" : treasuryStatusLabel}
						</p>
					</div>
				</div>

				<button
					type="button"
					onClick={() => void handleToggle()}
					disabled={
						isLoading ||
						isPending ||
						!treasuryState?.contractId ||
						!address ||
						!connectedAdmin
					}
					className={`px-5 py-3 rounded-xl border transition-colors ${
						isPaused
							? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
							: "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25"
					} disabled:opacity-40 disabled:cursor-not-allowed`}
				>
					{isPending
						? "Submitting…"
						: isPaused
							? "Resume DAO Treasury"
							: "Emergency Pause"}
				</button>

				{!address && (
					<p className="text-xs text-white/40 mt-3">
						Connect the admin wallet before submitting treasury actions.
					</p>
				)}

				{address && treasuryState?.adminAddress && !connectedAdmin && (
					<p className="text-xs text-yellow-400 mt-3">
						Connected wallet {renderAddress(address)} does not match the
						on-chain treasury admin {renderAddress(treasuryState.adminAddress)}.
					</p>
				)}

				{actionError && (
					<p className="text-xs text-red-400 mt-3">{actionError}</p>
				)}

				{lastTxHash && (
					<div className="mt-4 text-sm text-white/70">
						Last transaction: <TxHashLink hash={lastTxHash} />
					</div>
				)}
			</div>
		</section>
	)
}

const ContractStateCard: React.FC<{
	title: string
	contractId?: string
	adminAddress?: string
	paused?: boolean
	tokenLabel?: string
	tokenAddress?: string
	extraLabel?: string
	extraAddress?: string
}> = ({
	title,
	contractId,
	adminAddress,
	paused,
	tokenLabel,
	tokenAddress,
	extraLabel,
	extraAddress,
}) => {
	const stateTone =
		paused === true
			? "text-red-400 border-red-400/30 bg-red-400/10"
			: paused === false
				? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
				: "text-white/50 border-white/10 bg-white/5"
	const stateLabel =
		paused === true ? "Paused" : paused === false ? "Active" : "Unknown"

	return (
		<div className="glass border border-white/5 rounded-2xl p-5">
			<div className="flex items-start justify-between gap-3 mb-4">
				<div>
					<h2 className="text-lg font-medium text-white">{title}</h2>
					<p className="text-xs text-white/40 mt-1">
						Live on-chain contract state
					</p>
				</div>
				<span className={`text-xs px-3 py-1 rounded-full border ${stateTone}`}>
					{stateLabel}
				</span>
			</div>
			<div className="space-y-3 text-sm">
				<div>
					<p className="text-white/40 text-xs uppercase tracking-widest mb-1">
						Contract ID
					</p>
					<p className="font-mono text-white/85 break-all">
						{contractId || "Not configured"}
					</p>
				</div>
				<div>
					<p className="text-white/40 text-xs uppercase tracking-widest mb-1">
						Admin Address
					</p>
					<p className="font-mono text-white/85 break-all">
						{adminAddress || "Unavailable"}
					</p>
				</div>
				{tokenLabel && (
					<div>
						<p className="text-white/40 text-xs uppercase tracking-widest mb-1">
							{tokenLabel}
						</p>
						<p className="font-mono text-white/85 break-all">
							{tokenAddress || "Unavailable"}
						</p>
					</div>
				)}
				{extraLabel && (
					<div>
						<p className="text-white/40 text-xs uppercase tracking-widest mb-1">
							{extraLabel}
						</p>
						<p className="font-mono text-white/85 break-all">
							{extraAddress || "Unavailable"}
						</p>
					</div>
				)}
			</div>
		</div>
	)
}

const ContractInfo: React.FC = () => {
	const { data, isLoading, error } = useAdminContracts()
	const errorMessage = error instanceof Error ? error.message : null

	return (
		<section>
			<div className="mb-6">
				<h1 className="text-3xl font-semibold text-white">Contract Info</h1>
				<p className="text-sm text-white/50 mt-1">
					Registry-backed contract IDs plus live state for admin-managed
					contracts.
				</p>
			</div>

			{errorMessage && (
				<p className="text-sm text-red-400 mb-4">
					Failed to load contract state: {errorMessage}
				</p>
			)}

			<div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
				<ContractStateCard
					title="Scholarship Treasury"
					contractId={data?.scholarshipTreasuryState?.contractId}
					adminAddress={data?.scholarshipTreasuryState?.adminAddress}
					paused={data?.scholarshipTreasuryState?.paused}
					tokenLabel="Governance Token"
					tokenAddress={data?.scholarshipTreasuryState?.governanceTokenAddress}
					extraLabel="USDC Token"
					extraAddress={data?.scholarshipTreasuryState?.usdcTokenAddress}
				/>
				<ContractStateCard
					title="Course Milestone"
					contractId={data?.courseMilestoneState?.contractId}
					adminAddress={data?.courseMilestoneState?.adminAddress}
					paused={data?.courseMilestoneState?.paused}
					tokenLabel="Learn Token"
					tokenAddress={data?.courseMilestoneState?.tokenAddress}
				/>
			</div>

			<div className="glass border border-white/5 rounded-2xl p-5">
				<div className="flex items-center justify-between gap-3 mb-4">
					<div>
						<h2 className="text-lg font-medium text-white">
							Deployed Contract Registry
						</h2>
						<p className="text-xs text-white/40 mt-1">
							Resolved from env-backed contract IDs.
						</p>
					</div>
					{isLoading && (
						<span className="text-xs text-white/40 animate-pulse">
							Loading…
						</span>
					)}
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{data?.registry.map((contract) => (
						<div
							key={contract.key}
							className="rounded-xl border border-white/5 bg-white/3 p-4"
						>
							<p className="text-xs text-white/40 uppercase tracking-widest mb-1">
								{contract.name}
							</p>
							<p className="font-mono text-sm text-white/85 break-all">
								{contract.contractId || "Not configured"}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	)
}

const WikiManagement: React.FC = () => {
	const { data: pages = [], isLoading } = useWikiPages()
	const createMutation = useCreateWikiPage()
	const updateMutation = useUpdateWikiPage()
	const deleteMutation = useDeleteWikiPage()

	const [editingPage, setEditingPage] = useState<Partial<WikiPage> | null>(null)
	const [isPreview, setIsPreview] = useState(false)

	const handleSave = async () => {
		if (!editingPage) return
		if (editingPage.id) {
			await updateMutation.mutateAsync(editingPage as WikiPage & { id: number })
		} else {
			await createMutation.mutateAsync(editingPage)
		}
		setEditingPage(null)
	}

	const handleDelete = async (id: number) => {
		if (window.confirm("Are you sure you want to delete this page?")) {
			await deleteMutation.mutateAsync(id)
		}
	}

	return (
		<section>
			<div className="flex items-center justify-between gap-4 mb-6">
				<div>
					<h1 className="text-3xl font-semibold text-white">Wiki Management</h1>
					<p className="text-sm text-white/50 mt-1">
						Manage platform documentation and guides.
					</p>
				</div>
				<button
					type="button"
					onClick={() =>
						setEditingPage({
							title: "",
							slug: "",
							content: "",
							category: "General",
							isPublished: true,
						})
					}
					className="px-4 py-2 rounded-xl bg-brand-cyan text-black font-bold text-sm hover:scale-105 transition-all"
				>
					+ New Page
				</button>
			</div>

			{editingPage ? (
				<div className="glass border border-white/10 rounded-2xl p-8 flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
					<div className="flex items-center justify-between">
						<h2 className="text-xl font-bold">
							{editingPage.id ? "Edit Page" : "New Page"}
						</h2>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => setIsPreview(!isPreview)}
								className="px-3 py-1 text-xs rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
							>
								{isPreview ? "Edit Source" : "Preview"}
							</button>
							<button
								type="button"
								onClick={() => setEditingPage(null)}
								className="px-3 py-1 text-xs rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
							>
								Cancel
							</button>
						</div>
					</div>

					{isPreview ? (
						<article className="prose prose-invert prose-brand max-w-none p-6 border border-white/5 rounded-xl min-h-[300px]">
							<h1 className="text-3xl font-bold mb-4">
								{editingPage.title || "Untitled"}
							</h1>
							<ReactMarkdown>{editingPage.content || ""}</ReactMarkdown>
						</article>
					) : (
						<div className="grid grid-cols-2 gap-4">
							<div className="flex flex-col gap-1">
								<label className="text-xs text-white/40 uppercase tracking-widest">
									Title
								</label>
								<input
									className="glass border border-white/10 rounded-xl px-4 py-2 bg-transparent text-white"
									value={editingPage.title}
									onChange={(e) =>
										setEditingPage({ ...editingPage, title: e.target.value })
									}
								/>
							</div>
							<div className="flex flex-col gap-1">
								<label className="text-xs text-white/40 uppercase tracking-widest">
									Slug
								</label>
								<input
									className="glass border border-white/10 rounded-xl px-4 py-2 bg-transparent text-white"
									value={editingPage.slug}
									onChange={(e) =>
										setEditingPage({ ...editingPage, slug: e.target.value })
									}
								/>
							</div>
							<div className="flex flex-col gap-1">
								<label className="text-xs text-white/40 uppercase tracking-widest">
									Category
								</label>
								<input
									className="glass border border-white/10 rounded-xl px-4 py-2 bg-transparent text-white"
									value={editingPage.category}
									onChange={(e) =>
										setEditingPage({ ...editingPage, category: e.target.value })
									}
								/>
							</div>
							<div className="flex items-center gap-2 pt-6">
								<input
									type="checkbox"
									checked={editingPage.isPublished}
									onChange={(e) =>
										setEditingPage({
											...editingPage,
											isPublished: e.target.checked,
										})
									}
								/>
								<label className="text-sm">Published</label>
							</div>
							<div className="col-span-2 flex flex-col gap-1">
								<label className="text-xs text-white/40 uppercase tracking-widest">
									Content (Markdown)
								</label>
								<textarea
									className="glass border border-white/10 rounded-xl px-4 py-2 bg-transparent text-white min-h-[400px] font-mono text-sm"
									value={editingPage.content}
									onChange={(e) =>
										setEditingPage({ ...editingPage, content: e.target.value })
									}
								/>
							</div>
						</div>
					)}

					<div className="flex justify-end pt-4">
						<button
							type="button"
							onClick={handleSave}
							disabled={createMutation.isPending || updateMutation.isPending}
							className="px-8 py-3 rounded-xl bg-brand-cyan text-black font-black uppercase tracking-widest hover:scale-105 transition-all"
						>
							{createMutation.isPending || updateMutation.isPending
								? "Saving..."
								: "Save Page"}
						</button>
					</div>
				</div>
			) : (
				<div className="grid gap-4">
					{isLoading ? (
						<div className="glass border border-white/5 rounded-2xl p-6 text-sm text-white/40 animate-pulse">
							Loading wiki pages…
						</div>
					) : pages.length === 0 ? (
						<div className="glass border border-white/5 rounded-2xl p-12 text-center text-white/30">
							No wiki pages found. Click "+ New Page" to get started.
						</div>
					) : (
						pages.map((page) => (
							<div
								key={page.id}
								className="glass border border-white/5 rounded-2xl p-5 flex items-center justify-between group"
							>
								<div>
									<div className="flex items-center gap-3">
										<h2 className="text-lg font-medium text-white">
											{page.title}
										</h2>
										<span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40">
											{page.category}
										</span>
										{!page.isPublished && (
											<span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
												Draft
											</span>
										)}
									</div>
									<p className="text-xs text-white/30 mt-1">
										/wiki/{page.slug}
									</p>
								</div>
								<div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
									<button
										type="button"
										onClick={() => setEditingPage(page)}
										className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
									>
										Edit
									</button>
									<button
										type="button"
										onClick={() => handleDelete(page.id)}
										className="p-2 rounded-lg border border-white/10 hover:bg-red-500/10 hover:text-red-400 transition-colors"
									>
										Delete
									</button>
								</div>
							</div>
						))
					)}
				</div>
			)}
		</section>
	)
}

export default Admin
