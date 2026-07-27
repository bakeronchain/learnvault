/**
 * Unit tests for the streak-bonus mint guard rails in learn-token.service.
 * The happy-path on-chain call is exercised indirectly via the streak
 * service tests (which mock this module); here we only verify the
 * validation this function is responsible for.
 */

jest.mock("../lib/rpc-cache", () => ({
	getRpcCache: () => ({
		get: jest.fn().mockResolvedValue(null),
		set: jest.fn().mockResolvedValue(undefined),
	}),
	CacheKey: { learnBalance: (address: string) => `learn-balance:${address}` },
	TTL: { BALANCE: 60 },
}))

import { mintLearnTokenBonus } from "../services/learn-token.service"

describe("mintLearnTokenBonus", () => {
	const originalSecretKey = process.env.STELLAR_SECRET_KEY
	const originalContractId = process.env.LEARN_TOKEN_CONTRACT_ID

	afterEach(() => {
		process.env.STELLAR_SECRET_KEY = originalSecretKey
		process.env.LEARN_TOKEN_CONTRACT_ID = originalContractId
	})

	it("rejects a non-positive amount before touching Soroban", async () => {
		await expect(mintLearnTokenBonus("GLEARNER1", 0n)).rejects.toThrow(
			"Mint amount must be positive",
		)
		await expect(mintLearnTokenBonus("GLEARNER1", -1n)).rejects.toThrow(
			"Mint amount must be positive",
		)
	})

	it("fails clearly when Stellar credentials are not configured", async () => {
		delete process.env.STELLAR_SECRET_KEY
		delete process.env.LEARN_TOKEN_CONTRACT_ID

		await expect(mintLearnTokenBonus("GLEARNER1", 50_000_000n)).rejects.toThrow(
			/not configured/,
		)
	})
})
