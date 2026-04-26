import React, { useContext, useEffect, useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import ActivityFeed from "../components/ActivityFeed"
import CourseCard from "../components/CourseCard"
import LRNBalanceWidget from "../components/LRNBalanceWidget"
import { DashboardStatsSkeleton } from "../components/SkeletonLoader"
import { useCourse } from "../hooks/useCourse"
import { useLearnerProfile } from "../hooks/useLearnerProfile"
import { useLearnToken } from "../hooks/useLearnToken"
import { WalletContext } from "../providers/WalletProvider"

import AddressDisplay from "../components/AddressDisplay"

const Dashboard: React.FC = () => {
	const { address } = useContext(WalletContext)
	const navigate = useNavigate()
	const [isInitializing, setIsInitializing] = React.useState(true)

	// Fetch learner profile from backend
	const { profile, isLoading: isLoadingProfile } = useLearnerProfile()

	// Fetch LRN balance from contract
	const { balance: lrnBalance, isLoading: isLoadingBalance } =
		useLearnToken(address)

	// Fetch enrolled courses and milestone progress from contract
	const { enrolledCourses, getCourseProgress, isCompletingMilestone } =
		useCourse()

	useEffect(() => {
		if (address) {
			setIsInitializing(false)
			return
		}

		const walletId = localStorage.getItem("walletId")
		if (!walletId) {
			void navigate("/")
		} else {
			const timer = setTimeout(() => {
				setIsInitializing(false)
				void navigate("/")
			}, 1000)
			return () => clearTimeout(timer)
		}
	}, [address, navigate])

	// Calculate milestone count from enrolled courses' progress
	const milestonesCompleted = useMemo(() => {
		return enrolledCourses.reduce((total, course) => {
			return total + getCourseProgress(course.id).completedMilestoneIds.length
		}, 0)
	}, [enrolledCourses, getCourseProgress])

	// Check if data is still loading
	const isLoading =
		isLoadingProfile || isLoadingBalance || isCompletingMilestone

	if (isInitializing && !address) {
		return (
			<div aria-busy="true" className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto">
				<DashboardStatsSkeleton />
			</div>
		)
	}

	if (!address) {
		return (
			<div className="min-h-screen flex items-center justify-center px-4">
				<div className="max-w-md text-center">
					<h1 className="text-3xl sm:text-4xl font-black text-gradient mb-4">
						Connect Your Wallet
					</h1>
					<p className="text-white/70 text-base sm:text-lg mb-8">
						To view your learning dashboard and on-chain reputation, please
						connect your Stellar wallet.
					</p>
					<Link
						to="/"
						className="inline-block w-full sm:w-auto text-center iridescent-border px-8 py-3 rounded-xl font-bold transition-all hover:scale-105 active:scale-95"
					>
						<span className="relative z-10">Connect Wallet &rarr;</span>
					</Link>
				</div>
			</div>
		)
	}

	const stats = [
		{
			label: "LRN Balance",
			value: isLoading
				? "—"
				: lrnBalance !== undefined
					? (Number(lrnBalance) / 1e7).toLocaleString("en-US", {
							maximumFractionDigits: 0,
						})
					: "0",
		},
		{
			label: "Courses Enrolled",
			value: isLoading ? "—" : enrolledCourses.length,
		},
		{ label: "Milestones", value: isLoading ? "—" : milestonesCompleted },
		{ label: "Gov Tokens", value: "0" },
	]

	return (
		<div className="min-h-screen py-16 sm:py-20 px-4 sm:px-6 md:px-8 relative overflow-x-hidden">
			{/* Background mesh */}
			<div
				className="absolute inset-0 animate-mesh opacity-30 -z-20 pointer-events-none"
				aria-hidden="true"
			/>

			{/* Ambient glow — capped with min() so it never exceeds the viewport width */}
			<div
				className="absolute top-1/4 left-1/4 w-[min(800px,160vw)] aspect-square bg-brand-cyan/20 blur-[150px] rounded-full -z-10 animate-pulse pointer-events-none"
				aria-hidden="true"
			/>

			<div className="max-w-6xl mx-auto space-y-10 sm:space-y-12 relative z-10 w-full pb-20 sm:pb-24">
				{/* ── Header ── */}
				<header className="space-y-1">
					<h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter text-gradient leading-tight flex flex-wrap items-center gap-x-3">
						Welcome back, <AddressDisplay address={profile?.address || address} showCopyButton={false} showExplorerLink={false} addressClassName="text-gradient" />
					</h1>
					<p className="text-white/50 text-sm sm:text-base md:text-lg font-medium">
						Your learning dashboard and on-chain reputation.
					</p>
				</header>

				{/* ── Reputation & Stats ── */}
				<section aria-label="Reputation and stats">
					<div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
						{/* Balance widget — given an explicit max-width so it never overflows on mobile */}
						<div className="w-full max-w-none sm:max-w-sm md:w-auto md:flex-shrink-0 md:max-w-xs">
							<LRNBalanceWidget address={address} size="lg" />
						</div>

						{/* Stat cards grid */}
						{isLoading ? (
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 flex-1 w-full">
								{[1, 2, 3, 4].map((i) => (
									<div
										key={i}
										className="glass-card p-4 sm:p-6 rounded-2xl border border-white/10 bg-white/5 animate-pulse min-h-20"
									/>
								))}
							</div>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 flex-1 w-full">
								{stats.map((stat) => (
									<StatCard
										key={stat.label}
										label={stat.label}
										value={stat.value}
									/>
								))}
							</div>
						)}
					</div>
				</section>

				{/* ── Courses + Activity Feed ── */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
					{/* Courses — takes up 2/3 on large screens */}
					<section className="lg:col-span-2 space-y-6" aria-label="My courses">
						<h2 className="text-xl sm:text-2xl md:text-3xl font-black flex items-center gap-3">
							<span className="text-2xl sm:text-3xl" aria-hidden="true">
								📚
							</span>
							My Courses
						</h2>

						{isLoading ? (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-start">
								{[1, 2].map((i) => (
									<div
										key={i}
										className="glass-card p-6 rounded-[2.5rem] border border-white/10 bg-white/5 animate-pulse min-h-80"
									/>
								))}
							</div>
						) : enrolledCourses.length > 0 ? (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-start">
								{enrolledCourses.map((course) => (
									<CourseCard
										key={course.id}
										id={course.id}
										title={course.title || "Untitled Course"}
										description="Active course"
										difficulty="beginner"
										estimatedHours={0}
										lrnReward={0}
										lessonCount={0}
										isEnrolled={true}
									/>
								))}
							</div>
						) : (
							<div className="glass-card p-8 sm:p-12 text-center rounded-2xl border border-white/10">
								<p className="text-white/50 mb-4 text-sm sm:text-base">
									You haven't enrolled in any courses yet.
								</p>
								<Link
									to="/courses"
									className="inline-block w-full sm:w-auto text-center iridescent-border px-6 sm:px-8 py-3 rounded-xl font-bold transition-all hover:scale-105 active:scale-95"
								>
									<span className="relative z-10">
										Enroll in your first course &rarr;
									</span>
								</Link>
							</div>
						)}
					</section>

					{/* Activity Feed — takes up 1/3 on large screens, full width below */}
					<section className="lg:col-span-1" aria-label="Activity feed">
						<ActivityFeed address={address} limit={5} />
					</section>
				</div>
			</div>
		</div>
	)
}

const StatCard = ({
	label,
	value,
}: {
	label: string
	value: string | number
}) => (
	<div className="glass-card p-4 sm:p-6 rounded-2xl border border-white/10 flex flex-col justify-center shadow-lg hover:border-white/20 transition-all duration-300 min-w-0 overflow-hidden">
		<h3 className="text-brand-cyan/70 text-[9px] sm:text-xs font-bold uppercase tracking-widest mb-1 sm:mb-2 font-mono leading-tight">
			{label}
		</h3>
		<p className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-none overflow-hidden text-ellipsis whitespace-nowrap">
			{value}
		</p>
	</div>
)

export default Dashboard
