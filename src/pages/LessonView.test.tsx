/**
 * LessonView page tests
 *
 * Covers:
 * - Lesson content renders correctly
 * - Navigation to next/previous lesson works
 * - Sidebar shows correct lesson list
 * - Current lesson is highlighted in sidebar
 * - Progress is marked complete after finishing lesson
 * - Final lesson shows completion CTA
 * - Milestone submission form renders on milestone lessons
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { screen, waitFor, fireEvent, act } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { NotificationContext } from "../providers/NotificationProvider"
import {
	WalletContext,
	type WalletContextType,
} from "../providers/WalletProvider"
import { render } from "../test/setup"
import { type CourseDetail } from "../types/courses"

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

// Mock react-markdown to avoid ESM issues in jsdom
vi.mock("react-markdown", () => ({
	default: ({ children }: { children: string }) =>
		createElement("div", { "data-testid": "markdown-content" }, children),
}))

// Mock sonner (used by ToastProvider)
vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
	},
	Toaster: () => null,
}))

// Mock connectWallet utility
vi.mock("../util/wallet", () => ({
	connectWallet: vi.fn(),
	disconnectWallet: vi.fn(),
	fetchBalances: vi.fn().mockResolvedValue({}),
	wallet: {
		openModal: vi.fn(),
		setWallet: vi.fn(),
		getAddress: vi.fn().mockResolvedValue({ address: undefined }),
		getNetwork: vi
			.fn()
			.mockResolvedValue({ network: "TESTNET", networkPassphrase: "" }),
		signTransaction: vi.fn().mockResolvedValue("signed-xdr"),
		disconnect: vi.fn(),
	},
}))

// ---------------------------------------------------------------------------
// Hook mocks — defined at module scope so tests can override per-test
// ---------------------------------------------------------------------------

const mockGetCourseProgress = vi.fn()
const mockCompleteMilestone = vi.fn()
const mockSubmitMilestone = vi.fn()

vi.mock("../hooks/useCourse", () => ({
	useCourse: () => ({
		enrolledCourses: [],
		getCourseProgress: mockGetCourseProgress,
		enroll: vi.fn(),
		completeMilestone: mockCompleteMilestone,
		submitMilestone: mockSubmitMilestone,
		submissionStatusMap: {},
		isCompletingMilestone: false,
	}),
}))

const mockUseCourseDetail = vi.fn()
const mockEnroll = vi.fn()
const mockRetryPersistence = vi.fn()
const mockUseEnrollment = vi.fn()

vi.mock("../hooks/useEnrollment", () => ({
	useEnrollment: (slug: string) => mockUseEnrollment(slug),
}))

vi.mock("../hooks/useCourses", () => ({
	useCourseDetail: (id: string) => mockUseCourseDetail(id),
	useCourses: () => ({
		courses: [],
		isLoading: false,
		error: null,
		refetch: vi.fn(),
	}),
	useEnrolledCourses: () => ({
		enrolledCourses: [],
		isLoading: false,
		error: null,
		refetch: vi.fn(),
	}),
}))

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

const makeCourse = (overrides: Partial<CourseDetail> = {}): CourseDetail => ({
	id: "intro-stellar",
	slug: "intro-stellar",
	title: "Intro to Stellar",
	description: "Learn Stellar basics",
	coverImage: null,
	track: "Stellar",
	trackKey: "stellar",
	difficulty: "beginner",
	level: "Beginner",
	published: true,
	createdAt: "2024-01-01",
	updatedAt: "2024-01-01",
	accentClassName: "from-brand-cyan/25 via-brand-blue/20 to-transparent",
	lessons: [
		{
			id: 1,
			courseId: "intro-stellar",
			title: "Getting Started",
			content: "# Getting Started\n\nWelcome to Stellar!",
			order: 0,
			isMilestone: false,
			estimatedMinutes: 5,
		},
		{
			id: 2,
			courseId: "intro-stellar",
			title: "Accounts & Keys",
			content: "# Accounts & Keys\n\nLearn about Stellar accounts.",
			order: 1,
			isMilestone: false,
			estimatedMinutes: 10,
		},
		{
			id: 3,
			courseId: "intro-stellar",
			title: "Build Your First App",
			content: "# Build Your First App\n\nTime to build!",
			order: 2,
			isMilestone: true,
			estimatedMinutes: 30,
		},
	],
	...overrides,
})

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

const MOCK_ADDRESS = "GTEST1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO"

const makeWalletContext = (
	overrides: Partial<WalletContextType> = {},
): WalletContextType => ({
	address: MOCK_ADDRESS,
	balances: {},
	isPending: false,
	isReconnecting: false,
	network: "TESTNET",
	networkPassphrase: "Test SDF Network ; September 2015",
	signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: "signed-xdr" }),
	updateBalances: vi.fn().mockResolvedValue(undefined),
	...overrides,
})

const makeNotificationContext = () => ({
	addNotification: vi.fn(),
})

interface RenderOptions {
	courseId?: string
	lessonId?: string | number
	walletContext?: Partial<WalletContextType>
}

/**
 * Renders LessonView inside a MemoryRouter with the correct route params,
 * wrapped in all required providers.
 */
