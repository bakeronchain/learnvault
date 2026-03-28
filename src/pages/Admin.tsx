import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import TxHashLink from "../components/TxHashLink"
import {
	useAdminStats,
	useAdminMilestones,
	type MilestoneSubmission,
} from "../hooks/useAdmin"

type AdminSection =
	| "courses"
	| "milestones"
	| "users"
	| "treasury"
	| "contracts"
type CourseStatus = "draft" | "published"

interface AdminCourse {
	id: number
	title: string
	status: CourseStatus
	students: number
}

interface UserProfilePreview {
	address: string
	balance: string
	enrollment: string
	tier: string
}

interface ContractRecord {
	name: string
	tag: string
	address: string
	updated: string
}

const sectionDescriptions: Record<AdminSection, string> = {
	courses: "Create and manage course modules.",
	milestones: "Review milestone reports and approvals.",
	users: "Lookup learner profiles by wallet address.",
	treasury: "Monitor and manage treasury controls.",
	contracts: "Inspect deployed on-chain contract records.",
}

const initialCourses: AdminCourse[] = [
	{ id: 1, title: "Soroban Basics", status: "published", students: 84 },
	{ id: 2, title: "Stellar Security", status: "draft", students: 0 },
]

const contractRecords: ContractRecord[] = [
	{
		name: "Scholarship Treasury",
		tag: "prod",
		address: "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
		updated: "2026-03-20",
	},
	{
		name: "Governance Token",
		tag: "prod",
		address: "CYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY",
		updated: "2026-03-20",
	},
]

const COURSES = [
	"All",
	"Soroban Basics",
	"Stellar Security",
	"Web3 Dev",
	"DeFi",
	"Frontend Dev",
]
const STATUSES = ["pending", "approved", "rejected"]

