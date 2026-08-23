import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useToast } from "../components/Toast/ToastProvider"
import { delegate } from "../util/governance-token"
import { useContractIds } from "./useContractIds"
import { useDelegation } from "./useDelegation"
import { useWallet } from "./useWallet"

vi.mock("./useWallet")
vi.mock("./useContractIds")
vi.mock("../components/Toast/ToastProvider")
vi.mock("../util/governance-token")

describe("useDelegation #1017", () => {
	const address = "G".padEnd(56, "A")
	const signTransaction = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					delegatee: null,
					is_delegating: false,
					own_balance: "0",
					delegated_to_me: "0",
					voting_power: "0",
				}),
			}),
		)
		vi.mocked(useWallet).mockReturnValue({
			address,
			signTransaction,
		} as never)
		vi.mocked(useContractIds).mockReturnValue({
			governanceToken: "C".padEnd(56, "A"),
		} as never)
		vi.mocked(useToast).mockReturnValue({
			showInfo: vi.fn(),
			showSuccess: vi.fn(),
			showError: vi.fn(),
		} as never)
		vi.mocked(delegate).mockResolvedValue("delegation-hash")
	})

	it("conecta la acción del portal con la transacción firmada", async () => {
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		})
		const wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		)
		const { result } = renderHook(() => useDelegation(), { wrapper })
		await waitFor(() => expect(result.current.isLoading).toBe(false))
		const delegatee = "G".padEnd(56, "B")

		await result.current.delegateTo(delegatee)

		expect(delegate).toHaveBeenCalledWith(
			expect.objectContaining({
				delegator: address,
				delegatee,
				signTransaction,
			}),
		)
	})
})
