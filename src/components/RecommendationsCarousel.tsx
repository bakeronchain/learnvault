import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useWallet } from "../hooks/useWallet"
import { createAuthHeaders } from "../lib/api"
import CourseCard from "./CourseCard"
import { EmptyState } from "./states/emptyState"

export interface Recommendation {
	courseId: string
	slug: string
	title: string
	description: string
	track: string
	difficulty: "beginner" | "intermediate" | "advanced"
	coverImage: string | null
	score: number
	reason: string
}

function authHeaders(): Headers {
	const headers = createAuthHeaders()
	headers.set("Content-Type", "application/json")
	return headers
}

const RecommendationsCarousel: React.FC = () => {
	const { address } = useWallet()
	const [recommendations, setRecommendations] = useState<Recommendation[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const navigate = useNavigate()

	useEffect(() => {
		if (!address) return

		let mounted = true
		const fetchRecommendations = async () => {
			setIsLoading(true)
			setError(null)
			try {
				const res = await fetch(
					`/api/recommendations/${encodeURIComponent(address)}?limit=4`,
					{ headers: authHeaders() },
				)
				if (!res.ok) throw new Error("Failed to fetch recommendations")
				const data = await res.json()
				if (mounted && data?.data) {
					setRecommendations(data.data)

					data.data.forEach((rec: Recommendation) => {
						void fetch(`/api/recommendations/engage`, {
							method: "POST",
							headers: authHeaders(),
							body: JSON.stringify({ courseSlug: rec.slug, action: "view" }),
						}).catch(console.error)
					})
				}
			} catch (err) {
				console.error("Failed to fetch recommendations:", err)
				if (mounted) setError("Unable to load recommendations right now.")
			} finally {
				if (mounted) setIsLoading(false)
			}
		}

		void fetchRecommendations()

		return () => {
			mounted = false
		}
	}, [address])

	const handleEnrollClick = async (slug: string) => {
		try {
			await fetch(`/api/recommendations/engage`, {
				method: "POST",
				headers: authHeaders(),
				body: JSON.stringify({ courseSlug: slug, action: "click" }),
			})
		} catch (err) {
			console.error("Failed to log click:", err)
		}

		void navigate(`/courses/${slug}`)
	}

	if (!address) return null

	if (isLoading) {
		return (
			<section className="space-y-6" aria-label="Recommended courses">
				<h2 className="text-xl sm:text-2xl md:text-3xl font-black flex items-center gap-3">
					<span className="text-2xl sm:text-3xl" aria-hidden="true">
						🎯
					</span>
					Recommended For You
				</h2>
				<div className="flex gap-4 overflow-x-auto pb-4 snap-x">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="glass-card flex-none w-80 rounded-[2.5rem] border border-white/10 bg-white/5 animate-pulse min-h-[400px] snap-center"
						/>
					))}
				</div>
			</section>
		)
	}

	if (error) {
		return (
			<section className="space-y-6" aria-label="Recommended courses">
				<h2 className="text-xl sm:text-2xl md:text-3xl font-black flex items-center gap-3">
					<span className="text-2xl sm:text-3xl" aria-hidden="true">
						🎯
					</span>
					Recommended For You
				</h2>
				<p className="text-sm text-white/50">{error}</p>
			</section>
		)
	}

	if (recommendations.length === 0) {
		return (
			<section className="space-y-6" aria-label="Recommended courses">
				<h2 className="text-xl sm:text-2xl md:text-3xl font-black flex items-center gap-3">
					<span className="text-2xl sm:text-3xl" aria-hidden="true">
						🎯
					</span>
					Recommended For You
				</h2>
				<EmptyState
					icon="🌱"
					title="Start with a beginner track"
					description="Once courses are published we'll suggest a beginner-friendly path to get you started."
					ctaLabel="Browse all courses"
					ctaTo="/courses"
				/>
			</section>
		)
	}

	return (
		<section className="space-y-6" aria-label="Recommended courses">
			<h2 className="text-xl sm:text-2xl md:text-3xl font-black flex items-center gap-3">
				<span className="text-2xl sm:text-3xl" aria-hidden="true">
					🎯
				</span>
				Recommended For You
			</h2>
			<div className="flex gap-6 overflow-x-auto pb-6 snap-x hide-scrollbar">
				{recommendations.map((course) => (
					<div
						key={course.courseId}
						className="flex-none w-80 sm:w-96 snap-center flex flex-col relative group"
					>
						<CourseCard
							id={course.slug}
							title={course.title}
							description={course.description}
							difficulty={course.difficulty}
							estimatedHours={0}
							lrnReward={0}
							lessonCount={0}
							coverImage={course.coverImage || undefined}
							isEnrolled={false}
							onEnroll={() => handleEnrollClick(course.slug)}
						/>
						{/* Recommendation Reason Badge */}
						<div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-cyan/20 backdrop-blur-md border border-brand-cyan/50 text-brand-cyan text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full whitespace-nowrap shadow-[0_0_15px_rgba(0,212,255,0.2)] z-20 transition-transform group-hover:-translate-y-1">
							{course.reason}
						</div>
					</div>
				))}
			</div>
		</section>
	)
}

export default RecommendationsCarousel
