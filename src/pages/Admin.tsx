import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
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

interface CourseImportRow {
	title: string
	slug: string
	track: string
	difficulty: string
	description?: string
	coverImage?: string | null
	published?: boolean
}

interface BulkImportResult {
	row: number
	slug: string
	success: boolean
	errors: string[]
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
	const { t } = useTranslation()
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
						{t(`admin.sections.${section}`)}
					</button>
				))}
			</nav>
			<p className="text-sm text-white/70">
				{t(`admin.sectionDescriptions.${activeSection}`)}
// CourseManagement — unchanged
// ---------------------------------------------------------------------------
const parseCsvText = (csvText: string): CourseImportRow[] => {
	const rows = csvText
		.trim()
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)

	if (rows.length < 2) {
		return []
	}

	const headers = rows[0].split(",").map((header) => header.trim())

	return rows.slice(1).map((line) => {
		const values = line.split(",").map((value) => value.trim())
		const record: Record<string, string> = {}
		headers.forEach((header, index) => {
			record[header] = values[index] ?? ""
		})
		return {
			title: record.title || record.Title || "",
			slug: record.slug || record.Slug || "",
			track: record.track || record.Track || "",
			difficulty: record.difficulty || record.Difficulty || "",
			description: record.description || record.Description || "",
			coverImage: record.coverImage || record.CoverImage || null,
			published:
				(record.published || record.Published || "").toLowerCase() === "true",
		}
	})
}

const isCourseRowValid = (row: CourseImportRow) => {
	return (
		row.title.trim().length > 0 &&
		row.slug.trim().length > 0 &&
		row.track.trim().length > 0 &&
		row.difficulty.trim().length > 0
	)
}

