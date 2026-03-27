import { renderHook } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { describe, it, expect, vi } from "vitest"
import {
	WalletContext,
	type WalletContextType,
} from "../providers/WalletProvider"
import { useWallet } from "./useWallet"

const signTransaction = vi.fn()

function createWrapper(value: WalletContextType) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(WalletContext.Provider, { value }, children)
	}
}

const baseCtx: WalletContextType = {
	address: undefined,
	balances: {},
	isPending: false,
	isReconnecting: false,
	signTransaction,
	updateBalances: vi.fn(),
}

describe("useWallet", () => {
	it("returns context when inside a WalletProvider", () => {
		const ctx: WalletContextType = {
			...baseCtx,
			address: "GTEST1234",
			balances: {
				xlm: { balance: "100", asset_type: "native" } as any,
			},
		}

		const { result } = renderHook(() => useWallet(), {
			wrapper: createWrapper(ctx),
		})

		expect(result.current.address).toBe("GTEST1234")
		expect(result.current.balances).toHaveProperty("xlm")
		expect(result.current.isPending).toBe(false)
	})

	it("returns undefined address when no wallet is connected", () => {
		const { result } = renderHook(() => useWallet(), {
			wrapper: createWrapper(baseCtx),
		})

		expect(result.current.address).toBeUndefined()
		expect(result.current.balances).toEqual({})
	})

	it("exposes updateBalances from context", () => {
		const updateBalances = vi.fn()
		const ctx: WalletContextType = { ...baseCtx, updateBalances }

		const { result } = renderHook(() => useWallet(), {
			wrapper: createWrapper(ctx),
		})

		void result.current.updateBalances()
		expect(updateBalances).toHaveBeenCalled()
	})

	it("exposes network info from context", () => {
		const ctx: WalletContextType = {
			...baseCtx,
			network: "TESTNET",
			networkPassphrase: "Test SDF Network ; September 2015",
		}

		const { result } = renderHook(() => useWallet(), {
			wrapper: createWrapper(ctx),
		})

		expect(result.current.network).toBe("TESTNET")
		expect(result.current.networkPassphrase).toBe(
			"Test SDF Network ; September 2015",
		)
	})

	it("exposes isReconnecting state from context", () => {
		const ctx: WalletContextType = {
			...baseCtx,
			isReconnecting: true,
		}

		const { result } = renderHook(() => useWallet(), {
			wrapper: createWrapper(ctx),
		})

		expect(result.current.isReconnecting).toBe(true)
	})
})
