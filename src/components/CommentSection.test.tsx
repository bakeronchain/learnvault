import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CommentSection, { type Comment } from "./CommentSection"

// Mock the hooks
vi.mock("../hooks/useWallet", () => ({
	useWallet: () => ({
		address: "GTEST123",
	}),
}))

vi.mock("../hooks/useTranslation", () => ({
	useTranslation: () => ({
		t: (key: string, defaultValue: string) => defaultValue,
	}),
}))

vi.mock("../util/auth", () => ({
	getAuthToken: () => "test-token",
}))

vi.mock("./CommentCard", () => ({
	default: ({ comment }: { comment: Comment }) => (
		<div data-testid={`comment-${comment.id}`}>
			<p>{comment.content}</p>
			<p>{comment.author_address}</p>
		</div>
	),
}))

const mockComments: Comment[] = [
	{
		id: 1,
		proposal_id: "prop-1",
		author_address: "GUSER1",
		parent_id: null,
		content: "Great proposal!",
		upvotes: 5,
		downvotes: 1,
		is_pinned: false,
		created_at: "2024-01-01T10:00:00Z",
	},
	{
		id: 2,
		proposal_id: "prop-1",
		author_address: "GUSER2",
		parent_id: null,
		content: "I agree",
		upvotes: 3,
		downvotes: 0,
		is_pinned: false,
		created_at: "2024-01-01T11:00:00Z",
	},
	{
		id: 3,
		proposal_id: "prop-1",
		author_address: "GUSER1",
		parent_id: 1,
		content: "Thanks for the feedback!",
		upvotes: 2,
		downvotes: 0,
		is_pinned: false,
		created_at: "2024-01-01T12:00:00Z",
	},
]

