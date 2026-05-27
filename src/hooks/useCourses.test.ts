import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useCourses, useEnrolledCourses, useCourseDetail } from "./useCourses"
import type { ReactNode } from "react"

// Mock fetch
global.fetch = vi.fn()

const mockCourses = [
	{
		id: 1,
		slug: "stellar-basics",
		title: "Stellar Basics",
		description: "Learn the basics of Stellar",
		track: "stellar",
		difficulty: "beginner",
		published: true,
		createdAt: "2024-01-01",
		updatedAt: "2024-01-15",
	},
	{
		id: 2,
		slug: "defi-advanced",
		title: "DeFi Advanced",
		description: "Advanced DeFi concepts",
		track: "defi",
		difficulty: "advanced",
		published: true,
		createdAt: "2024-01-02",
		updatedAt: "2024-01-16",
	},
]

const mockEnrolledCourses = [
	{
		id: 1,
		slug: "stellar-basics",
		title: "Stellar Basics",
		completedMilestones: 2,
		totalMilestones: 5,
		milestones: [
			{ id: 1, label: "Milestone 1", lrnReward: 100 },
			{ id: 2, label: "Milestone 2", lrnReward: 150 },
		],
	},
]

const mockCourseDetail = {
	id: 1,
	slug: "stellar-basics",
	title: "Stellar Basics",
	description: "Learn the basics of Stellar",
	track: "stellar",
	difficulty: "beginner",
	published: true,
	createdAt: "2024-01-01",
	updatedAt: "2024-01-15",
	lessons: [
		{
			id: 1,
			courseId: "stellar-basics",
			title: "Introduction",
			content: "Welcome to Stellar",
			order: 1,
			estimatedMinutes: 15,
			isMilestone: false,
			version: 1,
			isLatest: true,
			changeSummary: null,
		},
		{
			id: 2,
			courseId: "stellar-basics",
			title: "Milestone 1",
			content: "Complete your first task",
			order: 2,
			estimatedMinutes: 30,
			isMilestone: true,
			version: 1,
			isLatest: true,
			changeSummary: null,
		},
	],
	enrollmentContentVersion: 1,
	latestContentVersion: 1,
	hasUpdatedContent: false,
}

describe("useCourses", () => {
	let queryClient: QueryClient

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
			},
		})
		vi.clearAllMocks()
	})

	afterEach(() => {
		queryClient.clear()
	})

	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>
			{children}
		</QueryClientProvider>
	)

	it("fetches and returns courses", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockCourses,
		})

		const { result } = renderHook(() => useCourses(), { wrapper })

		expect(result.current.isLoading).toBe(true)

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		expect(result.current.courses).toHaveLength(2)
		expect(result.current.courses[0].title).toBe("Stellar Basics")
		expect(result.current.courses[1].title).toBe("DeFi Advanced")
	})

	it("returns empty array when no courses are available", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => [],
		})

		const { result } = renderHook(() => useCourses(), { wrapper })

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		expect(result.current.courses).toEqual([])
	})

	it("handles fetch errors gracefully", async () => {
		;(global.fetch as any).mockRejectedValueOnce(new Error("Network error"))

		const { result } = renderHook(() => useCourses(), { wrapper })

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		expect(result.current.error).toBeTruthy()
		expect(result.current.courses).toEqual([])
	})

	it("normalizes course data correctly", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockCourses,
		})

		const { result } = renderHook(() => useCourses(), { wrapper })

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		const course = result.current.courses[0]
		expect(course.slug).toBe("stellar-basics")
		expect(course.track).toBe("Stellar")
		expect(course.level).toBe("Beginner")
		expect(course.difficulty).toBe("beginner")
	})

	it("maps track keys correctly", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockCourses,
		})

		const { result } = renderHook(() => useCourses(), { wrapper })

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		expect(result.current.courses[0].trackKey).toBe("stellar")
		expect(result.current.courses[1].trackKey).toBe("defi")
	})

	it("provides refetch function", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockCourses,
		})

		const { result } = renderHook(() => useCourses(), { wrapper })

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		expect(typeof result.current.refetch).toBe("function")
	})
})