const CourseManagement: React.FC = () => {
	const { t } = useTranslation()
	const [courses, setCourses] = useState<AdminCourse[]>(initialCourses)
	const [fileName, setFileName] = useState("")
	const [previewRows, setPreviewRows] = useState<CourseImportRow[]>([])
	const [previewErrors, setPreviewErrors] = useState<string[]>([])
	const [importResults, setImportResults] = useState<BulkImportResult[]>([])
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [alertMessage, setAlertMessage] = useState<string | null>(null)

	const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		setImportResults([])
		setAlertMessage(null)
		const file = event.target.files?.[0]
		if (!file) {
			return
		}

		setFileName(file.name)
		const contents = await file.text()
		let rows: CourseImportRow[] = []
		if (file.name.toLowerCase().endsWith(".json")) {
			try {
				const parsed = JSON.parse(contents)
				rows = Array.isArray(parsed) ? parsed : parsed.courses ?? []
			} catch {
				setPreviewErrors([t("admin.import.invalidJson")])
				return
			}
		} else {
			rows = parseCsvText(contents)
		}

		const errors: string[] = []
		const normalizedRows = rows.map((row, index) => {
			const normalized = {
				...row,
				title: row.title?.trim() ?? "",
				slug: row.slug?.trim() ?? "",
				track: row.track?.trim() ?? "",
				difficulty: row.difficulty?.trim() ?? "",
				description: row.description?.trim(),
				coverImage: row.coverImage?.trim() || null,
				published: Boolean(row.published),
			}

			if (!isCourseRowValid(normalized)) {
				errors.push(`${t("admin.import.invalidRow")} ${index + 1}`)
			}

			return normalized
		})

		setPreviewRows(normalizedRows)
		setPreviewErrors(errors)
	}

	const handleImport = async () => {
		setIsSubmitting(true)
		setImportResults([])
		setAlertMessage(null)
		const token = localStorage.getItem("admin_token") ?? ""

		try {
			const response = await fetch("/api/admin/courses/bulk-import", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ courses: previewRows }),
			})

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}))
				throw new Error(errorData.error || t("admin.import.importFailed"))
			}

			const data = (await response.json()) as {
				results: BulkImportResult[]
				total: number
				imported: number
			}
			setImportResults(data.results)
			setAlertMessage(t("admin.import.importSuccess", { count: data.imported }))
		} catch (error) {
			setAlertMessage(String(error))
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<section className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-4 mb-6">
				<div>
					<h1 className="text-2xl font-semibold text-white">
						{t("admin.import.title")}
					</h1>
					<p className="text-sm text-white/60 mt-2 max-w-2xl">
						{t("admin.import.description")}
					</p>
				</div>
			</div>

			<div className="glass border border-white/10 rounded-3xl p-6">
				<label className="block text-sm font-medium text-white/80 mb-3">
					{t("admin.import.uploadLabel")}
				</label>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<input
						aria-label={t("admin.import.uploadLabel")}
						onChange={handleFileUpload}
						type="file"
						accept=".csv,.json"
						className="block w-full max-w-xs text-sm text-white/80 file:mr-4 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-white/20"
					/>
					<span className="text-sm text-white/50">{fileName || t("admin.import.noFileSelected")}</span>
				</div>
				{previewErrors.length > 0 && (
					<div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
						{previewErrors.map((error) => (
							<p key={error}>{error}</p>
						))}
					</div>
				)}
				{previewRows.length > 0 && (
					<div className="mt-6 space-y-4">
						<div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
							<p className="text-sm text-white/70">
								{t("admin.import.previewHeader", { count: previewRows.length })}
							</p>
							<div className="overflow-x-auto mt-4 rounded-2xl border border-white/10">
								<table className="min-w-full text-left text-sm text-white/80">
									<thead>
										<tr className="bg-white/5 text-white/60 uppercase tracking-wider">
											<th className="px-4 py-3">{t("admin.import.table.title")}</th>
											<th className="px-4 py-3">{t("admin.import.table.slug")}</th>
											<th className="px-4 py-3">{t("admin.import.table.track")}</th>
											<th className="px-4 py-3">{t("admin.import.table.difficulty")}</th>
											<th className="px-4 py-3">{t("admin.import.table.published")}</th>
										</tr>
									</thead>
									<tbody>
										{previewRows.map((row, index) => (
											<tr key={`${row.slug}-${index}`} className="border-t border-white/5">
												<td className="px-4 py-3">{row.title}</td>
												<td className="px-4 py-3 font-mono text-white/70">{row.slug}</td>
												<td className="px-4 py-3">{row.track}</td>
												<td className="px-4 py-3">{row.difficulty}</td>
												<td className="px-4 py-3">{row.published ? t("admin.import.yes") : t("admin.import.no")}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
						<div className="flex flex-wrap gap-3">
							<button
								type="button"
								onClick={handleImport}
								disabled={isSubmitting || previewErrors.length > 0}
								className="rounded-2xl bg-brand-cyan px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
							>
								{isSubmitting ? t("admin.import.importing") : t("admin.import.importButton")}
							</button>
							<span className="text-sm text-white/50">{t("admin.import.confirmPreview")}</span>
						</div>
					</div>
				)}
				{alertMessage && (
					<div className="mt-4 rounded-2xl border border-white/10 bg-emerald-500/10 p-4 text-sm text-emerald-100">
						{alertMessage}
					</div>
				)}
				{importResults.length > 0 && (
					<div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
						<p className="text-sm text-white/70 mb-3">
							{t("admin.import.resultsHeader")}
						</p>
						<ul className="space-y-2 text-sm text-white/80">
							{importResults.map((result) => (
								<li key={`${result.slug}-${result.row}`}> 
									<strong>{t("admin.import.rowLabel", { row: result.row })}</strong>: {result.success ? t("admin.import.rowSuccess") : t("admin.import.rowFailure")}
									{result.errors.length > 0 && (
										<ul className="mt-1 list-disc pl-5 text-red-200">
											{result.errors.map((error) => (
												<li key={error}>{error}</li>
											))}
										</ul>
									)}
								</li>
							))}
						</ul>
					</div>
				)}
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
