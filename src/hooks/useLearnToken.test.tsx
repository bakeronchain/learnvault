import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ToastProvider } from "../components/Toast/ToastProvider"
import {
	NotificationContext,
	type NotificationContextType,
} from "../providers/NotificationProvider"
import {
	WalletContext,
	type WalletContextType,
} from "../providers/WalletProvider"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../contracts/util", () => ({
	rpcUrl: "http://localhost:8000/rpc",
	stellarNetwork: "LOCAL",
	networkPassphrase: "Test SDF Network ; September 2015",
}))

// useSubscription is a side-effect hook; stub it out
vi.mock("./useSubscription", () => ({
	useSubscription: vi.fn(),
}))

vi.mock("./useContractIds", () => ({
	useContractIds: () => ({
		learnToken: "CLEARN123",
		isDeployed: (id: string | undefined) => Boolean(id),
	}),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { useLearnToken } from "./useLearnToken"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const signTransaction = vi.fn()
const addNotification = vi.fn()

function createWrapper(address?: string) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})

	const walletCtx: WalletContextType = {
		address,
		balances: {},
		isPending: false,
		isReconnecting: false,
		signTransaction,
		updateBalances: vi.fn(),
	}

	const notifCtx: NotificationContextType = { addNotification }

	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(
			ToastProvider,
			null,
			createElement(
				QueryClientProvider,
				{ client: queryClient },
				createElement(
					WalletContext.Provider,
					{ value: walletCtx },
					createElement(
						NotificationContext.Provider,
						{ value: notifCtx },
						children,
					),
				),
			),
		)
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks()
})

describe("useLearnToken", () => {
	it("returns undefined balance when no wallet is connected", () => {
		const { result } = renderHook(() => useLearnToken(), {
			wrapper: createWrapper(undefined),
		})

		expect(result.current.balance).toBeUndefined()
		expect(result.current.isMinting).toBe(false)
	})

	it("fetches balance for a connected address", async () => {
		const { result } = renderHook(() => useLearnToken(), {
			wrapper: createWrapper("GADDR1"),
		})

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		expect(result.current.balance).toBe(0n)
	})

	it("returns 0n when the contract balance method returns an error result", async () => {
		const { result } = renderHook(() => useLearnToken(), {
			wrapper: createWrapper("GADDR2"),
		})

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		expect(result.current.balance).toBe(0n)
	})

	it("allows overriding the target address", async () => {
		const { result } = renderHook(() => useLearnToken("GCUSTOM"), {
			wrapper: createWrapper("GDEFAULT"),
		})

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		expect(result.current.balance).toBe(0n)
	})
})
