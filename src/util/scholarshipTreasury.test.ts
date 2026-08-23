import { Contract, nativeToScVal } from "@stellar/stellar-sdk"
import { describe, expect, it, vi } from "vitest"

import { ScholarshipTreasury } from "./scholarshipTreasury"
import { prepareAndConfirmTransaction } from "./soroban-transaction"

vi.mock("@stellar/stellar-sdk", async () => ({
	...(await vi.importActual("@stellar/stellar-sdk")),
	Contract: vi.fn(),
	nativeToScVal: vi.fn((value) => value),
}))
vi.mock("./soroban-transaction", () => ({
	prepareAndConfirmTransaction: vi.fn(),
}))

describe("ScholarshipTreasury.deposit #1017", () => {
	it("invoca deposit con donor, USDC atómico y firma del wallet", async () => {
		const call = vi.fn().mockReturnValue("deposit-operation")
		vi.mocked(Contract).mockImplementation(function () {
			return { call } as never
		})
		vi.mocked(prepareAndConfirmTransaction).mockResolvedValue("a".repeat(64))
		const donor = "G".padEnd(56, "A")
		const usdc = "C".padEnd(56, "U")
		const signTransaction = vi.fn()

		const hash = await new ScholarshipTreasury(
			"C".padEnd(56, "T"),
			donor,
		).deposit("100", usdc, signTransaction)

		expect(call).toHaveBeenCalledWith("deposit", donor, 1_000_000_000n, usdc)
		expect(prepareAndConfirmTransaction).toHaveBeenCalledWith(
			expect.objectContaining({
				operation: "deposit-operation",
				address: donor,
				signTransaction,
			}),
		)
		expect(hash).toBe("a".repeat(64))
		expect(nativeToScVal).toHaveBeenCalledTimes(3)
	})
})
