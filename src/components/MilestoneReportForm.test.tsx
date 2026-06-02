import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import MilestoneReportForm from "./MilestoneReportForm"
import type { MilestoneReportFormValues } from "../types/milestone"

describe("MilestoneReportForm", () => {
	const mockOnSubmit = vi.fn()

	beforeEach(() => {
		mockOnSubmit.mockClear()
	})

	it("renders the form with all required fields", () => {
		render(
			<MilestoneReportForm isSubmitting={false} onSubmit={mockOnSubmit} />,
		)

		expect(screen.getByText("Submit a milestone completion report")).toBeInTheDocument()
		expect(screen.getByLabelText("Course ID")).toBeInTheDocument()
		expect(screen.getByLabelText("Milestone number")).toBeInTheDocument()
		expect(screen.getByLabelText("Milestone notes")).toBeInTheDocument()
		expect(screen.getByLabelText("GitHub evidence link")).toBeInTheDocument()
		expect(screen.getByLabelText("IPFS CID")).toBeInTheDocument()
		expect(
			screen.getByText(
				/I certify that this submission accurately represents my completed work/,
			),
		).toBeInTheDocument()
	})

	it("displays submit button and disables it when submitting", () => {
		const { rerender } = render(
			<MilestoneReportForm isSubmitting={false} onSubmit={mockOnSubmit} />,
		)

		const submitButton = screen.getByRole("button", { name: /Submit report/ })
		expect(submitButton).not.toBeDisabled()

		rerender(
			<MilestoneReportForm isSubmitting={true} onSubmit={mockOnSubmit} />,
		)

		expect(submitButton).toBeDisabled()
		expect(submitButton).toHaveTextContent("Submitting...")
	})

	it("validates that course ID is required", async () => {
		const user = userEvent.setup()
		render(
			<MilestoneReportForm isSubmitting={false} onSubmit={mockOnSubmit} />,
		)

		const submitButton = screen.getByRole("button", { name: /Submit report/ })
		await user.click(submitButton)

		expect(
			screen.getByText("Course ID is required."),
		).toBeInTheDocument()
		expect(mockOnSubmit).not.toHaveBeenCalled()
	})

	it("validates that milestone ID is required and must be a number", async () => {
		const user = userEvent.setup()
		render(
			<MilestoneReportForm isSubmitting={false} onSubmit={mockOnSubmit} />,
		)

		const courseIdInput = screen.getByPlaceholderText("stellar-basics")
		await user.type(courseIdInput, "stellar-basics")

		const submitButton = screen.getByRole("button", { name: /Submit report/ })
		await user.click(submitButton)

		expect(
			screen.getByText("Milestone number must be a valid number."),
		).toBeInTheDocument()
		expect(mockOnSubmit).not.toHaveBeenCalled()
	})

	it("validates that at least one evidence field is required", async () => {
		const user = userEvent.setup()
		render(
			<MilestoneReportForm isSubmitting={false} onSubmit={mockOnSubmit} />,
		)

		const courseIdInput = screen.getByPlaceholderText("stellar-basics")
		const milestoneInput = screen.getByPlaceholderText("1")

		await user.type(courseIdInput, "stellar-basics")
		await user.type(milestoneInput, "1")

		const submitButton = screen.getByRole("button", { name: /Submit report/ })
		await user.click(submitButton)

		expect(
			screen.getByText(
				"Provide milestone notes, a GitHub link, or an IPFS CID.",
			),
		).toBeInTheDocument()
		expect(mockOnSubmit).not.toHaveBeenCalled()
	})

	it("validates that terms must be accepted", async () => {
		const user = userEvent.setup()
		render(
			<MilestoneReportForm isSubmitting={false} onSubmit={mockOnSubmit} />,
		)

		const courseIdInput = screen.getByPlaceholderText("stellar-basics")
		const milestoneInput = screen.getByPlaceholderText("1")
		const notesInput = screen.getByPlaceholderText(
			"Describe what you built, tested, or shipped for this milestone.",
		)

		await user.type(courseIdInput, "stellar-basics")
		await user.type(milestoneInput, "1")
		await user.type(notesInput, "Completed the milestone")

		const submitButton = screen.getByRole("button", { name: /Submit report/ })
		await user.click(submitButton)

		expect(
			screen.getByText(
				"You must certify the milestone submission before sending it.",
			),
		).toBeInTheDocument()
		expect(mockOnSubmit).not.toHaveBeenCalled()
	})

	it("successfully submits the form with valid data", async () => {
		const user = userEvent.setup()
		render(
			<MilestoneReportForm isSubmitting={false} onSubmit={mockOnSubmit} />,
		)

		const courseIdInput = screen.getByPlaceholderText("stellar-basics")
		const milestoneInput = screen.getByPlaceholderText("1")
		const notesInput = screen.getByPlaceholderText(
			"Describe what you built, tested, or shipped for this milestone.",
		)
		const termsCheckbox = screen.getByRole("checkbox")

		await user.type(courseIdInput, "stellar-basics")
		await user.type(milestoneInput, "2")
		await user.type(notesInput, "Completed the milestone")
		await user.click(termsCheckbox)

		const submitButton = screen.getByRole("button", { name: /Submit report/ })
		await user.click(submitButton)

		await waitFor(() => {
			expect(mockOnSubmit).toHaveBeenCalledWith(
				expect.objectContaining({
					courseId: "stellar-basics",
					milestoneId: "2",
					evidenceDescription: "Completed the milestone",
					acceptedTerms: true,
				}),
			)
		})
	})

	it("submits with GitHub evidence link", async () => {
		const user = userEvent.setup()
		render(
			<MilestoneReportForm isSubmitting={false} onSubmit={mockOnSubmit} />,
		)

		const courseIdInput = screen.getByPlaceholderText("stellar-basics")
		const milestoneInput = screen.getByPlaceholderText("1")
		const githubInput = screen.getByPlaceholderText("https://github.com/...")
		const termsCheckbox = screen.getByRole("checkbox")

		await user.type(courseIdInput, "course-1")
		await user.type(milestoneInput, "1")
		await user.type(githubInput, "https://github.com/user/repo")
		await user.click(termsCheckbox)

		const submitButton = screen.getByRole("button", { name: /Submit report/ })
		await user.click(submitButton)

		await waitFor(() => {
			expect(mockOnSubmit).toHaveBeenCalledWith(
				expect.objectContaining({
					evidenceGithub: "https://github.com/user/repo",
				}),
			)
		})
	})

	it("submits with IPFS CID evidence", async () => {
		const user = userEvent.setup()
		render(
			<MilestoneReportForm isSubmitting={false} onSubmit={mockOnSubmit} />,
		)

		const courseIdInput = screen.getByPlaceholderText("stellar-basics")
		const milestoneInput = screen.getByPlaceholderText("1")
		const ipfsInput = screen.getByPlaceholderText("bafy...")
		const termsCheckbox = screen.getByRole("checkbox")

		await user.type(courseIdInput, "course-1")
		await user.type(milestoneInput, "1")
		await user.type(ipfsInput, "bafyreiabc123")
		await user.click(termsCheckbox)

		const submitButton = screen.getByRole("button", { name: /Submit report/ })
		await user.click(submitButton)

		await waitFor(() => {
			expect(mockOnSubmit).toHaveBeenCalledWith(
				expect.objectContaining({
					evidenceIpfsCid: "bafyreiabc123",
				}),
			)
		})
	})

	it("clears form after successful submission", async () => {
		const user = userEvent.setup()
		mockOnSubmit.mockResolvedValueOnce(undefined)

		render(
			<MilestoneReportForm isSubmitting={false} onSubmit={mockOnSubmit} />,
		)

		const courseIdInput = screen.getByPlaceholderText(
			"stellar-basics",
		) as HTMLInputElement
		const milestoneInput = screen.getByPlaceholderText("1") as HTMLInputElement
		const notesInput = screen.getByPlaceholderText(
			"Describe what you built, tested, or shipped for this milestone.",
		) as HTMLTextAreaElement
		const termsCheckbox = screen.getByRole("checkbox") as HTMLInputElement

		await user.type(courseIdInput, "stellar-basics")
		await user.type(milestoneInput, "1")
		await user.type(notesInput, "Completed the milestone")
		await user.click(termsCheckbox)

		const submitButton = screen.getByRole("button", { name: /Submit report/ })
		await user.click(submitButton)

		await waitFor(() => {
			expect(courseIdInput.value).toBe("")
			expect(milestoneInput.value).toBe("")
			expect(notesInput.value).toBe("")
			expect(termsCheckbox.checked).toBe(false)
		})
	})

	it("displays error message when submission fails", async () => {
		const user = userEvent.setup()
		const error = new Error("Network error")
		mockOnSubmit.mockRejectedValueOnce(error)

		render(
			<MilestoneReportForm isSubmitting={false} onSubmit={mockOnSubmit} />,
		)

		const courseIdInput = screen.getByPlaceholderText("stellar-basics")
		const milestoneInput = screen.getByPlaceholderText("1")
		const notesInput = screen.getByPlaceholderText(
			"Describe what you built, tested, or shipped for this milestone.",
		)
		const termsCheckbox = screen.getByRole("checkbox")

		await user.type(courseIdInput, "stellar-basics")
		await user.type(milestoneInput, "1")
		await user.type(notesInput, "Completed the milestone")
		await user.click(termsCheckbox)

		const submitButton = screen.getByRole("button", { name: /Submit report/ })
		await user.click(submitButton)

		await waitFor(() => {
			expect(screen.getByText("Network error")).toBeInTheDocument()
		})
	})

	it("clears error message when user starts typing", async () => {
		const user = userEvent.setup()
		render(
			<MilestoneReportForm isSubmitting={false} onSubmit={mockOnSubmit} />,
		)

		const submitButton = screen.getByRole("button", { name: /Submit report/ })
		await user.click(submitButton)

		expect(
			screen.getByText("Course ID is required."),
		).toBeInTheDocument()

		const courseIdInput = screen.getByPlaceholderText("stellar-basics")
		await user.type(courseIdInput, "stellar-basics")

		expect(
			screen.queryByText("Course ID is required."),
		).not.toBeInTheDocument()
	})
})
