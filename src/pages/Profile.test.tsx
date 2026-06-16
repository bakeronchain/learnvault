import { createElement, type ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { useScholarProfile } from "../hooks/useScholarProfile"
import { useWallet } from "../hooks/useWallet"
import { WalletContext } from "../providers/WalletProvider"
import { render, screen, waitFor } from "../test/setup"

vi.mock("../hooks/useScholarProfile", () => ({
	useScholarProfile: vi.fn(),
}))

vi.mock("../hooks/useLearnerProfile", () => ({
	useLearnerProfile: vi.fn(),
}))

vi.mock("../hooks/useScholarCredentials", () => ({
	useScholarCredentials: vi.fn(),
}))

vi.mock("../hooks/useWallet", () => ({
	useWallet: vi.fn(),
}))

vi.mock("../components/ReputationBadge", () => ({
	ReputationBadge: ({ showBalance }: { showBalance?: boolean }) => (
		<div data-testid="reputation-badge">
			<span>Gold Scholar</span>
			{showBalance && <span>1,000 LRN</span>}
		</div>
	),
}))

vi.mock("../components/ActivityFeed", () => ({
	ActivityFeed: ({ address }: { address?: string }) => (
		<div data-testid="activity-feed" data-address={address}>
			Activity History
		</div>
	),
}))

vi.mock("../components/LRNHistoryChart", () => ({
	default: () => <div data-testid="lrn-history-chart" />,
}))

vi.mock("../components/AddressDisplay", () => ({
	default: ({ address }: { address: string }) => (
		<div data-testid="address-display">
			<span>
				{address.slice(0, 6)}...{address.slice(-4)}
			</span>
			<button aria-label="Copy address">Copy</button>
		</div>
	),
}))

vi.mock("../components/FollowButton", () => ({
	FollowButton: () => <button>Follow</button>,
}))

vi.mock("../components/ProfileEditForm", () => ({
	default: () => <div data-testid="profile-edit-form" />,
}))

vi.mock("../components/ProfileLinkedWallets", () => ({
	ProfileLinkedWallets: () => null,
}))

vi.mock("../components/IdenticonAvatar", () => ({
	default: ({ address }: { address: string }) => (
		<div data-testid="identicon-avatar" data-address={address} />
	),
}))

vi.mock("../components/SkeletonLoader", () => ({
	ProfileSkeleton: () => <div data-testid="profile-skeleton" />,
	NoCredentialsEmptyState: () => (
		<div data-testid="no-credentials">No credentials yet</div>
	),
}))

vi.mock("../components/states/errorState", () => ({
	ErrorState: ({ message }: { message?: string }) => (
		<div data-testid="error-state">{message}</div>
	),
}))

vi.mock("react-helmet", () => ({
	Helmet: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("../util/learningTime", () => ({
	getLearningTimeSummary: vi.fn(() => ({ totalSeconds: 3600 })),
	formatDuration: vi.fn(() => "1h"),
}))

vi.mock("../util/scholarshipApplications", () => ({
	shortenAddress: (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`,
}))

import Profile from "./Profile"

const CONNECTED_ADDRESS = "GTEST1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO"

const mockWalletContext = (address?: string) => ({
	address,
	balances: {},
	isPending: false,
	isReconnecting: false,
	network: "TESTNET",
	networkPassphrase: "Test SDF Network ; September 2015",
	signTransaction: vi.fn(),
	updateBalances: vi.fn(),
})

function makeWrapper(walletAddress?: string) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(
			WalletContext.Provider,
			{ value: mockWalletContext(walletAddress) as any },
			createElement(MemoryRouter, {}, children),
		)
	}
}

const defaultScholarProfile = {
	address: CONNECTED_ADDRESS,
	lrn_balance: "1000",
	enrolled_courses: 3,
	completed_milestones: 5,
	pending_milestones: 1,
	credentials: [],
	joined_at: "2024-01-01",
	follower_count: 10,
	following_count: 5,
	is_following: false,
}

beforeEach(() => {
	vi.mocked(useWallet).mockReturnValue(
		mockWalletContext(CONNECTED_ADDRESS) as any,
	)
	vi.mocked(useScholarProfile).mockReturnValue({
		data: defaultScholarProfile,
		isLoading: false,
		error: null,
	} as any)

	global.fetch = vi.fn().mockImplementation((url: string) => {
		if (url.includes("/api/credentials/")) {
			return Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						data: [
							{
								token_id: "1",
								course_id: "intro-blockchain",
								minted_at: "2024-03-01T00:00:00Z",
								metadata_uri: null,
							},
						],
					}),
			})
		}
		if (url.includes("/api/profile/")) {
			return Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						profile: {
							id: "1",
							stellarAddress: CONNECTED_ADDRESS,
							displayName: "Test Learner",
							bio: "Learning blockchain",
							avatarUrl: null,
							avatarCid: null,
							socialLinks: {},
							reputationRank: 5,
							createdAt: "2024-01-01",
							updatedAt: "2024-01-01",
						},
						stats: {
							lrnBalance: 1000,
							coursesCompleted: 3,
							reputationRank: 5,
							percentile: 10,
						},
					}),
			})
		}
		return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
	}) as any
})

describe("Profile page", () => {
	it("shows skeleton while loading", () => {
		vi.mocked(useScholarProfile).mockReturnValue({
			data: undefined,
			isLoading: true,
			error: null,
		} as any)

		render(<Profile />, { wrapper: makeWrapper(CONNECTED_ADDRESS) })

		expect(screen.getByTestId("profile-skeleton")).toBeInTheDocument()
	})

	it("shows error state on profile fetch failure", async () => {
		vi.mocked(useScholarProfile).mockReturnValue({
			data: undefined,
			isLoading: false,
			error: new Error("Network error"),
		} as any)

		render(<Profile />, { wrapper: makeWrapper(CONNECTED_ADDRESS) })

		await waitFor(() => {
			expect(screen.getByTestId("error-state")).toBeInTheDocument()
		})
	})

	it("displays address with copy button", async () => {
		render(<Profile />, { wrapper: makeWrapper(CONNECTED_ADDRESS) })

		await waitFor(() => {
			expect(screen.getByTestId("address-display")).toBeInTheDocument()
			expect(
				screen.getByRole("button", { name: /copy address/i }),
			).toBeInTheDocument()
		})
	})

	it("displays LRN balance from stats", async () => {
		render(<Profile />, { wrapper: makeWrapper(CONNECTED_ADDRESS) })

		await waitFor(() => {
			expect(screen.getByText(/1,000/)).toBeInTheDocument()
		})
	})

	it("displays reputation rank badge", async () => {
		render(<Profile />, { wrapper: makeWrapper(CONNECTED_ADDRESS) })

		await waitFor(() => {
			expect(screen.getByTestId("reputation-badge")).toBeInTheDocument()
		})
	})

	it("displays Scholar NFTs when credentials are returned", async () => {
		render(<Profile />, { wrapper: makeWrapper(CONNECTED_ADDRESS) })

		await waitFor(() => {
			expect(screen.getByText("intro-blockchain")).toBeInTheDocument()
		})
	})

	it("shows empty state when no credentials", async () => {
		global.fetch = vi.fn().mockImplementation((url: string) => {
			if (url.includes("/api/credentials/")) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ data: [] }),
				})
			}
			return Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						profile: null,
						stats: {
							lrnBalance: 0,
							coursesCompleted: 0,
							reputationRank: null,
							percentile: 0,
						},
					}),
			})
		}) as any

		render(<Profile />, { wrapper: makeWrapper(CONNECTED_ADDRESS) })

		await waitFor(() => {
			expect(screen.getByTestId("no-credentials")).toBeInTheDocument()
		})
	})

	it("shows activity history section", async () => {
		render(<Profile />, { wrapper: makeWrapper(CONNECTED_ADDRESS) })

		await waitFor(() => {
			expect(screen.getByTestId("activity-feed")).toBeInTheDocument()
		})
	})

	it("shows Edit Profile button on own profile (own wallet connected)", async () => {
		render(<Profile />, { wrapper: makeWrapper(CONNECTED_ADDRESS) })

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: /edit profile/i }),
			).toBeInTheDocument()
		})
	})

	it("shows Follow button when viewing another user's profile", async () => {
		const OTHER_ADDRESS = "GOTHERWALLET1234567890ABCDEFGHIJKLMN9876543210ZYX"

		// Profile uses window.location.pathname to determine viewAddress (not useParams)
		const originalPathname = window.location.pathname
		Object.defineProperty(window, "location", {
			value: { ...window.location, pathname: `/profile/${OTHER_ADDRESS}` },
			writable: true,
			configurable: true,
		})

		vi.mocked(useScholarProfile).mockReturnValue({
			data: { ...defaultScholarProfile, address: OTHER_ADDRESS },
			isLoading: false,
			error: null,
		} as any)

		render(
			<MemoryRouter initialEntries={[`/profile/${OTHER_ADDRESS}`]}>
				<Routes>
					<Route
						path="/profile/:walletAddress"
						element={
							<WalletContext.Provider
								value={mockWalletContext(CONNECTED_ADDRESS) as any}
							>
								<Profile />
							</WalletContext.Provider>
						}
					/>
				</Routes>
			</MemoryRouter>,
		)

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: /follow/i }),
			).toBeInTheDocument()
		})

		Object.defineProperty(window, "location", {
			value: { ...window.location, pathname: originalPathname },
			writable: true,
			configurable: true,
		})
	})

	it("does not show Edit Profile button when viewing another user's profile", async () => {
		const OTHER_ADDRESS = "GOTHERWALLET1234567890ABCDEFGHIJKLMN9876543210ZYX"

		render(
			<MemoryRouter initialEntries={[`/profile/${OTHER_ADDRESS}`]}>
				<Routes>
					<Route
						path="/profile/:walletAddress"
						element={
							<WalletContext.Provider
								value={mockWalletContext(CONNECTED_ADDRESS) as any}
							>
								<Profile />
							</WalletContext.Provider>
						}
					/>
				</Routes>
			</MemoryRouter>,
		)

		await waitFor(() => {
			expect(
				screen.queryByRole("button", { name: /edit profile/i }),
			).not.toBeInTheDocument()
		})
	})
})