describe("useEnrolledCourses", () => {
	let queryClient: QueryClient

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
			},
		})
		vi.clearAllMocks()
	})

	afterEach(() => {
		queryClient.clear()
	})

	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>
			{children}
		</QueryClientProvider>
	)

	it("fetches and returns enrolled courses", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockEnrolledCourses,
		})

		const { result } = renderHook(() => useEnrolledCourses(), { wrapper })

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		expect(result.current.enrolledCourses).toHaveLength(1)
		expect(result.current.enrolledCourses[0].title).toBe("Stellar Basics")
	})

	it("calculates progress percentage correctly", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockEnrolledCourses,
		})

		const { result } = renderHook(() => useEnrolledCourses(), { wrapper })

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		const course = result.current.enrolledCourses[0]
		expect(course.progressPercent).toBe(40) // 2/5 = 40%
		expect(course.completedCount).toBe(2)
		expect(course.totalCount).toBe(5)
	})

	it("normalizes milestone data", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockEnrolledCourses,
		})

		const { result } = renderHook(() => useEnrolledCourses(), { wrapper })

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		const course = result.current.enrolledCourses[0]
		expect(course.milestones).toHaveLength(2)
		expect(course.milestones[0].label).toBe("Milestone 1")
		expect(course.milestones[0].lrnReward).toBe(100)
	})

	it("handles empty enrolled courses", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => [],
		})

		const { result } = renderHook(() => useEnrolledCourses(), { wrapper })

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		expect(result.current.enrolledCourses).toEqual([])
	})
})

describe("useCourseDetail", () => {
	let queryClient: QueryClient

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
			},
		})
		vi.clearAllMocks()
	})

	afterEach(() => {
		queryClient.clear()
	})

	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>
			{children}
		</QueryClientProvider>
	)

	it("fetches course detail with lessons", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockCourseDetail,
		})

		const { result } = renderHook(
			() => useCourseDetail("stellar-basics"),
			{ wrapper },
		)

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		expect(result.current.course).toBeTruthy()
		expect(result.current.course?.title).toBe("Stellar Basics")
		expect(result.current.course?.lessons).toHaveLength(2)
	})

	it("sorts lessons by order", async () => {
		const unsortedCourse = {
			...mockCourseDetail,
			lessons: [
				mockCourseDetail.lessons[1],
				mockCourseDetail.lessons[0],
			],
		}

		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => unsortedCourse,
		})

		const { result } = renderHook(
			() => useCourseDetail("stellar-basics"),
			{ wrapper },
		)

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		expect(result.current.course?.lessons[0].title).toBe("Introduction")
		expect(result.current.course?.lessons[1].title).toBe("Milestone 1")
	})

	it("includes learner address in request when provided", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockCourseDetail,
		})

		renderHook(
			() => useCourseDetail("stellar-basics", "GLEARNER123"),
			{ wrapper },
		)

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining("learner_address=GLEARNER123"),
				expect.any(Object),
			)
		})
	})

	it("does not fetch when idOrSlug is undefined", () => {
		renderHook(() => useCourseDetail(undefined), { wrapper })

		expect(global.fetch).not.toHaveBeenCalled()
	})

	it("handles fetch errors", async () => {
		;(global.fetch as any).mockRejectedValueOnce(new Error("Not found"))

		const { result } = renderHook(
			() => useCourseDetail("invalid-course"),
			{ wrapper },
		)

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		expect(result.current.error).toBeTruthy()
		expect(result.current.course).toBeNull()
	})

	it("normalizes course detail data", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockCourseDetail,
		})

		const { result } = renderHook(
			() => useCourseDetail("stellar-basics"),
			{ wrapper },
		)

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		const course = result.current.course
		expect(course?.track).toBe("Stellar")
		expect(course?.level).toBe("Beginner")
		expect(course?.difficulty).toBe("beginner")
	})

	it("includes enrollment version information", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockCourseDetail,
		})

		const { result } = renderHook(
			() => useCourseDetail("stellar-basics"),
			{ wrapper },
		)

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		const course = result.current.course
		expect(course?.enrollmentContentVersion).toBe(1)
		expect(course?.latestContentVersion).toBe(1)
		expect(course?.hasUpdatedContent).toBe(false)
	})

	it("identifies milestone lessons", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockCourseDetail,
		})

		const { result } = renderHook(
			() => useCourseDetail("stellar-basics"),
			{ wrapper },
		)

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		const lessons = result.current.course?.lessons
		expect(lessons?.[0].isMilestone).toBe(false)
		expect(lessons?.[1].isMilestone).toBe(true)
	})
})
