import { createElement, type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { WalletContext } from "../providers/WalletProvider"
import { render, screen } from "../test/setup"
import ConnectWalletGuard from "./ConnectWalletGuard"

vi.mock("../hooks/useWallet", () => ({
	useWallet: vi.fn(),
}))

vi.mock("./ConnectAccount", () => ({
	default: () => <button>Connect Wallet</button>,
}))

vi.mock("@stellar/design-system", () => ({
	Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	Button: ({
		children,
		onClick,
	}: {
		children: ReactNode
		onClick?: () => void
	}) => <button onClick={onClick}>{children}</button>,
}))

import { useWallet } from "../hooks/useWallet"

const mockWallet = (address?: string) => ({
	address,
	balances: {},
	isPending: false,
	isReconnecting: false,
	network: "TESTNET",
	networkPassphrase: "Test SDF Network ; September 2015",
	signTransaction: vi.fn(),
	updateBalances: vi.fn(),
})

describe("ConnectWalletGuard", () => {
	it("shows connect prompt when no wallet is connected", () => {
		vi.mocked(useWallet).mockReturnValue(mockWallet() as any)

		render(
			<ConnectWalletGuard>
				<div>Protected Content</div>
			</ConnectWalletGuard>,
		)

		expect(
			screen.getByText(/connect your wallet to continue/i),
		).toBeInTheDocument()
		expect(screen.queryByText("Protected Content")).not.toBeInTheDocument()
	})

	it("renders children when wallet is connected", () => {
		vi.mocked(useWallet).mockReturnValue(
			mockWallet("GTEST1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO") as any,
		)

		render(
			<ConnectWalletGuard>
				<div>Protected Content</div>
			</ConnectWalletGuard>,
		)

		expect(screen.getByText("Protected Content")).toBeInTheDocument()
		expect(
			screen.queryByText(/connect your wallet to continue/i),
		).not.toBeInTheDocument()
	})

	it("shows ConnectAccount button when unauthenticated", () => {
		vi.mocked(useWallet).mockReturnValue(mockWallet() as any)

		render(
			<ConnectWalletGuard>
				<div>Protected Content</div>
			</ConnectWalletGuard>,
		)

		expect(
			screen.getByRole("button", { name: /connect wallet/i }),
		).toBeInTheDocument()
	})

	it("shows informational message about Stellar wallet requirement", () => {
		vi.mocked(useWallet).mockReturnValue(mockWallet() as any)

		render(
			<ConnectWalletGuard>
				<div>Protected Content</div>
			</ConnectWalletGuard>,
		)

		expect(screen.getByText(/stellar wallet/i)).toBeInTheDocument()
	})

	it("re-activates guard when wallet is disconnected mid-session", () => {
		const { rerender } = render(
			<ConnectWalletGuard>
				<div>Protected Content</div>
			</ConnectWalletGuard>,
		)

		// Start with connected wallet
		vi.mocked(useWallet).mockReturnValue(
			mockWallet("GTEST1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO") as any,
		)
		rerender(
			<ConnectWalletGuard>
				<div>Protected Content</div>
			</ConnectWalletGuard>,
		)
		expect(screen.getByText("Protected Content")).toBeInTheDocument()

		// Disconnect wallet
		vi.mocked(useWallet).mockReturnValue(mockWallet() as any)
		rerender(
			<ConnectWalletGuard>
				<div>Protected Content</div>
			</ConnectWalletGuard>,
		)

		expect(screen.queryByText("Protected Content")).not.toBeInTheDocument()
		expect(
			screen.getByText(/connect your wallet to continue/i),
		).toBeInTheDocument()
	})

	it("uses WalletContext address when rendered inside WalletProvider", () => {
		const WALLET_ADDRESS = "GTEST1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO"
		vi.mocked(useWallet).mockReturnValue(mockWallet(WALLET_ADDRESS) as any)

		render(
			createElement(
				WalletContext.Provider,
				{
					value: {
						address: WALLET_ADDRESS,
						balances: {},
						isPending: false,
						isReconnecting: false,
						signTransaction: vi.fn(),
						updateBalances: vi.fn(),
					},
				},
				createElement(
					ConnectWalletGuard,
					null,
					createElement("div", null, "Protected Content"),
				),
			),
		)

		expect(screen.getByText("Protected Content")).toBeInTheDocument()
	})

	it("renders multiple children when wallet is connected", () => {
		vi.mocked(useWallet).mockReturnValue(
			mockWallet("GTEST1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO") as any,
		)

		render(
			<ConnectWalletGuard>
				<div>Child One</div>
				<div>Child Two</div>
			</ConnectWalletGuard>,
		)

		expect(screen.getByText("Child One")).toBeInTheDocument()
		expect(screen.getByText("Child Two")).toBeInTheDocument()
	})
})
