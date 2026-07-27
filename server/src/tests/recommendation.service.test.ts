/**
 * Unit tests for the learning-path recommender.
 * Uses a mocked pool so no database is required.
 */

jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn(),
		connect: jest.fn(),
	},
}))

import { pool } from "../db/index"
import { getRecommendations } from "../services/recommendation.service"

type CourseFixture = {
	id: number
	slug: string
	title: string
	description: string
	coverImage: string | null
	track: string
	difficulty: "beginner" | "intermediate" | "advanced"
	prerequisites: number[]
}

const STELLAR_BASICS: CourseFixture = {
	id: 1,
	slug: "stellar-basics",
	title: "Stellar Basics",
	description: "Intro to Stellar",
	coverImage: null,
	track: "Stellar",
	difficulty: "beginner",
	prerequisites: [],
}

const SOROBAN: CourseFixture = {
	id: 2,
	slug: "soroban-smart-contracts",
	title: "Soroban Smart Contracts",
	description: "Build on Soroban",
	coverImage: null,
	track: "Stellar",
	difficulty: "intermediate",
	prerequisites: [],
}

const DEFI: CourseFixture = {
	id: 3,
	slug: "defi-on-stellar",
	title: "DeFi on Stellar",
	description: "Advanced DeFi",
	coverImage: null,
	track: "Stellar",
	difficulty: "advanced",
	prerequisites: [],
}

const RUST_FUNDAMENTALS: CourseFixture = {
	id: 4,
	slug: "rust-fundamentals",
	title: "Rust Fundamentals",
	description: "Learn Rust",
	coverImage: null,
	track: "Rust",
	difficulty: "beginner",
	prerequisites: [],
}

const POPULAR_COURSE: CourseFixture = {
	id: 5,
	slug: "popular-course",
	title: "Popular Course",
	description: "Widely taken next",
	coverImage: null,
	track: "Other",
	difficulty: "intermediate",
	prerequisites: [],
}

const ALL_COURSES = [
	STELLAR_BASICS,
	SOROBAN,
	DEFI,
	RUST_FUNDAMENTALS,
	POPULAR_COURSE,
]

const PATH_RULES = [
	{ course_slug: "soroban-smart-contracts", requires_slug: "stellar-basics" },
	{ course_slug: "defi-on-stellar", requires_slug: "soroban-smart-contracts" },
]

function mockPool(overrides: {
	reputation?: Array<Record<string, unknown>>
	completed?: Array<Record<string, unknown>>
	enrolled?: Array<Record<string, unknown>>
	courses?: CourseFixture[]
	pathRules?: Array<Record<string, unknown>>
	coOccurrence?: Array<Record<string, unknown>>
}): void {
	;(pool.query as jest.Mock).mockImplementation(async (sql: string) => {
		if (sql.includes("user_profiles")) {
			return { rows: overrides.reputation ?? [] }
		}
		if (sql.includes("peers AS")) {
			return { rows: overrides.coOccurrence ?? [] }
		}
		if (sql.includes("scholar_nfts s")) {
			return { rows: overrides.completed ?? [] }
		}
		if (sql.includes("FROM enrollments WHERE learner_address")) {
			return { rows: overrides.enrolled ?? [] }
		}
		if (sql.includes("published_at IS NOT NULL")) {
			return { rows: overrides.courses ?? ALL_COURSES }
		}
		if (sql.includes("course_prerequisites")) {
			return { rows: overrides.pathRules ?? PATH_RULES }
		}
		if (sql.includes("id = ANY($1::integer[])")) {
			return { rows: [] }
		}
		throw new Error(`Unexpected query in test: ${sql}`)
	})
}

beforeEach(() => {
	jest.clearAllMocks()
})

