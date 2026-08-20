import { beforeEach, describe, expect, it, vi } from "vitest"

import { depositToTreasury, getDepositsForAddress } from "./sponsor-api"

describe("sponsor API #1017", () => {
	const address = "G".padEnd(56, "A")
	const txHash = "a".repeat(64)

	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn())
	})

	it("envía el payload exacto que audita el backend", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => ({ deposit: {}, gov_balance: "10000000" }),
		} as Response)

		await depositToTreasury({ donorAddress: address, amount: 100, txHash })

		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining("/api/treasury/deposit"),
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					donor_address: address,
					amount: 100,
					tx_hash: txHash,
				}),
			}),
		)
	})

	it("lee el historial auditado del sponsor", async () => {
		const deposits = [{ id: 1, donor_address: address, tx_hash: txHash }]
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => ({ data: deposits, pagination: {} }),
		} as Response)

		await expect(getDepositsForAddress(address)).resolves.toEqual(deposits)
		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining(`/api/treasury/deposits/${address}`),
		)
	})
})
