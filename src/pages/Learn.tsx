/**
 * pages/Learn.tsx
 *
 * Issue #44 — Add skeleton loading screens and empty state components
 * bakeronchain/learnvault
 *
 * Added: CourseCardSkeleton and NoCoursesEmptyState
 */

import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
	CourseCardSkeleton,
	NoCoursesEmptyState,
} from "../components/SkeletonLoader"

const Learn: React.FC = () => {
	const { t } = useTranslation()
	const [isLoading, setIsLoading] = useState(true)
	const [hasCourses] = useState(false)

	// Issue #44 — Simulate async data fetch for skeleton demo
	useEffect(() => {
		const timer = setTimeout(() => setIsLoading(false), 2000)
		return () => clearTimeout(timer)
	}, [])

	return (
		<div className="p-12 max-w-5xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
			<header className="mb-16 text-center">
				<h1 className="text-6xl font-black mb-4 tracking-tighter text-gradient">
					{t("pages.learn.title")}
				</h1>
				<p className="text-white/40 text-lg font-medium">
					{t("pages.learn.desc")}
				</p>
			</header>

			{isLoading ? (
				// Issue #44 — Course card skeletons
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
					{[1, 2, 3].map((i) => (
						<CourseCardSkeleton key={i} />
					))}
				</div>
			) : !hasCourses ? (
				// Issue #44 — No courses empty state
				<NoCoursesEmptyState />
			) : (
				<div className="glass-card p-20 rounded-[4rem] text-center border border-white/5">
					<div className="text-6xl mb-8 animate-bounce">⚒️</div>
					<h2 className="text-3xl font-black mb-4">Curriculum Coming Soon</h2>
					<p className="text-white/40 max-w-md mx-auto mb-10 leading-relaxed font-medium">
						The LearnVault DAO is currently finalizing the "Soroban 101" and
						"DeFi Architecture" masterclasses. Stay tuned for the genesis drop.
					</p>
					<div className="flex justify-center gap-4">
						<span className="w-2 h-2 bg-brand-cyan rounded-full animate-pulse" />
						<span className="w-2 h-2 bg-brand-cyan rounded-full animate-pulse delay-150" />
						<span className="w-2 h-2 bg-brand-cyan rounded-full animate-pulse delay-300" />
					</div>
				</div>
			)}
		</div>
	)
}

export default Learn
