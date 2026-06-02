import { describe, it, expect, vi } from "vitest"

describe("getFriendbotUrl", () => {
	it("returns TESTNET friendbot URL for TESTNET network", async () => {
		vi.doMock("../contracts/util", () => ({
			stellarNetwork: "TESTNET",
		}))

		const { getFriendbotUrl } = await import("./friendbot")
		const address = "GDABCDEFGHIJKLMNOPQRSTUVWXZY"
		const expected = `https://friendbot.stellar.org/?addr=${address}`
		expect(getFriendbotUrl(address)).toBe(expected)
	})

	// it("returns FUTURENET friendbot URL for FUTURENET network", async () => {
	// 	vi.doMock("../contracts/util", () => ({
	// 		stellarNetwork: "FUTURENET",
	// 	}))

	// 	const { getFriendbotUrl: getFriendbotUrlFuturenet } = await import("./friendbot")
	// 	const address = "GDABCDEFGHIJKLMNOPQRSTUVWXZY"
	// 	const expected = `https://friendbot-futurenet.stellar.org/?addr=${address}`
	// 	expect(getFriendbotUrlFuturenet(address)).toBe(expected)
	// })

	// it("returns local proxy URL for LOCAL network", async () => {
	// 	vi.doMock("../contracts/util", () => ({
	// 		stellarNetwork: "LOCAL",
	// 	}))

	// 	const { getFriendbotUrl: getFriendbotUrlLocal } = await import("./friendbot")
	// 	const address = "GDABCDEFGHIJKLMNOPQRSTUVWXZY"
	// 	const expected = `/friendbot?addr=${address}`
	// 	expect(getFriendbotUrlLocal(address)).toBe(expected)
	// })

	// it("throws error for unsupported networks", async () => {
	// 	vi.doMock("../contracts/util", () => ({
	// 		stellarNetwork: "PUBLIC",
	// 	}))

	// 	const { getFriendbotUrl: getFriendbotUrlPublic } = await import("./friendbot")
	// 	const address = "GDABCDEFGHIJKLMNOPQRSTUVWXZY"

	// 	expect(() => getFriendbotUrlPublic(address)).toThrow(
	// 		"Unknown or unsupported PUBLIC_STELLAR_NETWORK for friendbot: PUBLIC",
	// 	)
	// })
})
