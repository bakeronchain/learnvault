import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import TxHashLink from "../components/TxHashLink"

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

const MilestoneQueue: React.FC = () => {
	const [notice, setNotice] = useState<string | null>(null)
	const [submissions, setSubmissions] = useState([
		{
			id: 101,
			scholar: "G...ABC",
			reportTxHash:
				"de6f42f58b785fd2292d9f79089ca7a8e6769f0aa65eb6fe2c56b1e4f82de6a1",
			approvalTxHash:
				"7d6a011db9a6f1cb966d2c1ed44b42d416f3b53d14f1277c59823d88efab4653",
		},
	])

	const handleAction = (id: number, action: "approve" | "reject") => {
		setSubmissions((current) =>
			current.filter((submission) => submission.id !== id),
		)
		setNotice(
			action === "approve"
				? `Milestone #${id} approved.`
				: `Milestone #${id} rejected.`,
		)
	}

	return (
		<section>
			{notice ? <p>{notice}</p> : null}
			{submissions.map((submission) => (
				<div key={submission.id} className="py-3">
					<div>Scholar: {submission.scholar}</div>
					<TxHashLink hash={submission.reportTxHash} />
					<TxHashLink hash={submission.approvalTxHash} />
					<div className="mt-2 flex gap-2">
						<button
							type="button"
							onClick={() => handleAction(submission.id, "approve")}
						>
							Approve
						</button>
						<button
							type="button"
							onClick={() => handleAction(submission.id, "reject")}
						>
							Reject
						</button>
					</div>
				</div>
			))}
		</section>
	)
}

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
