import { Icon } from "@stellar/design-system"
import React, { lazy, Suspense } from "react"
import { Helmet } from "react-helmet"
import { Link } from "react-router-dom"
import DeferredSection from "../components/DeferredSection"
import { useEnrolledCourses } from "../hooks/useCourses"

const MilestoneTracker = lazy(() =>
	import("../components/MilestoneTracker").then((module) => ({
		default: module.MilestoneTracker,
	})),
)

const HOW_IT_WORKS = [
	{
		step: "01",
		title: "Learn",
		description:
			"Complete courses and skill tracks. Every milestone you finish earns LRN tokens on-chain — proof of real effort, not speculation.",
		icon: "📚",
	},
	{
		step: "02",
		title: "Earn",
		description:
			"Build your on-chain reputation. Accumulate LRN tokens to unlock DAO voting rights and become a governance participant.",
		icon: "🏆",
	},
	{
		step: "03",
		title: "Get Funded",
		description:
			"Apply for community scholarships. Approved funds are released in USDC milestones — no gatekeepers, just proof of effort.",
		icon: "💰",
	},
]

const STATS = [
	{ label: "Core Contracts", value: "6" },
	{ label: "Skill Tracks", value: "3" },
	{ label: "Built on", value: "Stellar" },
]

const FEATURES = [
	{
		icon: "🎓",
		title: "ScholarNFTs",
		description:
			"Your hard-earned expertise, permanently immortalized as verifiable credentials on the Stellar network.",
	},
	{
		icon: "💸",
		title: "Automated Funding",
		description:
			"Decentralized treasury disbursements triggered instantly upon milestone completion via Soroban contracts.",
	},
	{
		icon: "🏛️",
		title: "Community DAO",
		description:
			"A protocol governed by the scholars who use it. Vote on curriculum, treasury, and reputation standards.",
	},
]

