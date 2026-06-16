import { Badge, Card, Button, Text } from "@stellar/design-system"
import React from "react"
import { Link } from "react-router-dom"
import { useLearnToken } from "../hooks/useLearnToken"
import { useWallet } from "../hooks/useWallet"

type DashboardStatCardProps = {
	label: string
	value: React.ReactNode
	subtitle?: string
}

function DashboardStatCard({ label, value, subtitle }: DashboardStatCardProps) {
	return (
		<Card>
			<div style={{ padding: 20 }}>
				<Text as="div" size="sm" style={{ opacity: 0.8, fontWeight: 600 }}>
					{label}
				</Text>
				<div style={{ marginTop: 8 }}>
					<Text as="div" size="xl" style={{ fontWeight: 800 }}>
						{value}
					</Text>
					{subtitle ? (
						<Text as="div" size="sm" style={{ opacity: 0.7, marginTop: 4 }}>
							{subtitle}
						</Text>
					) : null}
				</div>
			</div>
		</Card>
	)
}

const CoursesInProgress = () => {
	const placeholderCourses = [
		"Web3 Foundations",
		"Smart Contract Engineering",
		"DeFi Builder Sprint",
		"Milestone Verification 101",
	]

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{placeholderCourses.map((course) => (
				<div
					key={course}
					className="glass-card p-6 rounded-[2rem] border border-white/5"
				>
					<div className="flex items-center justify-between gap-4">
						<div className="text-white font-black">{course}</div>
						<Badge>In progress</Badge>
					</div>
					<div className="mt-4 h-2 w-full bg-white/5 rounded-full overflow-hidden">
						<div className="h-full w-[45%] bg-brand-cyan/60" />
					</div>
					<div className="mt-2 text-xs text-white/40">45% complete</div>
				</div>
			))}
		</div>
	)
}

export default function Dashboard() {
	const { address } = useWallet()
	const learnToken = useLearnToken(address)

	const walletAddress = address ? address : "Not connected"

	// Placeholder values for V1 — no live contract calls needed yet.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const _ = learnToken

	return (
		<div className="p-12 max-w-6xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
			<header className="mb-12 text-center">
				<h1 className="text-6xl font-black tracking-tighter text-gradient mb-4">
					Learner Dashboard
				</h1>
				<p className="text-white/40 text-lg font-medium">
					On-chain activity overview (V1 placeholder)
				</p>
			</header>

			{!walletAddress || walletAddress === "Not connected" ? (
				<div className="glass-card p-12 rounded-[3rem] border border-white/5 text-center">
					<Badge>Connect your wallet</Badge>
					<div className="mt-4">
						<Text as="p" size="md" style={{ opacity: 0.85 }}>
							Connect to see your wallet address and stats.
						</Text>
					</div>
				</div>
			) : (
				<>
					<section className="mb-12">
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
							<DashboardStatCard
								label="Wallet Address"
								value={<code>{walletAddress}</code>}
							/>
							<DashboardStatCard
								label="LearnToken Balance"
								value={"0 LRN"}
								subtitle="placeholder"
							/>
							<DashboardStatCard
								label="Scholarship Eligibility"
								value={<Badge variant="default">Not yet eligible</Badge>}
								subtitle="placeholder"
							/>
						</div>
					</section>

					<section className="mb-12">
						<div className="flex items-end justify-between gap-6 mb-6">
							<div>
								<h2 className="text-3xl font-black tracking-tight">
									Courses in progress
								</h2>
								<p className="text-white/40 mt-2">Placeholder cards for V1</p>
							</div>
						</div>
						<CoursesInProgress />
					</section>

					<section className="glass-card p-10 rounded-[3rem] border border-white/5">
						<div className="flex flex-col md:flex-row items-center justify-between gap-6">
							<div className="text-center md:text-left">
								<Text as="h3" size="xl" style={{ fontWeight: 900 }}>
									Start learning with confidence
								</Text>
								<Text as="p" size="md" style={{ opacity: 0.75, marginTop: 6 }}>
									Browse course tracks and start earning LearnToken.
								</Text>
							</div>

							<Link to="/courses" aria-label="Browse courses">
								<Button size="md" variant="primary">
									Browse Courses
								</Button>
							</Link>
						</div>
					</section>
				</>
			)}
		</div>
	)
}