// ---------------------------------------------------------------------------
// Confirmation dialog
// ---------------------------------------------------------------------------
interface ConfirmDialogProps {
	action: "approve" | "reject"
	milestone: MilestoneSubmission
	onConfirm: () => void
	onCancel: () => void
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
	action,
	milestone,
	onConfirm,
	onCancel,
}) => (
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
				this submission? This action cannot be undone.
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

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------
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
		<div className="grid grid-cols-3 gap-3 mb-6">
			{error && (
				<p className="col-span-3 text-xs text-red-400">
					Failed to load stats: {error}
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

// ---------------------------------------------------------------------------
// Admin component
// ---------------------------------------------------------------------------
const Admin: React.FC = () => {
	const [activeSection, setActiveSection] = useState<AdminSection>("courses")
	const [isAdmin, setIsAdmin] = useState(false)
	const navigate = useNavigate()

	useEffect(() => {
		const token = localStorage.getItem("admin_token")
		if (token === "mock-admin-jwt") {
			setIsAdmin(true)
			return
		}
		void navigate("/")
	}, [navigate])

	if (!isAdmin) return null

	return (
		<div className="flex min-h-screen text-white">
			<aside className="w-72 glass border-r border-white/5 p-8 flex flex-col gap-8">
				<nav className="flex flex-col gap-2">
					{(
						["courses", "milestones", "users", "treasury", "contracts"] as const
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
				{activeSection === "treasury" && <TreasuryControls />}
				{activeSection === "contracts" && <ContractInfo />}
			</main>
		</div>
	)
}

// ---------------------------------------------------------------------------
// CourseManagement — unchanged
// ---------------------------------------------------------------------------
const CourseManagement: React.FC = () => {
	const [courses, setCourses] = useState<AdminCourse[]>(initialCourses)
	return (
		<section>
			<button
				type="button"
				onClick={() =>
					setCourses((c) => [
						...c,
						{
							id: c.length + 1,
							title: `New Course ${c.length + 1}`,
							status: "draft",
							students: 0,
						},
					])
				}
			>
				New Course
			</button>
			<div className="mt-6">
				{courses.map((course) => (
					<div key={course.id} className="py-2">
						{course.title} - {course.status}
					</div>
				))}
			</div>
		</section>
	)
}

// ---------------------------------------------------------------------------
// MilestoneQueue — fully replaced
// ---------------------------------------------------------------------------
const MilestoneQueue: React.FC = () => {
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

	const [courseFilter, setCourseFilter] = useState("All")
	const [statusFilter, setStatusFilter] = useState("pending")
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
		if (action === "approve") await approveMilestone(milestone.id)
		else await rejectMilestone(milestone.id)
	}

	const totalPages = Math.ceil(total / pageSize)

	return (
		<section>
			{/* Stats bar */}
			<MilestoneStatsBar />

			{/* Filters */}
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
						{COURSES.map((c) => (
							<option key={c} className="bg-gray-900">
								{c}
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
						onChange={(e) => setStatusFilter(e.target.value)}
						className="glass border border-white/10 text-white/80 text-sm rounded-xl px-3 py-1.5 bg-transparent focus:outline-none focus:border-white/20"
					>
						{STATUSES.map((s) => (
							<option key={s} className="bg-gray-900">
								{s}
							</option>
						))}
					</select>
				</div>
			</div>

			{/* Error */}
			{error && (
				<p className="text-xs text-red-400 mb-4">
					Error loading milestones: {error}
				</p>
			)}

			{/* Table */}
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
							milestones.map((m) => {
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
										key={m.id}
										className="border-b border-white/5 hover:bg-white/3 transition-colors"
									>
										<td className="py-3 px-4">
											<span className="font-mono text-xs text-white/50">
												{m.learnerAddress.slice(0, 8)}…
												{m.learnerAddress.slice(-4)}
											</span>
										</td>
										<td className="py-3 px-4 text-sm text-white/80">
											{m.course}
										</td>
										<td className="py-3 px-4 text-sm text-white/50">
											{new Date(m.submittedAt).toLocaleDateString("en-GB", {
												day: "2-digit",
												month: "short",
												year: "numeric",
											})}
										</td>
										<td className="py-3 px-4">
											<TxHashLink hash={m.evidenceLink} />
										</td>
										<td className="py-3 px-4">
											<span
												className={`text-xs px-2 py-0.5 rounded-full border ${statusStyles[m.status]}`}
											>
												{m.status}
											</span>
										</td>
										<td className="py-3 px-4">
											{m.status === "pending" && (
												<div className="flex gap-2">
													<button
														type="button"
														onClick={() =>
															setDialog({ action: "approve", milestone: m })
														}
														aria-label={`Approve milestone for ${m.learnerAddress}`}
														className="px-3 py-1 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
													>
														Approve
													</button>
													<button
														type="button"
														onClick={() =>
															setDialog({ action: "reject", milestone: m })
														}
														aria-label={`Reject milestone for ${m.learnerAddress}`}
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

			{/* Pagination */}
			{totalPages > 1 && (
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

			{/* Confirmation dialog */}
			{dialog && (
				<ConfirmDialog
					action={dialog.action}
					milestone={dialog.milestone}
					onConfirm={handleConfirm}
					onCancel={() => setDialog(null)}
				/>
			)}
		</section>
	)
}

// ---------------------------------------------------------------------------
// UserLookup — unchanged
// ---------------------------------------------------------------------------
const UserLookup: React.FC = () => {
	const [search, setSearch] = useState("")
	const [userData, setUserData] = useState<UserProfilePreview | null>(null)
	return (
		<section>
			<input
				value={search}
				onChange={(event) => setSearch(event.target.value)}
			/>
			<button
				type="button"
				onClick={() =>
					setUserData({
						address: search.trim(),
						balance: "250 LRN",
						enrollment: "Stellar Basics",
						tier: "Elite Learner",
					})
				}
			>
				Lookup
			</button>
			{userData ? <p>{userData.address}</p> : null}
		</section>
	)
}

// ---------------------------------------------------------------------------
// TreasuryControls — unchanged
// ---------------------------------------------------------------------------
const TreasuryControls: React.FC = () => {
	const [isPaused, setIsPaused] = useState(false)
	return (
		<section>
			<button type="button" onClick={() => setIsPaused((value) => !value)}>
				{isPaused ? "Resume DAO Treasury" : "Emergency Pause"}
			</button>
		</section>
	)
}

// ---------------------------------------------------------------------------
// ContractInfo — unchanged
// ---------------------------------------------------------------------------
const ContractInfo: React.FC = () => {
	return (
		<section>
			{contractRecords.map((contract) => (
				<div key={contract.name}>
					<strong>{contract.name}</strong> {contract.updated}
				</div>
			))}
		</section>
	)
}

export default Admin