const Home: React.FC = () => {
	const { enrolledCourses, isLoading: isLoadingCourses } = useEnrolledCourses()

	const siteUrl = "https://learnvault.app"
	const title = "LearnVault — Learning is the proof of work"
	const description =
		"A decentralized learn-and-earn platform on Stellar. Complete courses, earn LRN tokens, and apply for community-funded scholarships."

	return (
		<>
			<Helmet>
				<title>{title}</title>
				<meta property="og:title" content={title} />
				<meta property="og:description" content={description} />
				<meta property="og:image" content={`${siteUrl}/og-image.png`} />
				<meta property="og:url" content={siteUrl} />
				<meta name="twitter:card" content="summary_large_image" />
			</Helmet>

			{/* ── Background glows ───────────────────────────────────────────── */}
			<div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
				<div className="absolute top-0 left-1/4 w-[700px] h-[700px] bg-brand-cyan/10 blur-[160px] rounded-full" />
				<div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-brand-purple/10 blur-[160px] rounded-full" />
			</div>

			<div className="w-full max-w-6xl mx-auto px-6 sm:px-8 flex flex-col gap-24 pb-32">
				{/* ── HERO ─────────────────────────────────────────────────────── */}
				<section className="text-center pt-12 pb-4 flex flex-col items-center gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
					{/* Logo mark */}
					<div className="w-20 h-20 bg-linear-to-br from-brand-cyan to-brand-blue rounded-3xl flex items-center justify-center font-black text-2xl shadow-2xl shadow-brand-cyan/30">
						LV
					</div>

					{/* Headline */}
					<div className="flex flex-col gap-3 max-w-3xl">
						<h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-gradient leading-[1.05]">
							Learning is the proof of work.
						</h1>
						<h2 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-white/70 leading-[1.05]">
							The community is the bank.
						</h2>
					</div>

					{/* Subtitle */}
					<p className="text-lg md:text-xl text-white/50 max-w-xl leading-relaxed">
						Earn on-chain credentials by completing courses. Get funded by a DAO
						that believes in your potential.
					</p>

					{/* CTA buttons */}
					<div className="flex flex-wrap justify-center gap-4">
						<Link
							to="/courses"
							className="iridescent-border px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-transform shadow-xl shadow-brand-cyan/10"
						>
							Start Learning
						</Link>
						<Link
							to="/treasury"
							className="px-10 py-4 glass border border-white/10 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/10 hover:scale-105 active:scale-95 transition-all"
						>
							Fund a Scholar
						</Link>
					</div>
				</section>

				{/* ── STATS BAR ────────────────────────────────────────────────── */}
				<div className="glass-card rounded-2xl border border-white/8 px-8 py-6 animate-in fade-in duration-700 delay-200">
					<div className="flex flex-wrap justify-around gap-6 text-center divide-x divide-white/10">
						{STATS.map(({ label, value }) => (
							<div key={label} className="flex-1 min-w-[100px] px-4">
								<p className="text-3xl font-black text-brand-cyan">{value}</p>
								<p className="text-xs text-white/40 uppercase tracking-widest mt-1">
									{label}
								</p>
							</div>
						))}
					</div>
				</div>

				{/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
				<section className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
					<div className="flex items-center gap-3">
						<Icon.Lightbulb01 size="lg" className="text-brand-cyan shrink-0" />
						<h2 className="text-2xl font-black">How It Works</h2>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
						{HOW_IT_WORKS.map(({ step, title, description, icon }) => (
							<div
								key={step}
								className="glass-card p-8 rounded-3xl border border-white/8 flex flex-col items-center text-center gap-4 hover:border-brand-cyan/20 transition-colors"
							>
								<span className="text-4xl">{icon}</span>
								<span className="text-xs font-black text-brand-cyan uppercase tracking-widest">
									Step {step}
								</span>
								<h3 className="text-xl font-black">{title}</h3>
								<p className="text-white/40 text-sm leading-relaxed">
									{description}
								</p>
							</div>
						))}
					</div>
				</section>

				{/* ── COURSE PROGRESS (enrolled users only) ────────────────────── */}
				{!isLoadingCourses && enrolledCourses.length > 0 && (
					<section className="iridescent-border rounded-3xl p-8 md:p-10 animate-in fade-in duration-700">
						<div className="flex items-center gap-3 mb-8">
							<Icon.Trophy01 size="lg" className="text-brand-cyan shrink-0" />
							<div>
								<h2 className="text-2xl font-black">Your Progress</h2>
								<p className="text-white/40 text-sm mt-0.5">
									Track your enrolled courses and milestone completions.
								</p>
							</div>
						</div>
						<div className="flex flex-col gap-8">
							{enrolledCourses.map((course) => (
								<div key={course.courseId}>
									<div className="flex items-center justify-between mb-2">
										<span className="font-semibold text-white/80">
											{course.title}
										</span>
										<span className="text-sm text-white/40">
											{course.completedCount}/{course.totalCount} milestones
										</span>
									</div>
									<div className="w-full h-2 bg-white/10 rounded-full mb-4">
										<div
											className="h-2 bg-brand-cyan rounded-full transition-all"
											style={{ width: `${course.progressPercent}%` }}
										/>
									</div>
									<DeferredSection
										fallback={<SectionSkeleton className="min-h-40" />}
									>
										<Suspense
											fallback={<SectionSkeleton className="min-h-40" />}
										>
											<MilestoneTracker
												courseId={course.courseId}
												milestones={course.milestones}
											/>
										</Suspense>
									</DeferredSection>
								</div>
							))}
						</div>
					</section>
				)}

				{/* ── FEATURES ─────────────────────────────────────────────────── */}
				<section className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-400">
					<div className="flex items-center gap-3">
						<Icon.Star01 size="lg" className="text-brand-cyan shrink-0" />
						<h2 className="text-2xl font-black">What You Get</h2>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
						{FEATURES.map(({ icon, title, description }) => (
							<div
								key={title}
								className="glass-card p-8 rounded-3xl border border-white/8 flex flex-col items-center text-center gap-4 hover:border-white/20 hover:-translate-y-1 transition-all group"
							>
								<span className="text-4xl group-hover:scale-110 transition-transform duration-300">
									{icon}
								</span>
								<h3 className="text-xl font-black">{title}</h3>
								<p className="text-white/40 text-sm leading-relaxed">
									{description}
								</p>
							</div>
						))}
					</div>
				</section>

				{/* ── CTA BANNER ───────────────────────────────────────────────── */}
				<section className="glass-card rounded-3xl border border-brand-cyan/15 p-10 text-center flex flex-col items-center gap-6 animate-in fade-in duration-700 delay-500">
					<h2 className="text-2xl font-black">Join the open-source sprint</h2>
					<p className="text-white/40 max-w-md text-sm leading-relaxed">
						LearnVault is built in the open. Pick an issue, ship a feature, and
						earn your place in the contributor list.
					</p>
					<a
						href="https://github.com/bakeronchain/learnvault/issues"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 px-8 py-4 glass border border-white/15 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/10 hover:scale-105 transition-all"
					>
						View Open Issues ↗
					</a>
				</section>
			</div>
		</>
	)
}

const SectionSkeleton = ({ className = "" }: { className?: string }) => (
	<div
		className={`glass-card animate-pulse rounded-3xl border border-white/5 bg-white/5 ${className}`.trim()}
	/>
)

export default Home
