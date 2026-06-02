import { describe, it, expect } from "vitest"
import { shortenContractId } from "./contract"

describe("shortenContractId", () => {
	it("shortens a long contract ID with default lengths", () => {
		const id = "C1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA"
		// Default: first 5, ellipsis, last 4
		expect(shortenContractId(id)).toBe("C1234…DCBA")
	})

	it("returns short IDs unchanged when <= prefix + suffix", () => {
		expect(shortenContractId("ABCDEFGHI")).toBe("ABCDEFGHI") // 9 chars = 5 + 4
		expect(shortenContractId("ABCD")).toBe("ABCD")
	})

	it("returns an empty string unchanged", () => {
		expect(shortenContractId("")).toBe("")
	})

	it("accepts custom prefix and suffix lengths", () => {
		const id = "CABC1234567890XYZEND"
		expect(shortenContractId(id, 3, 3)).toBe("CAB…END")
	})

	it("uses the ellipsis character (…), not three dots", () => {
		const id = "CABC1234567890XYZEND"
		const result = shortenContractId(id)
		expect(result).toContain("…")
		expect(result).not.toContain("...")
	})

	it("handles IDs exactly at the boundary (prefix + suffix + 1)", () => {
		// 10 chars, prefix=5 suffix=4 → should shorten (10 > 9)
		expect(shortenContractId("ABCDEFGHIJ")).toBe("ABCDE…GHIJ")
	})
})
