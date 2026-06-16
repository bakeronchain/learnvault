import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { useWallet } from "../hooks/useWallet"
import { render, screen } from "../test/setup"

const { walletState } = vi.hoisted(() => {
	const walletState = { address: undefined as string | undefined }
	return { walletState }
})

vi.mock("../hooks/useWallet", () => ({
	useWallet: vi.fn(),
}))

vi.mock("../hooks/useCourses", () => ({
	fetchCourses: vi.fn(),
}))

vi.mock("../hooks/useLeaderboard", () => ({
	fetchLeaderboard: vi.fn(),
}))

vi.mock("../hooks/useProposals", () => ({
	fetchProposals: vi.fn(),
}))

vi.mock("../hooks/useTreasury", () => ({
	fetchTreasuryStats: vi.fn(),
	fetchTreasuryActivityPage: vi.fn(),
}))

vi.mock("../pages/History", () => ({
	fetchHistory: vi.fn(),
}))

vi.mock("../util/auth", () => ({
	getAuthToken: vi.fn(() => null),
}))

vi.mock("./GlobalSearch", () => ({
	default: () => <div data-testid="global-search" />,
}))

vi.mock("./LanguageSelector", () => ({
	LanguageSelector: () => <div data-testid="language-selector" />,
}))

vi.mock("./NetworkIndicator", () => ({
	default: ({ showLabel }: { showLabel?: boolean }) => (
		<div data-testid="network-indicator">{showLabel ? "Testnet" : ""}</div>
	),
}))

vi.mock("./ReputationBadge", () => ({
	ReputationBadge: ({ className }: { className?: string }) => (
		<div data-testid="reputation-badge" className={className}>
			Gold Scholar
		</div>
	),
}))

vi.mock("./NotificationBell", () => ({
	NotificationBell: () => <div data-testid="notification-bell" />,
}))

vi.mock("./ThemeToggle", () => ({
	ThemeToggle: () => (
		<button data-testid="theme-toggle" aria-label="Toggle theme">
			Toggle
		</button>
	),
}))

vi.mock("./WalletButton", () => ({
	WalletButton: () => {
		if (walletState.address) {
			return (
				<div data-testid="wallet-button-connected">
					<span>{walletState.address.slice(0, 6)}...</span>
				</div>
			)
		}
		return <button id="connect-wallet-button">Connect Wallet</button>
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const map: Record<string, string> = {
				"nav.learn": "Learn",
				"nav.dao": "DAO",
				"nav.leaderboard": "Leaderboard",
				"nav.docs": "Docs",
				"nav.treasury": "Treasury",
				"wallet.connect": "Connect Wallet",
				"wallet.loading": "Loading...",
			}
			return map[key] ?? key
		},
		i18n: { changeLanguage: vi.fn() },
	}),
}))

import NavBar from "./NavBar"

const mockWallet = (address?: string) => ({
	address,
	balances: address
		? { xlm: { balance: "100.0000000", asset_type: "native" } }
		: {},
	isPending: false,
	isReconnecting: false,
	network: "TESTNET",
	networkPassphrase: "Test SDF Network ; September 2015",
	signTransaction: vi.fn(),
	updateBalances: vi.fn(),
})

const CONNECTED_ADDRESS = "GTEST1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO"

beforeEach(() => {
	walletState.address = undefined
	vi.mocked(useWallet).mockReturnValue(mockWallet() as any)
})

