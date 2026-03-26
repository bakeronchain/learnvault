import { describe, expect, it } from "vitest"
import { formatLRN, formatUSDC, parseLRN, parseUSDC } from "./tokenFormat"

describe("formatLRN", () => {
	it("formats zero", () => {
		expect(formatLRN(0n)).toBe("0.0000000")
	})

	it("formats a typical balance", () => {
		expect(formatLRN(14200000000n)).toBe("1,420.0000000")
	})

	it("formats a fractional-only value", () => {
		expect(formatLRN(500n)).toBe("0.0000500")
	})

	it("formats negative values", () => {
		expect(formatLRN(-10000000n)).toBe("-1.0000000")
	})

	it("formats with custom decimals", () => {
		expect(formatLRN(1500n, 2)).toBe("15.00")
	})
})

describe("formatUSDC", () => {
	it("formats a whole-number USDC amount", () => {
		expect(formatUSDC(100000000n)).toBe("10.0000000")
	})
})

describe("parseLRN", () => {
	it("parses a formatted string back to stroops", () => {
		expect(parseLRN("1,420.0000000")).toBe(14200000000n)
	})

	it("parses a whole number without decimals", () => {
		expect(parseLRN("100")).toBe(1000000000n)
	})

	it("parses zero", () => {
		expect(parseLRN("0")).toBe(0n)
	})

	it("parses empty string as zero", () => {
		expect(parseLRN("")).toBe(0n)
	})

	it("parses negative values", () => {
		expect(parseLRN("-1.0000000")).toBe(-10000000n)
	})

	it("truncates excess decimal places", () => {
		expect(parseLRN("1.00000009")).toBe(10000000n)
	})
})

describe("parseUSDC", () => {
	it("parses a USDC display string", () => {
		expect(parseUSDC("10.0000000")).toBe(100000000n)
	})
})

describe("roundtrip", () => {
	it("format then parse returns original value", () => {
		const original = 14200000000n
		expect(parseLRN(formatLRN(original))).toBe(original)
	})

	it("roundtrips zero", () => {
		expect(parseLRN(formatLRN(0n))).toBe(0n)
	})
})