describe("getRecommendations - prerequisite path gating", () => {
	it("excludes a course whose curated path prerequisite has not been completed", async () => {
		mockPool({
			completed: [
				{
					slug: "stellar-basics",
					title: "Stellar Basics",
					track: "Stellar",
					difficulty: "beginner",
				},
			],
		})

		const recommendations = await getRecommendations("GLEARNER1", 10)
		const slugs = recommendations.map((r) => r.slug)

		expect(slugs).not.toContain("defi-on-stellar")
	})

	it("includes a course once its curated path prerequisite is completed, with the reason naming it", async () => {
		mockPool({
			completed: [
				{
					slug: "stellar-basics",
					title: "Stellar Basics",
					track: "Stellar",
					difficulty: "beginner",
				},
			],
		})

		const recommendations = await getRecommendations("GLEARNER1", 10)
		const soroban = recommendations.find(
			(r) => r.slug === "soroban-smart-contracts",
		)

		expect(soroban).toBeDefined()
		expect(soroban?.reason).toBe("Because you finished Stellar Basics")
	})

	it("includes defi-on-stellar once both upstream courses are completed", async () => {
		mockPool({
			completed: [
				{
					slug: "stellar-basics",
					title: "Stellar Basics",
					track: "Stellar",
					difficulty: "beginner",
				},
				{
					slug: "soroban-smart-contracts",
					title: "Soroban Smart Contracts",
					track: "Stellar",
					difficulty: "intermediate",
				},
			],
		})

		const recommendations = await getRecommendations("GLEARNER1", 10)
		const defi = recommendations.find((r) => r.slug === "defi-on-stellar")

		expect(defi).toBeDefined()
		expect(defi?.reason).toBe("Because you finished Soroban Smart Contracts")
	})
})

describe("getRecommendations - co-occurrence collaborative filtering", () => {
	it("ranks a course higher and explains it when many similar learners also completed it", async () => {
		mockPool({
			completed: [
				{
					slug: "stellar-basics",
					title: "Stellar Basics",
					track: "Stellar",
					difficulty: "beginner",
				},
			],
			coOccurrence: [{ slug: "popular-course", co_count: 5 }],
		})

		const recommendations = await getRecommendations("GLEARNER1", 10)
		const popular = recommendations.find((r) => r.slug === "popular-course")

		expect(popular).toBeDefined()
		expect(popular?.reason).toBe(
			"5 learners with a similar path also completed this",
		)

		// The co-occurrence score (min(5*10, 45) = 45) should outrank the
		// generic "new track" progression score for the same learner.
		const rustFundamentals = recommendations.find(
			(r) => r.slug === "rust-fundamentals",
		)
		expect(popular!.score).toBeGreaterThan(rustFundamentals!.score)
	})

	it("does not run co-occurrence lookups for a brand-new learner", async () => {
		mockPool({ completed: [] })

		await getRecommendations("GNEWLEARNER", 10)

		const calls = (pool.query as jest.Mock).mock.calls
		const ranCoOccurrenceQuery = calls.some(([sql]: [string]) =>
			sql.includes("peers AS"),
		)
		expect(ranCoOccurrenceQuery).toBe(false)
	})
})

describe("getRecommendations - cold start", () => {
	it("recommends only beginner courses for a learner with no history", async () => {
		mockPool({ completed: [], enrolled: [] })

		const recommendations = await getRecommendations("GNEWLEARNER", 10)

		expect(recommendations.length).toBeGreaterThan(0)
		for (const rec of recommendations) {
			expect(rec.difficulty).toBe("beginner")
			expect(rec.reason).toBe("A great starting point for new learners")
		}
	})

	it("includes the expected beginner tracks for a new learner", async () => {
		mockPool({ completed: [], enrolled: [] })

		const recommendations = await getRecommendations("GNEWLEARNER", 10)
		const slugs = recommendations.map((r) => r.slug).sort()

		expect(slugs).toEqual(["rust-fundamentals", "stellar-basics"])
	})
})

describe("getRecommendations - general behavior", () => {
	it("excludes already-completed and already-enrolled courses", async () => {
		mockPool({
			completed: [
				{
					slug: "stellar-basics",
					title: "Stellar Basics",
					track: "Stellar",
					difficulty: "beginner",
				},
			],
			enrolled: [{ course_id: "rust-fundamentals" }],
		})

		const recommendations = await getRecommendations("GLEARNER1", 10)
		const slugs = recommendations.map((r) => r.slug)

		expect(slugs).not.toContain("stellar-basics")
		expect(slugs).not.toContain("rust-fundamentals")
	})

	it("respects the limit parameter", async () => {
		mockPool({ completed: [], enrolled: [] })

		const recommendations = await getRecommendations("GNEWLEARNER", 1)

		expect(recommendations).toHaveLength(1)
	})
})
