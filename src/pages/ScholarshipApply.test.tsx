import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useScholarshipApplication } from "../hooks/useScholarshipApplication"
import { useWallet } from "../hooks/useWallet"
import ScholarshipApply from "./ScholarshipApply"

// Override global @stellar/design-system mock to render real interactive elements.
vi.mock("@stellar/design-system", () => ({
	Button: ({
		children,
		onClick,
		disabled,
	}: {
		children: React.ReactNode
		onClick?: () => void
		disabled?: boolean
	}) => (
		<button onClick={onClick} disabled={disabled}>
			{children}
		</button>
	),
	Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("../hooks/useWallet", () => ({
	useWallet: vi.fn(),
}))

vi.mock("../hooks/useScholarshipApplication", () => ({
	useScholarshipApplication: vi.fn(),
}))

const mockUseWallet = vi.mocked(useWallet)
const mockUseScholarshipApplication = vi.mocked(useScholarshipApplication)

const WALLET_ADDRESS = "GTEST1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO"

const LONG_DESCRIPTION =
	"I want to learn Soroban and build decentralized finance applications on the Stellar blockchain network."

const VALID_MILESTONE_DESC =
	"Complete the module and submit a working Soroban smart contract deployment"

function makeApplicationHook(overrides = {}) {
	return {
		eligible: true,
		eligibilityBalance: 150,
		eligibilitySource: "contract" as const,
		isCheckingEligibility: false,
		isSubmitting: false,
		latestSubmittedProposal: null,
		lrnGap: 0,
		minLrnRequired: 100,
		submitApplication: vi.fn(),
		...overrides,
	}
}

function renderPage() {
	return render(
		<MemoryRouter>
			<ScholarshipApply />
		</MemoryRouter>,
	)
}

// Advances the wizard from step 1 through step 2 with valid data, landing on step 3.
async function fillAndNavigateToStep3(
	user: ReturnType<typeof userEvent.setup>,
) {
	// Step 0 → 1
	await user.click(screen.getByRole("button", { name: /continue/i }))

	// Fill step 1 (Program Details)
	await user.type(
		screen.getByLabelText(/program or bootcamp name/i),
		"Soroban Bootcamp",
	)
	await user.type(
		screen.getByLabelText(/program url/i),
		"https://example.com/soroban",
	)
	await user.type(
		screen.getByLabelText(/why this program matters/i),
		LONG_DESCRIPTION,
	)
	fireEvent.change(screen.getByLabelText(/program start date/i), {
		target: { value: "2025-06-01" },
	})

	// Step 1 → 2
	await user.click(screen.getByRole("button", { name: /continue/i }))

	// Fill step 2 (Funding Request)
	fireEvent.change(screen.getByLabelText(/requested amount/i), {
		target: { value: "1500" },
	})
	const descAreas = screen.getAllByPlaceholderText(/what will be delivered/i)
	const dateInputs = screen.getAllByLabelText(/target date/i)
	await user.type(descAreas[0], VALID_MILESTONE_DESC)
	await user.type(descAreas[1], VALID_MILESTONE_DESC)
	await user.type(descAreas[2], VALID_MILESTONE_DESC)
	fireEvent.change(dateInputs[0], { target: { value: "2025-07-01" } })
	fireEvent.change(dateInputs[1], { target: { value: "2025-08-01" } })
	fireEvent.change(dateInputs[2], { target: { value: "2025-09-01" } })

	// Step 2 → 3
	await user.click(screen.getByRole("button", { name: /continue/i }))
}

beforeEach(() => {
	vi.clearAllMocks()
	mockUseWallet.mockReturnValue({ address: WALLET_ADDRESS } as any)
	mockUseScholarshipApplication.mockReturnValue(makeApplicationHook() as any)
})

// ── Step 0: Eligibility ──────────────────────────────────────────────────────

describe("Step 0: Eligibility Check", () => {
	it("renders all required fields and eligibility status", () => {
		renderPage()
		expect(screen.getByText("Eligibility check")).toBeInTheDocument()
		expect(screen.getByText(/connected wallet/i)).toBeInTheDocument()
		expect(screen.getByText(/current lrn balance/i)).toBeInTheDocument()
		expect(screen.getByText("Threshold")).toBeInTheDocument()
		expect(screen.getByText(/eligibility status/i)).toBeInTheDocument()
		expect(screen.getByText(/eligible to continue/i)).toBeInTheDocument()
	})

	it("shows step navigation buttons", () => {
		renderPage()
		expect(screen.getByRole("button", { name: /back/i })).toBeDisabled()
		expect(
			screen.getByRole("button", { name: /continue/i }),
		).toBeInTheDocument()
	})

	it("shows an error when wallet is not connected and Continue is clicked", async () => {
		const user = userEvent.setup()
		mockUseWallet.mockReturnValue({ address: undefined } as any)
		renderPage()
		await user.click(screen.getByRole("button", { name: /continue/i }))
		expect(screen.getByRole("alert")).toHaveTextContent(/connect your wallet/i)
	})

	it("shows an error when user is ineligible and Continue is clicked", async () => {
		const user = userEvent.setup()
		mockUseScholarshipApplication.mockReturnValue(
			makeApplicationHook({ eligible: false, lrnGap: 50 }) as any,
		)
		renderPage()
		await user.click(screen.getByRole("button", { name: /continue/i }))
		expect(screen.getByRole("alert")).toHaveTextContent(/more lrn/i)
	})

	it("shows a waiting error when eligibility is still being checked", async () => {
		const user = userEvent.setup()
		mockUseScholarshipApplication.mockReturnValue(
			makeApplicationHook({ isCheckingEligibility: true }) as any,
		)
		renderPage()
		await user.click(screen.getByRole("button", { name: /continue/i }))
		expect(screen.getByRole("alert")).toHaveTextContent(
			/wait for the lrn balance check/i,
		)
	})
})

// ── Step 1: Program Details ──────────────────────────────────────────────────

describe("Step 1: Program Details", () => {
	async function goToStep1() {
		const user = userEvent.setup()
		renderPage()
		await user.click(screen.getByRole("button", { name: /continue/i }))
		return user
	}

	it("renders all program detail fields", async () => {
		await goToStep1()
		expect(
			screen.getByLabelText(/program or bootcamp name/i),
		).toBeInTheDocument()
		expect(screen.getByLabelText(/program url/i)).toBeInTheDocument()
		expect(
			screen.getByLabelText(/why this program matters/i),
		).toBeInTheDocument()
		expect(screen.getByLabelText(/program start date/i)).toBeInTheDocument()
	})

	it("shows validation error when title exceeds 80 characters", async () => {
		const user = await goToStep1()
		await user.type(
			screen.getByLabelText(/program or bootcamp name/i),
			"A".repeat(81),
		)
		await user.click(screen.getByRole("button", { name: /continue/i }))
		const alerts = screen.getAllByRole("alert")
		expect(
			alerts.some((a) => a.textContent?.match(/under 80 characters/i)),
		).toBe(true)
	})

	it("shows validation error when program name is missing", async () => {
		const user = await goToStep1()
		await user.click(screen.getByRole("button", { name: /continue/i }))
		const alerts = screen.getAllByRole("alert")
		expect(
			alerts.some((a) =>
				a.textContent?.match(/enter the program or bootcamp name/i),
			),
		).toBe(true)
	})

	it("shows validation error when description field is empty", async () => {
		const user = await goToStep1()
		await user.type(
			screen.getByLabelText(/program or bootcamp name/i),
			"Soroban Bootcamp",
		)
		await user.type(
			screen.getByLabelText(/program url/i),
			"https://example.com",
		)
		fireEvent.change(screen.getByLabelText(/program start date/i), {
			target: { value: "2025-06-01" },
		})
		await user.click(screen.getByRole("button", { name: /continue/i }))
		const alerts = screen.getAllByRole("alert")
		expect(alerts.some((a) => a.textContent?.match(/add more detail/i))).toBe(
			true,
		)
	})

	it("shows validation error when URL is invalid", async () => {
		const user = await goToStep1()
		await user.type(screen.getByLabelText(/program url/i), "not-a-valid-url")
		await user.click(screen.getByRole("button", { name: /continue/i }))
		const alerts = screen.getAllByRole("alert")
		expect(alerts.some((a) => a.textContent?.match(/valid url/i))).toBe(true)
	})
})

// ── Step 2: Funding Request ──────────────────────────────────────────────────

describe("Step 2: Funding Request", () => {
	async function goToStep2() {
		const user = userEvent.setup()
		renderPage()
		await user.click(screen.getByRole("button", { name: /continue/i }))
		await user.type(
			screen.getByLabelText(/program or bootcamp name/i),
			"Soroban Bootcamp",
		)
		await user.type(
			screen.getByLabelText(/program url/i),
			"https://example.com/soroban",
		)
		await user.type(
			screen.getByLabelText(/why this program matters/i),
			LONG_DESCRIPTION,
		)
		fireEvent.change(screen.getByLabelText(/program start date/i), {
			target: { value: "2025-06-01" },
		})
		await user.click(screen.getByRole("button", { name: /continue/i }))
		return user
	}

	it("renders the amount field and exactly 3 milestone fieldsets", async () => {
		await goToStep2()
		expect(screen.getByLabelText(/requested amount/i)).toBeInTheDocument()
		expect(screen.getByText("Milestone 1")).toBeInTheDocument()
		expect(screen.getByText("Milestone 2")).toBeInTheDocument()
		expect(screen.getByText("Milestone 3")).toBeInTheDocument()
		expect(screen.getAllByText(/milestone \d/i)).toHaveLength(3)
	})

	it("shows error when amount is 0", async () => {
		const user = await goToStep2()
		fireEvent.change(screen.getByLabelText(/requested amount/i), {
			target: { value: "0" },
		})
		await user.click(screen.getByRole("button", { name: /continue/i }))
		const alerts = screen.getAllByRole("alert")
		expect(alerts.some((a) => a.textContent?.match(/above 0 usdc/i))).toBe(true)
	})

	it("shows error when amount is missing", async () => {
		const user = await goToStep2()
		await user.click(screen.getByRole("button", { name: /continue/i }))
		const alerts = screen.getAllByRole("alert")
		expect(
			alerts.some((a) => a.textContent?.match(/enter the usdc amount/i)),
		).toBe(true)
	})

	it("shows error when a milestone description is too short", async () => {
		const user = await goToStep2()
		fireEvent.change(screen.getByLabelText(/requested amount/i), {
			target: { value: "1500" },
		})
		const descAreas = screen.getAllByPlaceholderText(/what will be delivered/i)
		await user.type(descAreas[0], "Too short")
		await user.click(screen.getByRole("button", { name: /continue/i }))
		const alerts = screen.getAllByRole("alert")
		expect(
			alerts.some((a) =>
				a.textContent?.match(/describe what this milestone covers/i),
			),
		).toBe(true)
	})
})

// ── Step 3: Review & Submit ──────────────────────────────────────────────────

describe("Step 3: Review & Submit", () => {
	it("renders the review step with form summary", async () => {
		const user = userEvent.setup()
		renderPage()
		await fillAndNavigateToStep3(user)
		expect(screen.getByText("Review & submit")).toBeInTheDocument()
		expect(screen.getByText("Soroban Bootcamp")).toBeInTheDocument()
	})

	it("shows error when wallet confirmation checkbox is unchecked on submit", async () => {
		const user = userEvent.setup()
		renderPage()
		await fillAndNavigateToStep3(user)
		await user.click(screen.getByRole("button", { name: /sign & submit/i }))
		expect(screen.getByRole("alert")).toHaveTextContent(
			/confirm the connected wallet/i,
		)
	})

	it("calls submitApplication with form data when confirmed and submitted", async () => {
		const mockSubmit = vi.fn().mockResolvedValue({
			proposalId: "prop-123",
			source: "on-chain",
			txHash: "abc123hash",
			daoPath: "/dao#proposal-prop-123",
		})
		mockUseScholarshipApplication.mockReturnValue(
			makeApplicationHook({ submitApplication: mockSubmit }) as any,
		)
		const user = userEvent.setup()
		renderPage()
		await fillAndNavigateToStep3(user)
		await user.click(screen.getByLabelText(/i confirm that/i))
		await user.click(screen.getByRole("button", { name: /sign & submit/i }))
		await waitFor(() => {
			expect(mockSubmit).toHaveBeenCalledOnce()
		})
		expect(mockSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				programName: "Soroban Bootcamp",
				amountUsdc: "1500",
				walletConfirmed: true,
			}),
		)
	})

	it("shows submission error message when submitApplication rejects", async () => {
		const mockSubmit = vi
			.fn()
			.mockRejectedValue(new Error("Network error occurred"))
		mockUseScholarshipApplication.mockReturnValue(
			makeApplicationHook({ submitApplication: mockSubmit }) as any,
		)
		const user = userEvent.setup()
		renderPage()
		await fillAndNavigateToStep3(user)
		await user.click(screen.getByLabelText(/i confirm that/i))
		await user.click(screen.getByRole("button", { name: /sign & submit/i }))
		await waitFor(() => {
			expect(screen.getByRole("alert")).toHaveTextContent(
				/network error occurred/i,
			)
		})
	})
})

// ── Step 4: Confirmation ─────────────────────────────────────────────────────

describe("Step 4: Confirmation", () => {
	async function submitAndConfirm() {
		const mockSubmit = vi.fn().mockResolvedValue({
			proposalId: "prop-456",
			source: "on-chain",
			txHash: "txhash789abc",
			daoPath: "/dao#proposal-prop-456",
		})
		mockUseScholarshipApplication.mockReturnValue(
			makeApplicationHook({ submitApplication: mockSubmit }) as any,
		)
		const user = userEvent.setup()
		renderPage()
		await fillAndNavigateToStep3(user)
		await user.click(screen.getByLabelText(/i confirm that/i))
		await user.click(screen.getByRole("button", { name: /sign & submit/i }))
		expect(
			await screen.findByRole("heading", { name: "Confirmation" }),
		).toBeInTheDocument()
		return { user, mockSubmit }
	}

	it("shows proposal ID and transaction hash after successful submission", async () => {
		await submitAndConfirm()
		expect(
			screen.getByRole("heading", { name: "Confirmation" }),
		).toBeInTheDocument()
		expect(screen.getByText("prop-456")).toBeInTheDocument()
		expect(screen.getByText("txhash789abc")).toBeInTheDocument()
	})

	it("shows 'View on DAO page' and 'Start another proposal' buttons", async () => {
		await submitAndConfirm()
		expect(
			screen.getByRole("heading", { name: "Confirmation" }),
		).toBeInTheDocument()
		expect(
			screen.getByRole("button", { name: /view on dao page/i }),
		).toBeInTheDocument()
		expect(
			screen.getByRole("button", { name: /start another proposal/i }),
		).toBeInTheDocument()
	})

	it("resets to step 0 when 'Start another proposal' is clicked", async () => {
		const { user } = await submitAndConfirm()
		await user.click(
			screen.getByRole("button", { name: /start another proposal/i }),
		)
		expect(screen.getByText("Eligibility check")).toBeInTheDocument()
	})
})