async function renderLessonView({
	courseId = "intro-stellar",
	lessonId = 1,
	walletContext = {},
}: RenderOptions = {}) {
	// Lazy-import the page so module-level mocks are already registered
	const { default: LessonView } = await import("./LessonView")

	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 } },
	})

	const wallet = makeWalletContext(walletContext)
	const notification = makeNotificationContext()

	const Wrapper = ({ children }: { children: ReactNode }) =>
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(
				WalletContext,
				{ value: wallet },
				createElement(NotificationContext, { value: notification }, children),
			),
		)

	const result = render(
		createElement(
			MemoryRouter,
			{ initialEntries: [`/courses/${courseId}/lessons/${lessonId}`] },
			createElement(
				Routes,
				null,
				createElement(Route, {
					path: "/courses/:courseId/lessons/:lessonId",
					element: createElement(LessonView),
				}),
			),
		),
		{ wrapper: Wrapper },
	)

	return result
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks()

	mockUseEnrollment.mockReturnValue({
		isEnrolled: true,
		isChecking: false,
		isEnrolling: false,
		needsPersistence: false,
		error: null,
		firstLessonPath: "/courses/intro-stellar/lessons/1",
		enroll: mockEnroll,
		retryPersistence: mockRetryPersistence,
	})

	// Default: course loads successfully, lesson 1 is current, nothing completed
	mockUseCourseDetail.mockReturnValue({
		course: makeCourse(),
		isLoading: false,
		error: null,
		refetch: vi.fn(),
	})

	mockGetCourseProgress.mockReturnValue({
		courseId: "intro-stellar",
		completedMilestoneIds: [],
	})

	mockCompleteMilestone.mockResolvedValue(undefined)
	mockSubmitMilestone.mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LessonView", () => {
	// -------------------------------------------------------------------------
	// 1. Lesson content renders correctly
	// -------------------------------------------------------------------------
	describe("lesson content rendering", () => {
		it("renders the lesson title in the page header", async () => {
			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				expect(
					screen.getByRole("heading", { name: /Getting Started/i }),
				).toBeInTheDocument()
			})
		})

		it("renders the course track badge and course title", async () => {
			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				expect(screen.getByText("Stellar")).toBeInTheDocument()
				expect(screen.getByText("Intro to Stellar")).toBeInTheDocument()
			})
		})

		it("renders the lesson markdown content", async () => {
			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				// react-markdown mock renders content inside data-testid="markdown-content"
				const content = screen.getByTestId("markdown-content")
				expect(content).toBeInTheDocument()
				expect(content.textContent).toContain("Getting Started")
			})
		})

		it("shows a loading skeleton while content is loading", async () => {
			mockUseCourseDetail.mockReturnValue({
				course: null,
				isLoading: true,
				error: null,
				refetch: vi.fn(),
			})

			await renderLessonView({ lessonId: 1 })

			// When course is loading and no address guard fires, the skeleton layout renders
			// The LessonListSkeleton is rendered in the sidebar area
			await waitFor(() => {
				// The skeleton aside has a min-h class — check it's present
				const skeletons = document.querySelectorAll(".animate-pulse")
				expect(skeletons.length).toBeGreaterThan(0)
			})
		})

		it("renders NotFound when the course does not exist", async () => {
			mockUseCourseDetail.mockReturnValue({
				course: null,
				isLoading: false,
				error: "Not found",
				refetch: vi.fn(),
			})

			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				// NotFound page renders a 404 message
				expect(
					screen.getByText(/404|not found|page.*not.*found/i),
				).toBeInTheDocument()
			})
		})

		it("shows wallet-required screen when no wallet is connected", async () => {
			await renderLessonView({
				lessonId: 1,
				walletContext: { address: undefined },
			})

			await waitFor(() => {
				expect(screen.getByText(/Wallet Required/i)).toBeInTheDocument()
				expect(screen.getByText(/Connect Wallet/i)).toBeInTheDocument()
			})
		})

		it("shows locked lesson screen when previous lesson is not completed", async () => {
			// Lesson 2 requires lesson 1 to be completed first
			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [], // lesson 1 not done
			})

			await renderLessonView({ lessonId: 2 })

			await waitFor(() => {
				expect(screen.getByText(/Lesson Locked/i)).toBeInTheDocument()
				expect(
					screen.getByText(/complete the previous lesson/i),
				).toBeInTheDocument()
			})
		})
	})

	// -------------------------------------------------------------------------
	// 2. Enrollment gate — protected content requires persisted enrollment
	// -------------------------------------------------------------------------
	describe("enrollment gate", () => {
		it("shows an accessible checking state without protected content while enrollment loads", async () => {
			mockUseEnrollment.mockReturnValue({
				isEnrolled: false,
				isChecking: true,
				isEnrolling: false,
				needsPersistence: false,
				error: null,
				firstLessonPath: null,
				enroll: mockEnroll,
				retryPersistence: mockRetryPersistence,
			})

			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				expect(
					screen.getByRole("status", { name: /checking enrollment/i }),
				).toHaveAttribute("aria-busy", "true")
			})

			expect(screen.queryByTestId("markdown-content")).not.toBeInTheDocument()
			expect(screen.queryByText(/Track Outline/i)).not.toBeInTheDocument()
			expect(
				screen.queryByRole("button", { name: /Forum/i }),
			).not.toBeInTheDocument()
		})

		it("blocks lesson content and shows an enroll action when not enrolled", async () => {
			mockUseEnrollment.mockReturnValue({
				isEnrolled: false,
				isChecking: false,
				isEnrolling: false,
				needsPersistence: false,
				error: null,
				firstLessonPath: null,
				enroll: mockEnroll,
				retryPersistence: mockRetryPersistence,
			})

			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				expect(
					screen.getByRole("heading", { name: /Enrollment Required/i }),
				).toBeInTheDocument()
				expect(
					screen.getByRole("button", { name: /Enroll Now/i }),
				).toBeInTheDocument()
			})

			expect(screen.queryByTestId("markdown-content")).not.toBeInTheDocument()
			expect(screen.queryByText(/Track Outline/i)).not.toBeInTheDocument()
			expect(
				screen.queryByRole("button", { name: /^Forum$/i }),
			).not.toBeInTheDocument()
		})

		it("surfaces enrollment errors with role=alert on the gate screen", async () => {
			mockUseEnrollment.mockReturnValue({
				isEnrolled: false,
				isChecking: false,
				isEnrolling: false,
				needsPersistence: false,
				error: "Enrollment cancelled",
				firstLessonPath: null,
				enroll: mockEnroll,
				retryPersistence: mockRetryPersistence,
			})

			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				expect(screen.getByRole("alert")).toHaveTextContent(
					/Enrollment cancelled/i,
				)
			})
		})

		it("does not render milestone submission UI when not enrolled", async () => {
			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [1, 2],
			})
			mockUseEnrollment.mockReturnValue({
				isEnrolled: false,
				isChecking: false,
				isEnrolling: false,
				needsPersistence: false,
				error: null,
				firstLessonPath: null,
				enroll: mockEnroll,
				retryPersistence: mockRetryPersistence,
			})

			await renderLessonView({ lessonId: 3 })

			await waitFor(() => {
				expect(
					screen.getByRole("heading", { name: /Enrollment Required/i }),
				).toBeInTheDocument()
			})

			expect(
				screen.queryByText(/Submit Milestone Evidence/i),
			).not.toBeInTheDocument()
		})
	})

	// -------------------------------------------------------------------------
	// 3. Navigation to next/previous lesson
	// -------------------------------------------------------------------------
	describe("lesson navigation", () => {
		it("renders a Next Lesson link pointing to the next lesson", async () => {
			// Lesson 1 is completed so next is unlocked
			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [1],
			})

			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				const nextLink = screen.getByRole("link", { name: /Next Lesson/i })
				expect(nextLink).toBeInTheDocument()
				expect(nextLink).toHaveAttribute("href", expect.stringContaining("2"))
			})
		})

		it("renders a Previous link pointing to the previous lesson", async () => {
			// Lesson 1 completed so lesson 2 is accessible
			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [1],
			})

			await renderLessonView({ lessonId: 2 })

			await waitFor(() => {
				const prevLink = screen.getByRole("link", { name: /Previous/i })
				expect(prevLink).toBeInTheDocument()
				expect(prevLink).toHaveAttribute("href", expect.stringContaining("1"))
			})
		})

		it("disables the Previous button on the first lesson", async () => {
			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				// First lesson: Previous is rendered as a non-link disabled div
				const prevElements = screen.getAllByText(/Previous/i)
				// At least one should not be an anchor (it's a disabled div)
				const disabledPrev = prevElements.find(
					(el) => el.tagName !== "A" && el.closest("a") === null,
				)
				expect(disabledPrev).toBeInTheDocument()
			})
		})

		it("disables the Next Lesson button on the last lesson", async () => {
			const course = makeCourse()
			const lastLesson = course.lessons[course.lessons.length - 1]

			// All previous lessons completed so last lesson is accessible
			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [1, 2],
			})

			await renderLessonView({ lessonId: lastLesson.id })

			await waitFor(() => {
				// Last lesson: Next Lesson is rendered as a disabled div, not a link
				const nextElements = screen.getAllByText(/Next Lesson/i)
				const disabledNext = nextElements.find(
					(el) => el.tagName !== "A" && el.closest("a") === null,
				)
				expect(disabledNext).toBeInTheDocument()
			})
		})

		it("locks the Next Lesson link when current lesson is not yet completed", async () => {
			// Lesson 1 not completed → next is locked
			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [],
			})

			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				const nextLink = screen.getByRole("link", { name: /Next Lesson 🔒/i })
				expect(nextLink).toBeInTheDocument()
				// Locked link points to "#"
				expect(nextLink).toHaveAttribute("href", "#")
			})
		})
	})

	// -------------------------------------------------------------------------
	// 3. Sidebar shows correct lesson list
	// -------------------------------------------------------------------------
	describe("sidebar lesson list", () => {
		it("renders all lesson titles in the sidebar", async () => {
			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				expect(screen.getAllByText("Getting Started").length).toBeGreaterThan(0)
				expect(screen.getAllByText("Accounts & Keys").length).toBeGreaterThan(0)
				expect(
					screen.getAllByText("Build Your First App").length,
				).toBeGreaterThan(0)
			})
		})

		it("shows the correct progress count in the sidebar", async () => {
			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [1],
			})

			await renderLessonView({ lessonId: 2 })

			await waitFor(() => {
				// "1 of 3" progress text
				expect(screen.getByText(/1 of 3/i)).toBeInTheDocument()
			})
		})

		it("shows 0 of N when no lessons are completed", async () => {
			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [],
			})

			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				expect(screen.getByText(/0 of 3/i)).toBeInTheDocument()
			})
		})

		it("renders the Track Outline heading in the sidebar", async () => {
			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				expect(screen.getByText(/Track Outline/i)).toBeInTheDocument()
			})
		})
	})

	// -------------------------------------------------------------------------
	// 4. Current lesson is highlighted in sidebar
	// -------------------------------------------------------------------------
	describe("current lesson highlight in sidebar", () => {
		it("applies active styling to the current lesson link in the sidebar", async () => {
			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				// The current lesson link has bg-brand-blue/20 class
				const lessonLinks = screen.getAllByRole("link", {
					name: /Getting Started/i,
				})
				const sidebarLink = lessonLinks.find((link) =>
					link.className.includes("bg-brand-blue"),
				)
				expect(sidebarLink).toBeInTheDocument()
			})
		})

		it("does not apply active styling to non-current lessons", async () => {
			// Lesson 1 completed so lesson 2 is accessible
			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [1],
			})

			await renderLessonView({ lessonId: 2 })

			await waitFor(() => {
				// "Getting Started" (lesson 1) should not have the active class
				const lessonLinks = screen.getAllByRole("link", {
					name: /Getting Started/i,
				})
				const activeLink = lessonLinks.find((link) =>
					link.className.includes("bg-brand-blue"),
				)
				expect(activeLink).toBeUndefined()
			})
		})
	})

	// -------------------------------------------------------------------------
	// 5. Progress is marked complete after finishing lesson
	// -------------------------------------------------------------------------
	describe("mark lesson as complete", () => {
		it("renders the Mark as Complete button", async () => {
			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				expect(
					screen.getByRole("button", { name: /Mark as Complete/i }),
				).toBeInTheDocument()
			})
		})

		it("calls completeMilestone when Mark as Complete is clicked", async () => {
			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				expect(
					screen.getByRole("button", { name: /Mark as Complete/i }),
				).toBeInTheDocument()
			})

			fireEvent.click(screen.getByRole("button", { name: /Mark as Complete/i }))

			expect(mockCompleteMilestone).toHaveBeenCalledWith("intro-stellar", 1)
		})

		it("shows Lesson Completed button when lesson is already completed", async () => {
			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [1],
			})

			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				expect(
					screen.getByRole("button", { name: /Lesson Completed/i }),
				).toBeInTheDocument()
			})
		})

		it("disables the complete button when lesson is already completed", async () => {
			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [1],
			})

			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				const btn = screen.getByRole("button", { name: /Lesson Completed/i })
				expect(btn).toBeDisabled()
			})
		})

		it("shows Confirming... while milestone completion is in progress", async () => {
			vi.doMock("../hooks/useCourse", () => ({
				useCourse: () => ({
					enrolledCourses: [],
					getCourseProgress: mockGetCourseProgress,
					enroll: vi.fn(),
					completeMilestone: mockCompleteMilestone,
					submitMilestone: mockSubmitMilestone,
					submissionStatusMap: {},
					isCompletingMilestone: true, // in-flight
				}),
			}))

			// Re-import to pick up the updated mock
			vi.resetModules()
			const { default: LessonView } = await import("./LessonView")

			const queryClient = new QueryClient({
				defaultOptions: { queries: { retry: false, gcTime: 0 } },
			})
			const wallet = makeWalletContext()
			const notification = makeNotificationContext()

			const Wrapper = ({ children }: { children: ReactNode }) =>
				createElement(
					QueryClientProvider,
					{ client: queryClient },
					createElement(
						WalletContext,
						{ value: wallet },
						createElement(
							NotificationContext,
							{ value: notification },
							children,
						),
					),
				)

			render(
				createElement(
					MemoryRouter,
					{ initialEntries: ["/courses/intro-stellar/lessons/1"] },
					createElement(
						Routes,
						null,
						createElement(Route, {
							path: "/courses/:courseId/lessons/:lessonId",
							element: createElement(LessonView),
						}),
					),
				),
				{ wrapper: Wrapper },
			)

			await waitFor(() => {
				expect(screen.getByText(/Confirming\.\.\./i)).toBeInTheDocument()
			})
		})
	})

	// -------------------------------------------------------------------------
	// 6. Final lesson shows completion CTA
	// -------------------------------------------------------------------------
	describe("final lesson completion CTA", () => {
		it("shows a disabled Next Lesson element (not a navigable link) on the last lesson", async () => {
			const course = makeCourse()
			const lastLesson = course.lessons[course.lessons.length - 1]

			// All previous lessons completed
			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [1, 2],
			})

			await renderLessonView({ lessonId: lastLesson.id })

			await waitFor(() => {
				// On the last lesson there is no next lesson link — it's a disabled div
				const nextElements = screen.getAllByText(/Next Lesson/i)
				// None of them should be a navigable anchor to another lesson
				const navigableNext = nextElements.find(
					(el) =>
						el.tagName === "A" &&
						el.getAttribute("href") !== "#" &&
						el.getAttribute("href") !== null,
				)
				expect(navigableNext).toBeUndefined()
			})
		})

		it("shows the Mark as Complete button on the final lesson", async () => {
			const course = makeCourse()
			const lastLesson = course.lessons[course.lessons.length - 1]

			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [1, 2],
			})

			await renderLessonView({ lessonId: lastLesson.id })

			await waitFor(() => {
				expect(
					screen.getByRole("button", { name: /Mark as Complete/i }),
				).toBeInTheDocument()
			})
		})

		it("calls completeMilestone with the final lesson id when completed", async () => {
			const course = makeCourse()
			const lastLesson = course.lessons[course.lessons.length - 1]

			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [1, 2],
			})

			await renderLessonView({ lessonId: lastLesson.id })

			await waitFor(() => {
				expect(
					screen.getByRole("button", { name: /Mark as Complete/i }),
				).toBeInTheDocument()
			})

			fireEvent.click(screen.getByRole("button", { name: /Mark as Complete/i }))

			expect(mockCompleteMilestone).toHaveBeenCalledWith(
				"intro-stellar",
				lastLesson.id,
			)
		})
	})

	// -------------------------------------------------------------------------
	// 8. Milestone submission form renders on milestone lessons
	// -------------------------------------------------------------------------
	describe("milestone submission form", () => {
		it("renders MilestoneSubmitPanel on a milestone lesson", async () => {
			// Lesson 3 is a milestone; lessons 1 & 2 must be completed to access it
			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [1, 2],
			})

			await renderLessonView({ lessonId: 3 })

			await waitFor(() => {
				expect(
					screen.getByText(/Submit Milestone Evidence/i),
				).toBeInTheDocument()
			})
		})

		it("renders the GitHub evidence input on a milestone lesson", async () => {
			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [1, 2],
			})

			await renderLessonView({ lessonId: 3 })

			await waitFor(() => {
				expect(screen.getByPlaceholderText(/github\.com/i)).toBeInTheDocument()
			})
		})

		it("renders the work description textarea on a milestone lesson", async () => {
			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [1, 2],
			})

			await renderLessonView({ lessonId: 3 })

			await waitFor(() => {
				expect(
					screen.getByPlaceholderText(/briefly describe/i),
				).toBeInTheDocument()
			})
		})

		it("renders the Submit Milestone button on a milestone lesson", async () => {
			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [1, 2],
			})

			await renderLessonView({ lessonId: 3 })

			await waitFor(() => {
				expect(
					screen.getByRole("button", { name: /Submit Milestone/i }),
				).toBeInTheDocument()
			})
		})

		it("does NOT render MilestoneSubmitPanel on a non-milestone lesson", async () => {
			// Lesson 1 is not a milestone
			await renderLessonView({ lessonId: 1 })

			await waitFor(() => {
				expect(
					screen.queryByText(/Submit Milestone Evidence/i),
				).not.toBeInTheDocument()
			})
		})

		it("calls submitMilestone when the form is submitted with a GitHub URL", async () => {
			mockGetCourseProgress.mockReturnValue({
				courseId: "intro-stellar",
				completedMilestoneIds: [1, 2],
			})

			await renderLessonView({ lessonId: 3 })

			await waitFor(() => {
				expect(screen.getByPlaceholderText(/github\.com/i)).toBeInTheDocument()
			})

			fireEvent.change(screen.getByPlaceholderText(/github\.com/i), {
				target: { value: "https://github.com/user/repo" },
			})

			fireEvent.submit(
				screen
					.getByRole("button", { name: /Submit Milestone/i })
					.closest("form")!,
			)

			expect(mockSubmitMilestone).toHaveBeenCalledWith(
				"intro-stellar",
				3,
				expect.objectContaining({ github: "https://github.com/user/repo" }),
			)
		})

		it("shows pending state after milestone is submitted", async () => {
			// Override useCourse to return a pending submission status
			vi.doMock("../hooks/useCourse", () => ({
				useCourse: () => ({
					enrolledCourses: [],
					getCourseProgress: vi.fn().mockReturnValue({
						courseId: "intro-stellar",
						completedMilestoneIds: [1, 2],
					}),
					enroll: vi.fn(),
					completeMilestone: vi.fn(),
					submitMilestone: vi.fn(),
					submissionStatusMap: { "intro-stellar-3": "pending" },
					isCompletingMilestone: false,
				}),
			}))

			vi.resetModules()
			const { default: LessonView } = await import("./LessonView")

			const queryClient = new QueryClient({
				defaultOptions: { queries: { retry: false, gcTime: 0 } },
			})
			const wallet = makeWalletContext()
			const notification = makeNotificationContext()

			const Wrapper = ({ children }: { children: ReactNode }) =>
				createElement(
					QueryClientProvider,
					{ client: queryClient },
					createElement(
						WalletContext,
						{ value: wallet },
						createElement(
							NotificationContext,
							{ value: notification },
							children,
						),
					),
				)

			render(
				createElement(
					MemoryRouter,
					{ initialEntries: ["/courses/intro-stellar/lessons/3"] },
					createElement(
						Routes,
						null,
						createElement(Route, {
							path: "/courses/:courseId/lessons/:lessonId",
							element: createElement(LessonView),
						}),
					),
				),
				{ wrapper: Wrapper },
			)

			await waitFor(() => {
				expect(screen.getByText(/Submission Received/i)).toBeInTheDocument()
				expect(screen.getByText(/awaiting admin review/i)).toBeInTheDocument()
			})
		})
	})
})
