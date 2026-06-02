import { describe, expect, it } from "vitest"
import { getCategoryConfig } from "./CourseCategoryBadge"

describe("getCategoryConfig", () => {
	it("returns the correct config for web3", () => {
		expect(getCategoryConfig("web3")).toMatchInlineSnapshot(`
			{
			  "className": "bg-brand-cyan/15 text-brand-cyan border-brand-cyan/30",
			  "label": "Web3",
			}
		`)
	})

	it("returns the correct config for frontend", () => {
		expect(getCategoryConfig("frontend")).toMatchInlineSnapshot(`
			{
			  "className": "bg-blue-500/15 text-blue-400 border-blue-500/30",
			  "label": "Frontend",
			}
		`)
	})

	it("returns the correct config for backend", () => {
		expect(getCategoryConfig("backend")).toMatchInlineSnapshot(`
			{
			  "className": "bg-brand-purple/15 text-brand-purple border-brand-purple/30",
			  "label": "Backend",
			}
		`)
	})

	it("returns the correct config for smart-contract", () => {
		expect(getCategoryConfig("smart-contract")).toMatchInlineSnapshot(`
			{
			  "className": "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
			  "label": "Smart Contract",
			}
		`)
	})

	it("returns the correct config for design", () => {
		expect(getCategoryConfig("design")).toMatchInlineSnapshot(`
			{
			  "className": "bg-pink-500/15 text-pink-400 border-pink-500/30",
			  "label": "Design",
			}
		`)
	})

	it("normalises mixed-case and spaced category names", () => {
		expect(getCategoryConfig("Smart Contracts").label).toBe("Smart Contracts")
		expect(getCategoryConfig("Web3").label).toBe("Web3")
		expect(getCategoryConfig("DeFi").label).toBe("DeFi")
	})

	it("returns a fallback config with the raw label for unknown categories", () => {
		const result = getCategoryConfig("unknown-track")
		expect(result.label).toBe("unknown-track")
		expect(result.className).toBe("bg-white/10 text-white/60 border-white/20")
	})

	it("maps difficulty values used by CourseCard", () => {
		expect(getCategoryConfig("beginner").label).toBe("Beginner")
		expect(getCategoryConfig("intermediate").label).toBe("Intermediate")
		expect(getCategoryConfig("advanced").label).toBe("Advanced")
	})
})
