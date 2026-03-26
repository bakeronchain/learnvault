import { describe, it, expect, beforeEach } from "vitest"
import storage from "./storage"

beforeEach(() => {
	localStorage.clear()
})

describe("TypedStorage", () => {
	describe("setItem / getItem", () => {
		it("stores and retrieves a string value", () => {
			storage.setItem("walletId", "freighter")
			expect(storage.getItem("walletId")).toBe("freighter")
		})

		it("stores and retrieves theme values", () => {
			storage.setItem("learnvault:theme", "dark")
			expect(storage.getItem("learnvault:theme")).toBe("dark")
		})

		it("returns null for a missing key", () => {
			expect(storage.getItem("walletId")).toBeNull()
		})
	})

	describe("getItem retrieval modes", () => {
		it("throws on corrupt JSON in default/fail mode", () => {
			localStorage.setItem("walletId", "not-valid-json{")
			expect(() => storage.getItem("walletId")).toThrow()
		})

		it("returns null on corrupt JSON in safe mode", () => {
			localStorage.setItem("walletId", "not-valid-json{")
			expect(storage.getItem("walletId", "safe")).toBeNull()
		})

		it("returns raw string on corrupt JSON in raw mode", () => {
			localStorage.setItem("walletId", "not-valid-json{")
			expect(storage.getItem("walletId", "raw")).toBe("not-valid-json{")
		})

		// it("throws for invalid theme in default mode", () => {
		// 	localStorage.setItem("learnvault:theme", JSON.stringify("blue"))
		// 	expect(() => storage.getItem("learnvault:theme")).toThrow(
		// 		/Invalid theme value/,
		// 	)
		// })
	})

	describe("removeItem", () => {
		it("removes a stored key", () => {
			storage.setItem("walletAddress", "GABCD...")
			storage.removeItem("walletAddress")
			expect(storage.getItem("walletAddress")).toBeNull()
		})
	})

	describe("clear", () => {
		it("clears all stored keys", () => {
			storage.setItem("walletId", "freighter")
			storage.setItem("walletAddress", "GABCD...")
			storage.clear()
			expect(storage.getItem("walletId")).toBeNull()
			expect(storage.getItem("walletAddress")).toBeNull()
		})
	})

	describe("length", () => {
		it("reflects the number of stored items", () => {
			expect(storage).toHaveLength(0)
			storage.setItem("walletId", "freighter")
			expect(storage).toHaveLength(1)
		})
	})

	describe("key", () => {
		it("returns the key at a given index", () => {
			storage.setItem("walletId", "freighter")
			expect(storage.key(0)).toBe("walletId")
		})

		it("returns null for an out-of-bounds index", () => {
			expect(storage.key(99)).toBeNull()
		})
	})
})
