import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import Learn from "./Learn"

vi.mock("@stellar/design-system", () => ({
	Button: ({
		children,
		onClick,
		"data-testid": testId,
	}: {
		children: React.ReactNode
		onClick?: () => void
		"data-testid"?: string
	}) => (
		<button data-testid={testId} onClick={onClick}>
			{children}
		</button>
	),
	Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	Text: ({ children }: { children: React.ReactNode }) => (
		<span>{children}</span>
	),
}))

vi.mock("../components/MilestoneTracker", () => ({
	MilestoneTracker: ({ courseId }: { courseId: string }) => (
		<div>Milestone Tracker for {courseId}</div>
	),
}))

vi.mock("../hooks/useCourse", () => ({
	useCourse: vi.fn(),
}))

import { useCourse } from "../hooks/useCourse"

const mockUseCourse = vi.mocked(useCourse)

describe("Learn page", () => {
	const enroll = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()

		mockUseCourse.mockReturnValue({
			enroll,
			enrolledCourses: [
				{
					id: "stellar-basics",
					title: "Stellar Basics",
				},
			],
			getCourseProgress: vi.fn().mockReturnValue({
				courseId: "stellar-basics",
				completedMilestoneIds: [1, 2],
				totalMilestones: 3,
			}),
			isCompletingMilestone: false,
			completeMilestone: vi.fn(),
			submitMilestone: vi.fn(),
			submissionStatusMap: {},
			getEscrowTimeout: vi.fn(),
		} as any)
	})

	it("displays enrolled courses with progress", () => {
		render(
			<MemoryRouter>
				<Learn />
			</MemoryRouter>,
		)

		expect(screen.getAllByText(/Stellar Basics/i).length).toBeGreaterThan(0)
		expect(screen.getByText(/67% complete/i)).toBeInTheDocument()
	})

	it("course cards show correct completion percentage", () => {
		render(
			<MemoryRouter>
				<Learn />
			</MemoryRouter>,
		)

		expect(screen.getByText(/67% complete/i)).toBeInTheDocument()
	})

	it("continue button navigates to correct lesson", () => {
		render(
			<MemoryRouter>
				<Learn />
			</MemoryRouter>,
		)

		expect(screen.getByRole("link", { name: /Continue/i })).toHaveAttribute(
			"href",
			"/courses/stellar-basics/lessons/1",
		)
	})

	it("empty state when no enrollments", () => {
		mockUseCourse.mockReturnValue({
			enroll,
			enrolledCourses: [],
			getCourseProgress: vi.fn().mockReturnValue({
				courseId: "stellar-basics",
				completedMilestoneIds: [],
				totalMilestones: 3,
			}),
			isCompletingMilestone: false,
			completeMilestone: vi.fn(),
			submitMilestone: vi.fn(),
			submissionStatusMap: {},
			getEscrowTimeout: vi.fn(),
		} as any)

		render(
			<MemoryRouter>
				<Learn />
			</MemoryRouter>,
		)

		expect(
			screen.getByText(/You are not enrolled in any courses yet/i),
		).toBeInTheDocument()
	})

	it("handles error state gracefully", () => {
		mockUseCourse.mockImplementation(() => {
			throw new Error("Unable to load learning progress")
		})

		expect(() =>
			render(
				<MemoryRouter>
					<Learn />
				</MemoryRouter>,
			),
		).toThrow("Unable to load learning progress")
	})

	it("enroll button calls enroll with course id", async () => {
		render(
			<MemoryRouter>
				<Learn />
			</MemoryRouter>,
		)

		await userEvent.click(screen.getByTestId("enroll-course"))

		expect(enroll).toHaveBeenCalledWith("stellar-basics")
	})
})
