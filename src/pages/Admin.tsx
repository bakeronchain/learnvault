import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

const Admin: React.FC = () => {
	const [activeSection, setActiveSection] = useState<string>("courses")
	const [isAdmin, setIsAdmin] = useState<boolean>(false)
	const navigate = useNavigate()

	useEffect(() => {
		const token = localStorage.getItem("admin_token")
		if (token === "mock-admin-jwt") {
			setIsAdmin(true)
		} else {
			const searchParams = new URLSearchParams(window.location.search)
			if (searchParams.get("login") === "admin") {
				localStorage.setItem("admin_token", "mock-admin-jwt")
				setIsAdmin(true)
			} else {
				void navigate("/")
			}
		}
	}, [navigate])

	if (!isAdmin) return null

	return (
		<div className="flex min-h-screen text-white relative overflow-hidden">
			{/* Background Accent */}
			<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-cyan/10 blur-[120px] rounded-full" />
			<div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-purple/10 blur-[120px] rounded-full" />

			<aside className="w-72 glass border-r border-white/5 p-8 flex flex-col gap-10 z-10">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 bg-linear-to-br from-brand-cyan to-brand-blue rounded-xl flex items-center justify-center font-black text-xs shadow-lg shadow-brand-cyan/20">
						LV
					</div>
					<h2 className="text-xl font-black tracking-tighter text-gradient">
						LEARNVAULT
					</h2>
				</div>
				<nav className="flex flex-col gap-3">
					{["courses", "milestones", "users", "treasury", "contracts"].map(
						(section) => (
							<button
								key={section}
								className={`w-full text-left px-5 py-3.5 rounded-xl capitalize transition-all duration-300 relative group overflow-hidden ${
									activeSection === section
										? "text-brand-cyan font-bold"
										: "text-white/40 hover:text-white"
								}`}
								onClick={() => setActiveSection(section)}
							>
								{activeSection === section && (
									<div className="absolute inset-0 bg-white/5 animate-pulse" />
								)}
								<span className="relative z-10 flex items-center gap-3">
									<span
										className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${activeSection === section ? "bg-brand-cyan scale-125 shadow-[0_0_10px_rgba(0,210,255,0.8)]" : "bg-transparent"}`}
									/>
									{section}
								</span>
							</button>
						),
					)}
				</nav>
			</aside>
			<main className="flex-1 p-12 overflow-y-auto z-10 animate-in fade-in slide-in-from-right-4 duration-700">
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
	const [courses, setCourses] = useState([
		{
			id: 1,
			title: "Introduction to Soroban",
			status: "published",
			students: 124,
		},
		{ id: 2, title: "Advanced Smart Contracts", status: "draft", students: 0 },
	])

	const addCourse = () => {
		const newCourse = {
			id: courses.length + 1,
			title: "New Course",
			status: "draft",
			students: 0,
		}
		setCourses([...courses, newCourse])
	}

	return (
		<section className="glass-card p-10 rounded-[2.5rem]">
			<div className="flex justify-between items-center mb-12">
				<div>
					<h3 className="text-3xl font-black mb-2">Course Management</h3>
					<p className="text-white/40 text-sm">
						Create and oversee your educational modules on-chain.
					</p>
				</div>
				<button
					className="px-8 py-3 bg-linear-to-r from-brand-cyan to-brand-blue rounded-full font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand-cyan/20 uppercase tracking-widest"
					onClick={addCourse}
				>
					+ New Course
				</button>
			</div>
			<div className="overflow-hidden rounded-2xl border border-white/5">
				<table className="w-full text-left border-collapse">
					<thead>
						<tr className="bg-white/5 text-white/40 text-[10px] uppercase tracking-[2px] font-black">
							<th className="p-5">Course ID</th>
							<th className="p-5">Module Title</th>
							<th className="p-5">Learners</th>
							<th className="p-5">Status</th>
							<th className="p-5 text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{courses.map((course) => (
							<tr
								key={course.id}
								className="border-t border-white/5 hover:bg-white/[0.03] transition-colors group"
							>
								<td className="p-5 font-mono text-xs text-white/50">
									#00{course.id}
								</td>
								<td className="p-5 font-bold">{course.title}</td>
								<td className="p-5 text-white/60">{course.students}</td>
								<td className="p-5">
									<span
										className={`px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-wider ${
											course.status === "published"
												? "bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20"
												: "bg-white/10 text-white/40 border border-white/10"
										}`}
									>
										{course.status}
									</span>
								</td>
								<td className="p-5 text-right flex justify-end gap-2">
									<button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white">
										✎
									</button>
									<button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-brand-purple">
										✖
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	)
}

const MilestoneQueue: React.FC = () => {
	const [submissions, setSubmissions] = useState([
		{
			id: 101,
			scholar: "G...ABC",
			amount: "50 USDC",
			date: "2024-03-20",
			proof: "ipfs://...",
		},
		{
			id: 102,
			scholar: "G...XYZ",
			amount: "100 USDC",
			date: "2024-03-21",
			proof: "ipfs://...",
		},
	])

	const handleAction = (id: number, action: "approve" | "reject") => {
		if (action === "reject") {
			const reason = prompt("Mandatory reason for rejection:")
			if (!reason) return
		}
		setSubmissions(submissions.filter((s) => s.id !== id))
		alert(`Milestone #${id} ${action}d!`)
	}

	return (
		<section className="glass-card p-10 rounded-[2.5rem]">
			<h3 className="text-3xl font-black mb-2">Milestone Queue</h3>
			<p className="text-white/40 text-sm mb-12">
				Verify completed milestones and release funding tranches.
			</p>
			<div className="grid grid-cols-1 gap-6">
				{submissions.map((sub) => (
					<div
						key={sub.id}
						className="p-6 rounded-2xl bg-white/5 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-brand-blue/30 transition-all group"
					>
						<div className="flex items-center gap-4">
							<div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue font-black border border-brand-blue/20">
								{sub.id}
							</div>
							<div>
								<h4 className="font-bold flex items-center gap-2">
									Scholar: {sub.scholar}
									<span className="text-xs text-brand-cyan/50 font-normal underline cursor-pointer">
										View Proof
									</span>
								</h4>
								<p className="text-xs text-white/30 uppercase tracking-widest mt-1">
									Requested: {sub.amount} • Submitted: {sub.date}
								</p>
							</div>
						</div>
						<div className="flex gap-3">
							<button
								className="px-6 py-2.5 bg-brand-emerald/10 text-brand-emerald rounded-full font-bold text-xs hover:bg-brand-emerald border border-brand-emerald/30 hover:text-black transition-all uppercase tracking-widest"
								onClick={() => handleAction(sub.id, "approve")}
							>
								Approve
							</button>
							<button
								className="px-6 py-2.5 bg-brand-purple/10 text-brand-purple rounded-full font-bold text-xs hover:bg-brand-purple border border-brand-purple/30 hover:text-white transition-all uppercase tracking-widest"
								onClick={() => handleAction(sub.id, "reject")}
							>
								Reject
							</button>
						</div>
					</div>
				))}
			</div>
		</section>
	)
}

const UserLookup: React.FC = () => {
	const [search, setSearch] = useState("")
	const [userData, setUserData] = useState<{
		address: string
		balance: string
		enrollment: string
		tier: string
	} | null>(null)

	const handleSearch = () => {
		if (!search) return
		setUserData({
			address: search,
			balance: "250 LRN",
			enrollment: "Soroban 101",
			tier: "Elite Learner",
		})
	}

	return (
		<section className="glass-card p-10 rounded-[2.5rem]">
			<h3 className="text-3xl font-black mb-2 text-gradient">User Lookup</h3>
			<p className="text-white/40 text-sm mb-12">
				Track learner reputation and on-chain progress across modules.
			</p>
			<div className="flex gap-4 mb-12 max-w-2xl">
				<input
					type="text"
					placeholder="Enter wallet address (G...)"
					className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-brand-cyan/50 focus:bg-white/[0.08] transition-all text-sm font-mono"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
				<button
					className="px-8 py-4 bg-linear-to-r from-brand-cyan to-brand-blue rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.02] shadow-xl shadow-brand-cyan/10 transition-transform"
					onClick={handleSearch}
				>
					Lookup
				</button>
			</div>
			{userData && (
				<div className="p-10 rounded-3xl bg-linear-to-br from-white/5 to-transparent border border-white/10 relative overflow-hidden group">
					<div className="absolute top-0 right-0 p-10 opacity-10 group-hover:opacity-20 transition-opacity">
						<div className="text-8xl font-black">LRN</div>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
						<div>
							<label className="block text-[10px] uppercase font-black text-white/30 tracking-widest mb-2">
								Authenticated Scholar
							</label>
							<p className="text-xl font-bold font-mono tracking-tighter text-brand-cyan">
								{userData.address}
							</p>
						</div>
						<div className="grid grid-cols-2 gap-6">
							<div>
								<label className="block text-[10px] uppercase font-black text-white/30 tracking-widest mb-1">
									Reputation
								</label>
								<p className="text-2xl font-black text-brand-emerald">
									{userData.balance}
								</p>
							</div>
							<div>
								<label className="block text-[10px] uppercase font-black text-white/30 tracking-widest mb-1">
									Status
								</label>
								<p className="text-2xl font-black text-brand-purple">
									{userData.tier}
								</p>
							</div>
						</div>
					</div>
					<div className="mt-8 pt-8 border-t border-white/5">
						<label className="block text-[10px] uppercase font-black text-white/30 tracking-widest mb-3">
							Enrolled In
						</label>
						<span className="px-4 py-2 bg-white/5 rounded-full text-xs font-bold border border-white/10">
							{userData.enrollment}
						</span>
					</div>
				</div>
			)}
		</section>
	)
}

const TreasuryControls: React.FC = () => {
	const [isPaused, setIsPaused] = useState(false)

	return (
		<section className="glass-card p-10 rounded-[2.5rem]">
			<div className="flex justify-between items-center mb-12">
				<div>
					<h3 className="text-3xl font-black mb-2">Treasury Controls</h3>
					<p className="text-white/40 text-sm">
						Emergency override and balance monitoring for GAO funds.
					</p>
				</div>
				<button
					className={`px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-xl ${
						isPaused
							? "bg-brand-blue text-white shadow-brand-blue/30"
							: "bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500 shadow-orange-500/10 hover:text-black"
					}`}
					onClick={() => setIsPaused(!isPaused)}
				>
					{isPaused ? "▶ Resume DAO Treasury" : "⏸ Emergency Pause"}
				</button>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
				<div className="p-8 rounded-[2rem] bg-white/5 border border-white/5 flex flex-col items-center text-center relative overflow-hidden">
					<div className="absolute top-0 right-0 w-24 h-24 bg-brand-cyan/10 blur-[40px] rounded-full" />
					<label className="text-[10px] uppercase font-black text-white/30 tracking-widest mb-4">
						Total Liquidity
					</label>
					<p className="text-4xl font-black text-brand-cyan mb-6">
						12,500.00{" "}
						<span className="text-sm font-normal text-white/40 uppercase">
							USDC
						</span>
					</p>
					<button className="px-6 py-2 bg-white/5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors border border-white/5">
						Sync Ledger
					</button>
				</div>
				<div className="md:col-span-2 p-8 rounded-[2rem] bg-white/5 border border-white/5">
					<h4 className="text-sm font-bold mb-4 uppercase tracking-[2px]">
						Safety Protocol
					</h4>
					<ul className="flex flex-col gap-3">
						<li className="flex items-center gap-3 text-sm text-white/60">
							<span className="w-1.5 h-1.5 rounded-full bg-brand-emerald shadow-[0_0_8px_rgba(0,0,0,0.5)]" />
							Multi-sig protection active
						</li>
						<li className="flex items-center gap-3 text-sm text-white/60">
							<span className="w-1.5 h-1.5 rounded-full bg-brand-emerald" />
							Daily payout limit: 2,500 USDC
						</li>
						<li className="flex items-center gap-3 text-sm text-white/60">
							<span className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />
							Validator consensus: 3/5 confirmed
						</li>
					</ul>
				</div>
			</div>
		</section>
	)
}

const ContractInfo: React.FC = () => {
	const contracts = [
		{
			name: "ScholarshipTreasury",
			address: "C...TREAS",
			updated: "2024-03-20",
			tag: "FINANCIAL",
		},
		{
			name: "MilestoneEscrow",
			address: "C...ESCROW",
			updated: "2024-03-15",
			tag: "OPERATIONAL",
		},
		{
			name: "ScholarNFT",
			address: "C...NFT",
			updated: "2024-03-10",
			tag: "ASSET",
		},
		{
			name: "LearnToken",
			address: "C...LRN",
			updated: "2024-03-05",
			tag: "REPUTATION",
		},
	]

	return (
		<section className="glass-card p-10 rounded-[2.5rem]">
			<h3 className="text-3xl font-black mb-2">On-Chain Registry</h3>
			<p className="text-white/40 text-sm mb-12">
				Global registry of verified LearnVault smart contracts.
			</p>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
				{contracts.map((c) => (
					<div
						key={c.name}
						className="p-8 rounded-3xl bg-linear-to-br from-white/5 to-transparent border border-white/5 hover:border-brand-cyan/20 hover:scale-[1.02] transition-all group"
					>
						<div className="flex justify-between items-start mb-6">
							<h4 className="font-black text-lg group-hover:text-brand-cyan transition-colors">
								{c.name}
							</h4>
							<span className="px-3 py-1 bg-white/5 rounded-full text-[8px] font-black uppercase tracking-widest text-white/30 border border-white/5">
								{c.tag}
							</span>
						</div>
						<div className="mb-6">
							<label className="block text-[10px] uppercase font-black text-white/20 tracking-widest mb-2">
								Contract Identifier
							</label>
							<code className="text-brand-cyan/80 font-mono text-sm bg-brand-cyan/5 px-4 py-2 rounded-xl block truncate border border-brand-cyan/10">
								{c.address}
							</code>
						</div>
						<p className="text-[10px] text-white/30 uppercase tracking-[2px]">
							Last Audit/Update:{" "}
							<span className="text-white/60">{c.updated}</span>
						</p>
					</div>
				))}
			</div>
		</section>
	)
}

export default Admin
