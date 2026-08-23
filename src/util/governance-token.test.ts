import { Contract, nativeToScVal } from "@stellar/stellar-sdk"
import { describe, expect, it, vi } from "vitest"

import { delegate } from "./governance-token"
import { prepareAndConfirmTransaction } from "./soroban-transaction"

vi.mock("@stellar/stellar-sdk", async () => ({
	...(await vi.importActual("@stellar/stellar-sdk")),
	Contract: vi.fn(),
	nativeToScVal: vi.fn(),
}))
vi.mock("./soroban-transaction", () => ({
	prepareAndConfirmTransaction: vi.fn(),
}))

describe("delegate #1017", () => {
	it("envía una llamada Soroban firmada con delegador y delegado", async () => {
		const call = vi.fn().mockReturnValue("delegate-operation")
		vi.mocked(Contract).mockImplementation(function () {
			return { call } as never
		})
		vi.mocked(nativeToScVal).mockImplementation((value) => value as never)
		vi.mocked(prepareAndConfirmTransaction).mockResolvedValue("delegation-hash")
		const signTransaction = vi.fn()
		const delegator = "G".padEnd(56, "A")
		const delegatee = "G".padEnd(56, "B")

		const hash = await delegate({
			contractId: "C".padEnd(56, "A"),
			delegator,
			delegatee,
			networkPassphrase: "Test SDF Network ; September 2015",
			rpcUrl: "https://soroban-testnet.stellar.org",
			signTransaction,
		})

		expect(call).toHaveBeenCalledWith("delegate", delegator, delegatee)
		expect(prepareAndConfirmTransaction).toHaveBeenCalledWith(
			expect.objectContaining({
				operation: "delegate-operation",
				address: delegator,
				signTransaction,
			}),
		)
		expect(hash).toBe("delegation-hash")
	})
})
