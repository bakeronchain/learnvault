import React, { useContext, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import ActivityFeed from "../components/ActivityFeed"
import CourseCard from "../components/CourseCard"
import LRNBalanceWidget from "../components/LRNBalanceWidget"
import { WalletContext } from "../providers/WalletProvider"

const shortenAddress = (addr: string) => {
	if (!addr) return ""
	return `${addr.slice(0, 5)}...${addr.slice(-4)}`
}

const Dashboard: React.FC = () => {
    const { address } = useContext(WalletContext)
    const navigate = useNavigate()
    const [isInitializing, setIsInitializing] = React.useState(true)

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

    if (isInitializing && !address) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-pulse text-white/50 tracking-widest uppercase font-black text-sm">
                    Verifying Wallet...
                </div>
            </div>
        )
    }

    if (!address) return null

    const stats = [
        { label: "LRN Balance", value: 142 },
        { label: "Courses Enrolled", value: 2 },
        { label: "Milestones", value: 14 },
        { label: "Gov Tokens", value: 0 },
    ]

    const enrolledCourses = [
        {
            id: "1",
            title: "Soroban Smart Contracts",
            description: "Learn how to build scalable decentralized apps on Stellar using Rust and Soroban.",
            difficulty: "intermediate" as const,
            estimatedHours: 5,
            lrnReward: 200,
            lessonCount: 12,
        },
        {
            id: "2",
            title: "DeFi Fundamentals",
            description: "Understand the core concepts of Decentralized Finance and automated market makers.",
            difficulty: "beginner" as const,
            estimatedHours: 3,
            lrnReward: 100,
            lessonCount: 8,
        },
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
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter text-gradient leading-tight break-all sm:break-words">
                        Welcome back, {shortenAddress(address)}
                    </h1>
                    <p className="text-white/50 text-sm sm:text-base md:text-lg font-medium">
                        Your learning dashboard and on-chain reputation.
                    </p>
                </header>

                {/* ── Reputation & Stats ── */}
                <section aria-label="Reputation and stats">
                    <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">

                        {/* Balance widget — given an explicit max-width so it never overflows on mobile */}
                        <div className="w-full md:w-auto md:flex-shrink-0 max-w-xs">
                            <LRNBalanceWidget address={address} size="lg" />
                        </div>

                        {/* Stat cards grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 flex-1 w-full">
                            {stats.map((stat) => (
                                <StatCard key={stat.label} label={stat.label} value={stat.value} />
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Courses + Activity Feed ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">

                    {/* Courses — takes up 2/3 on large screens */}
                    <section className="lg:col-span-2 space-y-6" aria-label="My courses">
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-black flex items-center gap-3">
                            <span className="text-2xl sm:text-3xl" aria-hidden="true">📚</span>
                            My Courses
                        </h2>

                        {enrolledCourses.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-start">
                                {enrolledCourses.map((course) => (
                                    <CourseCard
                                        key={course.id}
                                        id={course.id}
                                        title={course.title}
                                        description={course.description}
                                        difficulty={course.difficulty}
                                        estimatedHours={course.estimatedHours}
                                        lrnReward={course.lrnReward}
                                        lessonCount={course.lessonCount}
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
                                    className="inline-block iridescent-border px-6 sm:px-8 py-3 rounded-xl font-bold transition-all hover:scale-105 active:scale-95"
                                >
                                    <span className="relative z-10">Enroll in your first course &rarr;</span>
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
