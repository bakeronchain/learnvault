import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BrowserRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useDelegation } from "../hooks/useDelegation"
import { useProposals } from "../hooks/useProposals"
import { useSponsorDeposit } from "../hooks/useSponsorDeposit"
import { useUSDC } from "../hooks/useUSDC"
import { useWallet } from "../hooks/useWallet"
import { getDepositsForAddress } from "../services/sponsor-api"
import SponsorPortal from "./SponsorPortal"

vi.mock("../hooks/useDelegation")
vi.mock("../hooks/useProposals")
vi.mock("../hooks/useSponsorDeposit")
vi.mock("../hooks/useUSDC")
vi.mock("../hooks/useWallet")
vi.mock("../services/sponsor-api")
vi.mock("../components/ConnectAccount", () => ({
	default: () => <button type="button">Connect Freighter</button>,
}))
vi.mock("../components/PasskeySignup", () => ({
	default: () => null,
}))

const ADDRESS = "G".padEnd(56, "A")

const renderPortal = () => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})
	return render(
		<BrowserRouter>
			<QueryClientProvider client={queryClient}>
				<SponsorPortal />
			</QueryClientProvider>
		</BrowserRouter>,
	)
}

describe("SponsorPortal #1017", () => {
	const deposit = vi.fn()
	const delegateTo = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(useWallet).mockReturnValue({ address: ADDRESS } as never)
		vi.mocked(useUSDC).mockReturnValue({
			rawBalance: 250_5000000n,
			balance: 250.5,
			isConfigured: true,
			isLoading: false,
			dataUpdatedAt: Date.now(),
		})
		vi.mocked(useProposals).mockReturnValue({
			votingPower: 20_0000000n,
			proposals: [
				{ id: 7, title: "Fund Stellar course", isVotingOpen: true },
				{ id: 8, title: "Closed proposal", isVotingOpen: false },
			],
			isLoading: false,
		} as never)
		vi.mocked(useSponsorDeposit).mockReturnValue({
			deposit,
			isDepositing: false,
		})
		vi.mocked(useDelegation).mockReturnValue({
			delegateTo,
			isUpdating: false,
			delegatee: null,
		} as never)
		vi.mocked(getDepositsForAddress).mockResolvedValue([
			{
				id: 1,
				donor_address: ADDRESS,
				amount_usdc: "100.0000000",
				gov_issued: "10000.0000000",
				tx_hash: "a".repeat(64),
				deposited_at: "2026-08-20T10:00:00Z",
			},
		])
	})

	it("muestra datos reales y permite depositar y delegar", async () => {
		const user = userEvent.setup()
		renderPortal()

		expect(screen.getByText("250.5 USDC")).toBeInTheDocument()
		expect(screen.getByText("20 GOV")).toBeInTheDocument()
		expect(
			screen.getByRole("link", { name: "Fund Stellar course" }),
		).toHaveAttribute("href", "/dao/proposals?proposal=7")
		expect(
			screen.queryByRole("link", { name: "Closed proposal" }),
		).not.toBeInTheDocument()

		await user.type(screen.getByLabelText("USDC amount"), "100")
		await user.click(screen.getByRole("button", { name: "Deposit USDC" }))
		expect(deposit).toHaveBeenCalledWith("100")

		await user.type(screen.getByLabelText("Delegate address"), "GDELEGATE")
		await user.click(screen.getByRole("button", { name: "Delegate power" }))
		expect(delegateTo).toHaveBeenCalledWith("GDELEGATE")

		await waitFor(() => {
			expect(screen.getByText("100.0000000 USDC")).toBeInTheDocument()
		})
	})

	it("solicita conectar Freighter si no hay wallet", () => {
		vi.mocked(useWallet).mockReturnValue({ address: undefined } as never)
		renderPortal()

		expect(
			screen.getByRole("button", { name: "Connect Freighter" }),
		).toBeInTheDocument()
		expect(screen.queryByLabelText("USDC amount")).not.toBeInTheDocument()
	})
})
