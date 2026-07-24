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

const DIFFICULTY_LEVEL: Record<string, number> = {
	beginner: 1,
	intermediate: 2,
	advanced: 3,
}

type CompletedCourse = {
	slug: string
	title: string
	track: string
	difficulty: string
}

type ScoredComponent = { score: number; reason: string }

function bestReason(components: ScoredComponent[]): {
	total: number
	reason: string
} {
	let total = 0
	let best: ScoredComponent = { score: 0, reason: "Recommended for you" }
	for (const component of components) {
		total += component.score
		if (component.score > best.score) best = component
	}
	return { total, reason: best.reason }
}

export const getRecommendations = async (
	walletAddress: string,
	limit = 4,
): Promise<Recommendation[]> => {
	const profileResult = await pool
		.query(
			"SELECT reputation_rank FROM user_profiles WHERE stellar_address = $1 OR address = $1 LIMIT 1",
			[walletAddress],
		)
		.catch(() => ({ rows: [] }))

	const reputation = Number(profileResult.rows[0]?.reputation_rank || 0)

	const completedResult = await pool.query(
		`SELECT c.slug, c.title, c.track, c.difficulty
		 FROM scholar_nfts s
		 JOIN courses c ON s.course_id = c.slug
		 WHERE s.scholar_address = $1 AND s.revoked = FALSE`,
		[walletAddress],
	)

	const completedCourses: CompletedCourse[] = completedResult.rows
	const completedSlugs = new Set(completedCourses.map((c) => c.slug))
	const isColdStart = completedCourses.length === 0

	const earnedTracks = new Set(completedCourses.map((c) => c.track))

	const trackMaxDifficulty: Record<string, number> = {}
	for (const c of completedCourses) {
		const level = DIFFICULTY_LEVEL[c.difficulty] || 1
		if (!trackMaxDifficulty[c.track] || level > trackMaxDifficulty[c.track]) {
			trackMaxDifficulty[c.track] = level
		}
	}

	const enrolledResult = await pool.query(
		"SELECT course_id FROM enrollments WHERE learner_address = $1",
		[walletAddress],
	)
	const enrolledSlugs = new Set(
		enrolledResult.rows.map((r: any) => r.course_id),
	)

	const availableCoursesResult = await pool.query(
		`SELECT id, slug, title, description, cover_image_url as "coverImage", track, difficulty, prerequisites
		 FROM courses
		 WHERE published_at IS NOT NULL`,
	)
	const allCourses = availableCoursesResult.rows

	const titleBySlug = new Map<string, string>()
	for (const c of allCourses) titleBySlug.set(c.slug, c.title)
	for (const c of completedCourses) {
		if (!titleBySlug.has(c.slug)) titleBySlug.set(c.slug, c.title)
	}

	// Path rules: "learners who finish X should take Y next", curated per course.
	const pathRulesResult = await pool.query(
		"SELECT course_slug, requires_slug FROM course_prerequisites",
	)
	const pathRequiresBySlug = new Map<string, string[]>()
	for (const row of pathRulesResult.rows) {
		const list = pathRequiresBySlug.get(row.course_slug) || []
		list.push(row.requires_slug)
		pathRequiresBySlug.set(row.course_slug, list)
	}

	// Collaborative filtering: courses completed by learners who share at
	// least one completed course with this learner ("also completed").
	const coOccurrenceBySlug = new Map<string, number>()
	if (!isColdStart) {
		const completedSlugList = Array.from(completedSlugs)
		const coOccurrenceResult = await pool.query(
			`WITH peers AS (
				SELECT DISTINCT learner_address AS peer_address
				FROM enrollments
				WHERE course_id = ANY($1::text[]) AND learner_address != $2
			 )
			 SELECT sn.course_id AS slug, COUNT(DISTINCT sn.scholar_address)::int AS co_count
			 FROM scholar_nfts sn
			 JOIN peers p ON p.peer_address = sn.scholar_address
			 WHERE sn.revoked = FALSE AND sn.course_id != ALL($1::text[])
			 GROUP BY sn.course_id`,
			[completedSlugList, walletAddress],
		)
		for (const row of coOccurrenceResult.rows) {
			coOccurrenceBySlug.set(row.slug, Number(row.co_count))
		}
	}

	const scoredCourses: Recommendation[] = []

	for (const course of allCourses) {
		if (completedSlugs.has(course.slug) || enrolledSlugs.has(course.slug)) {
			continue
		}

		// Hard enrollment gate (existing per-course prerequisite id list).
		let meetsPrereqs = true
		if (course.prerequisites && course.prerequisites.length > 0) {
			const prereqsResult = await pool.query(
				"SELECT slug FROM courses WHERE id = ANY($1::integer[])",
				[course.prerequisites],
			)
			for (const req of prereqsResult.rows) {
				if (!completedSlugs.has(req.slug)) {
					meetsPrereqs = false
					break
				}
			}
		}
		if (!meetsPrereqs) continue

		// Soft path-rule gate: don't recommend a course whose curated path
		// prerequisites haven't been completed yet.
		const pathRequires = pathRequiresBySlug.get(course.slug) || []
		const unmetPathRequires = pathRequires.filter((s) => !completedSlugs.has(s))
		if (pathRequires.length > 0 && unmetPathRequires.length > 0) continue

		if (isColdStart && course.difficulty !== "beginner") continue

		const courseLevel = DIFFICULTY_LEVEL[course.difficulty] || 1
		const components: ScoredComponent[] = []

		if (pathRequires.length > 0) {
			const names = pathRequires
				.map((s) => titleBySlug.get(s) || s)
				.join(" and ")
			components.push({
				score: 60,
				reason: `Because you finished ${names}`,
			})
		}

		if (earnedTracks.has(course.track)) {
			const maxCompletedLevel = trackMaxDifficulty[course.track] || 1
			if (courseLevel === maxCompletedLevel + 1) {
				components.push({
					score: 50,
					reason: `Natural progression in ${course.track} track`,
				})
			} else if (courseLevel === maxCompletedLevel) {
				components.push({
					score: 30,
					reason: `Expand your skills in ${course.track}`,
				})
			} else {
				components.push({
					score: 10,
					reason: `Related to your completed courses in ${course.track}`,
				})
			}
		} else if (!isColdStart) {
			let expectedLevel = 1
			if (reputation > 500) expectedLevel = 3
			else if (reputation > 100) expectedLevel = 2

			if (courseLevel === expectedLevel) {
				components.push({ score: 40, reason: "Matches your reputation level" })
			} else if (courseLevel < expectedLevel) {
				components.push({
					score: 20,
					reason: "Good starting point for a new track",
				})
			} else {
				components.push({
					score: 5,
					reason: "Challenge yourself with a new track",
				})
			}
		}

		const coCount = coOccurrenceBySlug.get(course.slug) || 0
		if (coCount > 0) {
			components.push({
				score: Math.min(coCount * 10, 45),
				reason: `${coCount} learner${coCount === 1 ? "" : "s"} with a similar path also completed this`,
			})
		}

		if (isColdStart) {
			components.push({
				score: 25,
				reason: "A great starting point for new learners",
			})
		}

		const { total, reason } = bestReason(components)

		scoredCourses.push({
			courseId: course.id.toString(),
			slug: course.slug,
			title: course.title,
			description: course.description,
			track: course.track,
			difficulty: course.difficulty,
			coverImage: course.coverImage,
			score: total,
			reason,
		})
	}

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
			`INSERT INTO platform_events (event_type, data)
			 VALUES ($1, $2)`,
			[
				"RECOMMENDATION_ENGAGEMENT",
				JSON.stringify({
					walletAddress,
					courseSlug,
					action,
					timestamp: new Date().toISOString(),
				}),
			],
		)
	} catch (error) {
		console.error("Failed to log recommendation engagement:", error)
	}
}
