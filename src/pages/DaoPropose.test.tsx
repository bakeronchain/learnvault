import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useToast } from "../components/Toast/ToastProvider"
import { useProposals } from "../hooks/useProposals"
import { useWallet } from "../hooks/useWallet"
import DaoPropose from "./DaoPropose"

vi.mock("../hooks/useWallet", () => ({
	useWallet: vi.fn(),
}))

vi.mock("../hooks/useProposals", () => ({
	useProposals: vi.fn(),
}))

vi.mock("../components/Toast/ToastProvider", () => ({
	useToast: vi.fn(),
}))

vi.mock("react-router-dom", () => ({
	useNavigate: vi.fn(),
}))

const mockUseWallet = vi.mocked(useWallet)
const mockUseProposals = vi.mocked(useProposals)
const mockUseToast = vi.mocked(useToast)
const mockUseNavigate = vi.mocked(useNavigate)

const mockNavigate = vi.fn()

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
			mutations: {
				retry: false,
			},
		},
	})

	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		)
	}
}

describe("DaoPropose", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockUseWallet.mockReturnValue({
			address: "GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDDXYZ",
		} as ReturnType<typeof useWallet>)
		mockUseProposals.mockReturnValue({
			createProposal: vi.fn(),
			isSubmittingProposal: false,
			votingPower: 100n,
		} as ReturnType<typeof useProposals>)
		mockUseToast.mockReturnValue({
			showSuccess: vi.fn(),
			showError: vi.fn(),
			showInfo: vi.fn(),
			showWarning: vi.fn(),
		})
		mockUseNavigate.mockReturnValue(mockNavigate)
	})

	it("renders the proposal form when wallet is connected and has sufficient balance", async () => {
		render(<DaoPropose />, { wrapper: createWrapper() })
		expect(screen.getByText("Create Proposal")).toBeInTheDocument()
		expect(
			screen.getByPlaceholderText("Enter proposal title"),
		).toBeInTheDocument()
		expect(
			screen.getByPlaceholderText(
				"Enter the proposal details using Markdown formatting",
			),
		).toBeInTheDocument()
	})

	it("shows wallet connection prompt when wallet is not connected", async () => {
		mockUseWallet.mockReturnValue({
			address: null,
		} as ReturnType<typeof useWallet>)
		render(<DaoPropose />, { wrapper: createWrapper() })
		expect(screen.getByText("Connect Your Wallet")).toBeInTheDocument()
	})

	it("shows insufficient tokens message when balance is too low", async () => {
		mockUseProposals.mockReturnValue({
			createProposal: vi.fn(),
			isSubmittingProposal: false,
			votingPower: 5n,
		} as ReturnType<typeof useProposals>)
		render(<DaoPropose />, { wrapper: createWrapper() })
		expect(
			screen.getByText("Insufficient Governance Tokens"),
		).toBeInTheDocument()
	})

	it("displays validation error when submitting with empty title", async () => {
		const user = userEvent.setup()
		render(<DaoPropose />, { wrapper: createWrapper() })

		const submitButton = screen.getByTestId("submit-proposal")
		await user.click(submitButton)

		await waitFor(() => {
			expect(
				screen.getByText("Proposal title is required."),
			).toBeInTheDocument()
		})
	})

	it("displays validation error when submitting with empty description", async () => {
		const user = userEvent.setup()
		render(<DaoPropose />, { wrapper: createWrapper() })

		const titleInput = screen.getByPlaceholderText("Enter proposal title")
		await user.type(titleInput, "Test Proposal")

		const submitButton = screen.getByTestId("submit-proposal")
		await user.click(submitButton)

		await waitFor(() => {
			expect(
				screen.getByText("Proposal description is required."),
			).toBeInTheDocument()
		})
	})

	it("validates scholarship URL format when provided", async () => {
		const user = userEvent.setup()
		render(<DaoPropose />, { wrapper: createWrapper() })

		const titleInput = screen.getByPlaceholderText("Enter proposal title")
		await user.type(titleInput, "Test Proposal")

		const descriptionTextarea = screen.getByPlaceholderText(
			"Enter the proposal details using Markdown formatting",
		)
		await user.type(descriptionTextarea, "Test proposal description")

		const urlInput = screen.getByPlaceholderText(
			"https://example.com/scholarship-application",
		)
		await user.type(urlInput, "invalid-url")

		const submitButton = screen.getByTestId("submit-proposal")
		await user.click(submitButton)

		await waitFor(() => {
			expect(
				screen.getByText(
					"Please enter a valid URL starting with http:// or https://",
				),
			).toBeInTheDocument()
		})
	})

	it("clears field error when user starts typing", async () => {
		const user = userEvent.setup()
		render(<DaoPropose />, { wrapper: createWrapper() })

		const submitButton = screen.getByTestId("submit-proposal")
		await user.click(submitButton)

		await waitFor(() => {
			expect(
				screen.getByText("Proposal title is required."),
			).toBeInTheDocument()
		})

		const titleInput = screen.getByPlaceholderText("Enter proposal title")
		await user.type(titleInput, "Test")

		await waitFor(() => {
			expect(
				screen.queryByText("Proposal title is required."),
			).not.toBeInTheDocument()
		})
	})

	it("shows pending state with spinner while submitting", async () => {
		mockUseProposals.mockReturnValue({
			createProposal: vi.fn(() => new Promise(() => {})),
			isSubmittingProposal: true,
			votingPower: 100n,
		} as ReturnType<typeof useProposals>)

		render(<DaoPropose />, { wrapper: createWrapper() })

		expect(screen.getByText("Submitting...")).toBeInTheDocument()
		const submitButton = screen.getByTestId("submit-proposal")
		expect(submitButton).toBeDisabled()
	})

	it("shows success screen after successful submission", async () => {
		const user = userEvent.setup()
		const mockCreateProposal = vi.fn().mockResolvedValue({
			proposal_id: 42,
			tx_hash: "abc123hash",
		})

		mockUseProposals.mockReturnValue({
			createProposal: mockCreateProposal,
			isSubmittingProposal: false,
			votingPower: 100n,
		} as ReturnType<typeof useProposals>)

		render(<DaoPropose />, { wrapper: createWrapper() })

		const titleInput = screen.getByPlaceholderText("Enter proposal title")
		await user.type(titleInput, "Test Proposal")

		const descriptionTextarea = screen.getByPlaceholderText(
			"Enter the proposal details using Markdown formatting",
		)
		await user.type(descriptionTextarea, "Test proposal description")

		const submitButton = screen.getByTestId("submit-proposal")
		await user.click(submitButton)

		await waitFor(() => {
			expect(screen.getByText("Proposal Submitted!")).toBeInTheDocument()
			expect(screen.getByText("42")).toBeInTheDocument()
			expect(screen.getByText("Transaction Hash")).toBeInTheDocument()
			expect(screen.getByText("abc123hash")).toBeInTheDocument()
		})
	})

	it("navigates to proposals page when clicking View Proposal button", async () => {
		const user = userEvent.setup()
		const mockCreateProposal = vi.fn().mockResolvedValue({
			proposal_id: 42,
			tx_hash: null,
		})

		mockUseProposals.mockReturnValue({
			createProposal: mockCreateProposal,
			isSubmittingProposal: false,
			votingPower: 100n,
		} as ReturnType<typeof useProposals>)

		render(<DaoPropose />, { wrapper: createWrapper() })

		const titleInput = screen.getByPlaceholderText("Enter proposal title")
		await user.type(titleInput, "Test Proposal")

		const descriptionTextarea = screen.getByPlaceholderText(
			"Enter the proposal details using Markdown formatting",
		)
		await user.type(descriptionTextarea, "Test proposal description")

		const submitButton = screen.getByTestId("submit-proposal")
		await user.click(submitButton)

		await waitFor(() => {
			expect(screen.getByText("Proposal Submitted!")).toBeInTheDocument()
		})

		const viewProposalButton = screen.getByText("View Proposal")
		await user.click(viewProposalButton)

		expect(mockNavigate).toHaveBeenCalledWith("/dao/proposals?proposal=42")
	})

	it("resets form when clicking Create Another Proposal button", async () => {
		const user = userEvent.setup()
		const mockCreateProposal = vi.fn().mockResolvedValue({
			proposal_id: 42,
			tx_hash: null,
		})

		mockUseProposals.mockReturnValue({
			createProposal: mockCreateProposal,
			isSubmittingProposal: false,
			votingPower: 100n,
		} as ReturnType<typeof useProposals>)

		render(<DaoPropose />, { wrapper: createWrapper() })

		const titleInput = screen.getByPlaceholderText("Enter proposal title")
		await user.type(titleInput, "Test Proposal")

		const descriptionTextarea = screen.getByPlaceholderText(
			"Enter the proposal details using Markdown formatting",
		)
		await user.type(descriptionTextarea, "Test proposal description")

		const submitButton = screen.getByTestId("submit-proposal")
		await user.click(submitButton)

		await waitFor(() => {
			expect(screen.getByText("Proposal Submitted!")).toBeInTheDocument()
		})

		const createAnotherButton = screen.getByText("Create Another Proposal")
		await user.click(createAnotherButton)

		await waitFor(() => {
			expect(screen.getByText("Create Proposal")).toBeInTheDocument()
			expect(screen.getByPlaceholderText("Enter proposal title")).toHaveValue(
				"",
			)
		})
	})

	it("displays error message when proposal creation fails", async () => {
		const user = userEvent.setup()
		const mockCreateProposal = vi
			.fn()
			.mockRejectedValue(new Error("Network error"))
		const mockShowError = vi.fn()

		mockUseProposals.mockReturnValue({
			createProposal: mockCreateProposal,
			isSubmittingProposal: false,
			votingPower: 100n,
		} as ReturnType<typeof useProposals>)

		mockUseToast.mockReturnValue({
			showSuccess: vi.fn(),
			showError: mockShowError,
			showInfo: vi.fn(),
			showWarning: vi.fn(),
		})

		render(<DaoPropose />, { wrapper: createWrapper() })

		const titleInput = screen.getByPlaceholderText("Enter proposal title")
		await user.type(titleInput, "Test Proposal")

		const descriptionTextarea = screen.getByPlaceholderText(
			"Enter the proposal details using Markdown formatting",
		)
		await user.type(descriptionTextarea, "Test proposal description")

		const submitButton = screen.getByTestId("submit-proposal")
		await user.click(submitButton)

		await waitFor(() => {
			expect(screen.getByText("Network error")).toBeInTheDocument()
		})
	})
})
