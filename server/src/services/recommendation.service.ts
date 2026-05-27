import { pool } from "../db/index"

export type Recommendation = {
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

export const getRecommendations = async (
	walletAddress: string,
	limit = 4,
): Promise<Recommendation[]> => {
	// 1. Fetch user profile (for reputation)
	const profileResult = await pool.query(
		"SELECT reputation_rank FROM user_profiles WHERE stellar_address = $1 OR address = $1 LIMIT 1",
		[walletAddress]
	).catch(() => ({ rows: [] }))
	
	const reputation = Number(profileResult.rows[0]?.reputation_rank || 0)

	// 2. Fetch completed courses (earned skills)
	const completedResult = await pool.query(
		`SELECT c.slug, c.track, c.difficulty 
		 FROM scholar_nfts s
		 JOIN courses c ON s.course_id = c.slug
		 WHERE s.scholar_address = $1 AND s.revoked = FALSE`,
		[walletAddress]
	)
	
	const completedCourses = completedResult.rows
	const completedSlugs = new Set(completedCourses.map((c: any) => c.slug))
	
	// Determine earned skills (tracks user has completed at least one course in)
	const earnedTracks = new Set(completedCourses.map((c: any) => c.track))
	
	// Determine highest difficulty completed per track
	const trackMaxDifficulty: Record<string, number> = {}
	const difficultyLevel: Record<string, number> = {
		beginner: 1,
		intermediate: 2,
		advanced: 3,
	}
	
	for (const c of completedCourses) {
		const level = difficultyLevel[c.difficulty] || 1
		if (!trackMaxDifficulty[c.track] || level > trackMaxDifficulty[c.track]) {
			trackMaxDifficulty[c.track] = level
		}
	}

	// 3. Fetch active enrollments to exclude them
	const enrolledResult = await pool.query(
		"SELECT course_id FROM enrollments WHERE learner_address = $1",
		[walletAddress]
	)
	const enrolledSlugs = new Set(enrolledResult.rows.map((r: any) => r.course_id))

	// 4. Fetch all available courses
	const availableCoursesResult = await pool.query(
		`SELECT id, slug, title, description, cover_image_url as "coverImage", track, difficulty, prerequisites 
		 FROM courses 
		 WHERE published_at IS NOT NULL`
	)
	
	const allCourses = availableCoursesResult.rows

	// 5. Score courses
	const scoredCourses: Recommendation[] = []

	for (const course of allCourses) {
		// Skip if already completed or enrolled
		if (completedSlugs.has(course.slug) || enrolledSlugs.has(course.slug)) {
			continue
		}

		// Check prerequisites
		let meetsPrereqs = true
		if (course.prerequisites && course.prerequisites.length > 0) {
			const prereqsResult = await pool.query(
				"SELECT slug FROM courses WHERE id = ANY($1::integer[])",
				[course.prerequisites]
			)
			for (const req of prereqsResult.rows) {
				if (!completedSlugs.has(req.slug)) {
					meetsPrereqs = false
					break
				}
			}
		}
		
		if (!meetsPrereqs) continue

		let score = 0
		let reason = ""
		
		const courseLevel = difficultyLevel[course.difficulty] || 1

		// Rule 1: Earned Skills & Difficulty Progression
		if (earnedTracks.has(course.track)) {
			const maxCompletedLevel = trackMaxDifficulty[course.track] || 1
			if (courseLevel === maxCompletedLevel + 1) {
				score += 50
				reason = `Natural progression in ${course.track} track`
			} else if (courseLevel === maxCompletedLevel) {
				score += 30
				reason = `Expand your skills in ${course.track}`
			} else {
				score += 10
				reason = `Related to your completed courses in ${course.track}`
			}
		} else {
			// Rule 2: New tracks based on reputation
			let expectedLevel = 1
			if (reputation > 500) expectedLevel = 3
			else if (reputation > 100) expectedLevel = 2

			if (courseLevel === expectedLevel) {
				score += 40
				reason = `Matches your reputation level`
			} else if (courseLevel < expectedLevel) {
				score += 20
				reason = `Good starting point for a new track`
			} else {
				score += 5
				reason = `Challenge yourself with a new track`
			}
		}

		scoredCourses.push({
			courseId: course.id.toString(),
			slug: course.slug,
			title: course.title,
			description: course.description,
			track: course.track,
			difficulty: course.difficulty,
			coverImage: course.coverImage,
			score,
			reason,
		})
	}

	// 6. Sort by score descending and return top N
	scoredCourses.sort((a, b) => b.score - a.score)
	
	return scoredCourses.slice(0, limit)
}

export const logRecommendationEngagement = async (
	walletAddress: string,
	courseSlug: string,
	action: "view" | "click" | "dismiss",
): Promise<void> => {
	try {
		await pool.query(
			\`INSERT INTO platform_events (event_type, data) 
			 VALUES ($1, $2)\`,
			[
				"RECOMMENDATION_ENGAGEMENT",
				JSON.stringify({ walletAddress, courseSlug, action, timestamp: new Date().toISOString() })
			]
		)
	} catch (error) {
		console.error("Failed to log recommendation engagement:", error)
	}
}