describe("CommentSection", () => {
	beforeEach(() => {
		global.fetch = vi.fn()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("renders the comment section with title", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockComments,
		})

		render(<CommentSection proposalId="prop-1" />)

		expect(screen.getByText("Discussion")).toBeInTheDocument()
		expect(screen.getByText("Add a comment")).toBeInTheDocument()
	})

	it("fetches and displays comments", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockComments,
		})

		render(<CommentSection proposalId="prop-1" />)

		await waitFor(() => {
			expect(screen.getByTestId("comment-1")).toBeInTheDocument()
			expect(screen.getByTestId("comment-2")).toBeInTheDocument()
		})
	})

	it("displays loading state initially", () => {
		;(global.fetch as any).mockImplementationOnce(
			() =>
				new Promise(() => {
					/* never resolves */
				}),
		)

		render(<CommentSection proposalId="prop-1" />)

		expect(screen.getByText("Loading Discussion...")).toBeInTheDocument()
	})

	it("handles fetch error gracefully", async () => {
		;(global.fetch as any).mockRejectedValueOnce(new Error("Network error"))

		render(<CommentSection proposalId="prop-1" />)

		await waitFor(() => {
			// Should not crash and should show empty state
			expect(screen.queryByTestId("comment-1")).not.toBeInTheDocument()
		})
	})

	it("allows sorting comments by top", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockComments,
		})

		const user = userEvent.setup()
		render(<CommentSection proposalId="prop-1" />)

		await waitFor(() => {
			expect(screen.getByTestId("comment-1")).toBeInTheDocument()
		})

		const topButton = screen.getByRole("button", { name: "top" })
		await user.click(topButton)

		// Comment 1 has 4 net votes (5-1), Comment 2 has 3 net votes (3-0)
		// So Comment 1 should appear first
		const comments = screen.getAllByTestId(/comment-/)
		expect(comments[0]).toHaveAttribute("data-testid", "comment-1")
	})

	it("allows sorting comments by newest", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockComments,
		})

		const user = userEvent.setup()
		render(<CommentSection proposalId="prop-1" />)

		await waitFor(() => {
			expect(screen.getByTestId("comment-1")).toBeInTheDocument()
		})

		const newButton = screen.getByRole("button", { name: "new" })
		await user.click(newButton)

		// Newest should be comment 3 (created at 12:00)
		const comments = screen.getAllByTestId(/comment-/)
		expect(comments[0]).toHaveAttribute("data-testid", "comment-3")
	})

	it("allows sorting comments by oldest", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockComments,
		})

		const user = userEvent.setup()
		render(<CommentSection proposalId="prop-1" />)

		await waitFor(() => {
			expect(screen.getByTestId("comment-1")).toBeInTheDocument()
		})

		const oldestButton = screen.getByRole("button", { name: "oldest" })
		await user.click(oldestButton)

		// Oldest should be comment 1 (created at 10:00)
		const comments = screen.getAllByTestId(/comment-/)
		expect(comments[0]).toHaveAttribute("data-testid", "comment-1")
	})

	it("prevents posting empty comments", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => [],
		})

		const user = userEvent.setup()
		render(<CommentSection proposalId="prop-1" />)

		const postButton = screen.getByRole("button", { name: "Post Comment" })
		expect(postButton).toBeDisabled()

		const textarea = screen.getByPlaceholderText(/Share your thoughts/)
		await user.type(textarea, "Test comment")

		expect(postButton).not.toBeDisabled()
	})

	it("shows error when posting without authentication", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => [],
		})

		// Mock getAuthToken to return null
		vi.doMock("../util/auth", () => ({
			getAuthToken: () => null,
		}))

		const user = userEvent.setup()
		render(<CommentSection proposalId="prop-1" />)

		const textarea = screen.getByPlaceholderText(/Share your thoughts/)
		await user.type(textarea, "Test comment")

		const postButton = screen.getByRole("button", { name: "Post Comment" })
		await user.click(postButton)

		await waitFor(() => {
			expect(screen.getByText("Sign in to post a comment.")).toBeInTheDocument()
		})
	})

	it("successfully posts a comment", async () => {
		;(global.fetch as any)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => [],
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => mockComments,
			})

		const user = userEvent.setup()
		render(<CommentSection proposalId="prop-1" />)

		const textarea = screen.getByPlaceholderText(/Share your thoughts/)
		await user.type(textarea, "Great proposal!")

		const postButton = screen.getByRole("button", { name: "Post Comment" })
		await user.click(postButton)

		await waitFor(() => {
			expect(screen.getByText("Comment posted successfully.")).toBeInTheDocument()
		})

		// Verify the fetch was called with correct parameters
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining("/api/comments"),
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer test-token",
				}),
				body: expect.stringContaining("Great proposal!"),
			}),
		)
	})

	it("displays error when comment posting fails", async () => {
		;(global.fetch as any)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => [],
			})
			.mockResolvedValueOnce({
				ok: false,
				json: async () => ({ error: "Comment too long" }),
			})

		const user = userEvent.setup()
		render(<CommentSection proposalId="prop-1" />)

		const textarea = screen.getByPlaceholderText(/Share your thoughts/)
		await user.type(textarea, "Test comment")

		const postButton = screen.getByRole("button", { name: "Post Comment" })
		await user.click(postButton)

		await waitFor(() => {
			expect(screen.getByText("Comment too long")).toBeInTheDocument()
		})
	})

	it("clears error message when user starts typing", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => [],
		})

		const user = userEvent.setup()
		render(<CommentSection proposalId="prop-1" />)

		const postButton = screen.getByRole("button", { name: "Post Comment" })
		await user.click(postButton)

		await waitFor(() => {
			expect(
				screen.getByText("Enter a comment before posting."),
			).toBeInTheDocument()
		})

		const textarea = screen.getByPlaceholderText(/Share your thoughts/)
		await user.type(textarea, "Test")

		expect(
			screen.queryByText("Enter a comment before posting."),
		).not.toBeInTheDocument()
	})

	it("displays pinned comments first", async () => {
		const pinnedComments: Comment[] = [
			{
				id: 1,
				proposal_id: "prop-1",
				author_address: "GUSER1",
				parent_id: null,
				content: "Pinned comment",
				upvotes: 0,
				downvotes: 0,
				is_pinned: true,
				created_at: "2024-01-01T10:00:00Z",
			},
			{
				id: 2,
				proposal_id: "prop-1",
				author_address: "GUSER2",
				parent_id: null,
				content: "Regular comment",
				upvotes: 0,
				downvotes: 0,
				is_pinned: false,
				created_at: "2024-01-01T11:00:00Z",
			},
		]

		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => pinnedComments,
		})

		render(<CommentSection proposalId="prop-1" />)

		await waitFor(() => {
			const comments = screen.getAllByTestId(/comment-/)
			expect(comments[0]).toHaveAttribute("data-testid", "comment-1")
		})
	})

	it("displays nested replies under parent comments", async () => {
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockComments,
		})

		render(<CommentSection proposalId="prop-1" />)

		await waitFor(() => {
			expect(screen.getByTestId("comment-1")).toBeInTheDocument()
			expect(screen.getByTestId("comment-3")).toBeInTheDocument()
		})

		// Comment 3 is a reply to comment 1 (parent_id: 1)
		// It should be displayed in the nested structure
	})
})