describe("NavBar component", () => {
	it("renders navigation links", () => {
		render(
			<MemoryRouter>
				<NavBar />
			</MemoryRouter>,
		)

		expect(
			screen.getAllByRole("link", { name: /learn/i }).length,
		).toBeGreaterThan(0)
		expect(
			screen.getAllByRole("link", { name: /dao/i }).length,
		).toBeGreaterThan(0)
		expect(
			screen.getAllByRole("link", { name: /leaderboard/i }).length,
		).toBeGreaterThan(0)
		expect(
			screen.getAllByRole("link", { name: /treasury/i }).length,
		).toBeGreaterThan(0)
	})

	it("highlights active link with brand-cyan class", async () => {
		render(
			<MemoryRouter initialEntries={["/courses"]}>
				<NavBar />
			</MemoryRouter>,
		)

		const activeLinks = document.querySelectorAll("a.text-brand-cyan")
		expect(activeLinks.length).toBeGreaterThan(0)
	})

	it("shows Connect Wallet button when wallet is not connected", () => {
		vi.mocked(useWallet).mockReturnValue(mockWallet() as any)

		render(
			<MemoryRouter>
				<NavBar />
			</MemoryRouter>,
		)

		const connectButtons = screen.getAllByRole("button", {
			name: /connect wallet/i,
		})
		expect(connectButtons.length).toBeGreaterThan(0)
	})

	it("shows wallet address when wallet is connected", () => {
		walletState.address = CONNECTED_ADDRESS
		vi.mocked(useWallet).mockReturnValue(mockWallet(CONNECTED_ADDRESS) as any)

		render(
			<MemoryRouter>
				<NavBar />
			</MemoryRouter>,
		)

		const connectedButtons = screen.getAllByTestId("wallet-button-connected")
		expect(connectedButtons.length).toBeGreaterThan(0)
		expect(screen.getAllByText(/GTEST1/).length).toBeGreaterThan(0)
	})

	it("toggles mobile hamburger menu on click", async () => {
		render(
			<MemoryRouter>
				<NavBar />
			</MemoryRouter>,
		)

		const menuButton = screen.getByRole("button", {
			name: /open navigation menu/i,
		})
		expect(menuButton).toHaveAttribute("aria-expanded", "false")

		await userEvent.click(menuButton)
		expect(menuButton).toHaveAttribute("aria-expanded", "true")
	})

	it("closes mobile menu when close button is clicked", async () => {
		render(
			<MemoryRouter>
				<NavBar />
			</MemoryRouter>,
		)

		const openButton = screen.getByRole("button", {
			name: /open navigation menu/i,
		})
		await userEvent.click(openButton)
		expect(openButton).toHaveAttribute("aria-expanded", "true")

		const closeButton = screen.getByRole("button", {
			name: /close mobile navigation menu/i,
		})
		await userEvent.click(closeButton)
		expect(openButton).toHaveAttribute("aria-expanded", "false")
	})

	it("closes mobile menu on Escape key", async () => {
		render(
			<MemoryRouter>
				<NavBar />
			</MemoryRouter>,
		)

		const menuButton = screen.getByRole("button", {
			name: /open navigation menu/i,
		})
		await userEvent.click(menuButton)
		expect(menuButton).toHaveAttribute("aria-expanded", "true")

		await userEvent.keyboard("{Escape}")
		expect(menuButton).toHaveAttribute("aria-expanded", "false")
	})

	it("renders theme toggle button", () => {
		render(
			<MemoryRouter>
				<NavBar />
			</MemoryRouter>,
		)

		expect(screen.getByTestId("theme-toggle")).toBeInTheDocument()
	})

	it("renders LearnVault home link", () => {
		render(
			<MemoryRouter>
				<NavBar />
			</MemoryRouter>,
		)

		expect(
			screen.getByRole("link", { name: /learnvault home/i }),
		).toBeInTheDocument()
	})

	it("renders notification bell", () => {
		render(
			<MemoryRouter>
				<NavBar />
			</MemoryRouter>,
		)

		expect(screen.getByTestId("notification-bell")).toBeInTheDocument()
	})

	it("renders primary navigation with correct aria label", () => {
		render(
			<MemoryRouter>
				<NavBar />
			</MemoryRouter>,
		)

		const navs = screen.getAllByRole("navigation", { name: /primary/i })
		expect(navs.length).toBeGreaterThan(0)
	})

	it("mobile menu slides in when opened", async () => {
		render(
			<MemoryRouter>
				<NavBar />
			</MemoryRouter>,
		)

		const mobileNav = screen.getByRole("navigation", {
			name: /mobile primary/i,
		})
		expect(mobileNav).toHaveClass("translate-x-full")

		const menuButton = screen.getByRole("button", {
			name: /open navigation menu/i,
		})
		await userEvent.click(menuButton)

		expect(mobileNav).toHaveClass("translate-x-0")
	})
})
