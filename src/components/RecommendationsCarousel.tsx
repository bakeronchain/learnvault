import React, { useEffect, useState, useContext } from "react"
import { useNavigate } from "react-router-dom"
import CourseCard from "./CourseCard"
import { WalletContext } from "../providers/WalletProvider"

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

const RecommendationsCarousel: React.FC = () => {
	const { address } = useContext(WalletContext)
	const [recommendations, setRecommendations] = useState<Recommendation[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const navigate = useNavigate()

	useEffect(() => {
		if (!address) return

		let mounted = true
		const fetchRecommendations = async () => {
			setIsLoading(true)
			try {
				const res = await fetch(\`/api/recommendations?limit=4\`, {
					headers: { "Content-Type": "application/json" }
				})
				if (!res.ok) throw new Error("Failed to fetch recommendations")
				const data = await res.json()
				if (mounted && data?.data) {
					setRecommendations(data.data)
					
					// Log view events
					data.data.forEach((rec: Recommendation) => {
						void fetch(\`/api/recommendations/engage\`, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ courseSlug: rec.slug, action: "view" }),
						}).catch(console.error)
					})
				}
			} catch (error) {
				console.error("Failed to fetch recommendations:", error)
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
		// Log click event
		try {
			await fetch(\`/api/recommendations/engage\`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ courseSlug: slug, action: "click" }),
			})
		} catch (error) {
			console.error("Failed to log click:", error)
		}
		
		// Navigate to course page for enrollment
		navigate(\`/courses/\${slug}\`)
	}

	if (isLoading) {
		return (
			<section className="space-y-6" aria-label="Recommended courses">
				<h2 className="text-xl sm:text-2xl md:text-3xl font-black flex items-center gap-3">
					<span className="text-2xl sm:text-3xl" aria-hidden="true">🎯</span>
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

	if (recommendations.length === 0) return null

	return (
		<section className="space-y-6" aria-label="Recommended courses">
			<h2 className="text-xl sm:text-2xl md:text-3xl font-black flex items-center gap-3">
				<span className="text-2xl sm:text-3xl" aria-hidden="true">🎯</span>
				Recommended For You
			</h2>
			<div className="flex gap-6 overflow-x-auto pb-6 snap-x hide-scrollbar">
				{recommendations.map((course) => (
					<div key={course.courseId} className="flex-none w-80 sm:w-96 snap-center flex flex-col relative group">
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
