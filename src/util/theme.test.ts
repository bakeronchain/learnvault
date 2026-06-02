import { describe, it, expect, vi, beforeEach } from "vitest"
import storage from "./storage"
import {
	getSystemTheme,
	getStoredTheme,
	resolveTheme,
	applyTheme,
	persistTheme,
} from "./theme"

// Mock storage
vi.mock("./storage", () => ({
	default: {
		getItem: vi.fn(),
		setItem: vi.fn(),
	},
}))

// Create proper DOM mocks
const mockClassList = {
	remove: vi.fn(),
	add: vi.fn(),
}

// Mock window and document
const mockMatchMedia = vi.fn()
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: mockMatchMedia,
})

Object.defineProperty(document, "documentElement", {
	writable: true,
	value: {
		classList: mockClassList,
		setAttribute: vi.fn(),
		style: {},
	},
})

Object.defineProperty(document, "body", {
	writable: true,
	value: {
		classList: mockClassList,
		setAttribute: vi.fn(),
	},
})

describe("theme utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("getSystemTheme", () => {
		it("returns dark theme when system prefers dark", () => {
			mockMatchMedia.mockReturnValue({
				matches: true,
			})
			expect(getSystemTheme()).toBe("dark")
		})

		it("returns light theme when system prefers light", () => {
			mockMatchMedia.mockReturnValue({
				matches: false,
			})
			expect(getSystemTheme()).toBe("light")
		})

		it("returns light theme when matchMedia is not available", () => {
			Object.defineProperty(window, "matchMedia", {
				writable: true,
				value: undefined,
			})
			expect(getSystemTheme()).toBe("light")
		})
	})

	describe("getStoredTheme", () => {
		it("returns stored theme when available", () => {
			vi.mocked(storage.getItem).mockReturnValue("dark")
			expect(getStoredTheme()).toBe("dark")
			expect(storage.getItem).toHaveBeenCalledWith("learnvault:theme", "safe")
		})

		it("returns null when no theme is stored", () => {
			vi.mocked(storage.getItem).mockReturnValue(null)
			expect(getStoredTheme()).toBeNull()
		})
	})

	describe("resolveTheme", () => {
		it("returns stored theme when available", () => {
			vi.mocked(storage.getItem).mockReturnValue("dark")
			expect(resolveTheme()).toBe("dark")
		})

		it("returns stored light theme when light is saved", () => {
			vi.mocked(storage.getItem).mockReturnValue("light")
			expect(resolveTheme()).toBe("light")
		})

		it("falls back to system theme when no stored value", () => {
			vi.mocked(storage.getItem).mockReturnValue(null)
			Object.defineProperty(window, "matchMedia", {
				writable: true,
				value: mockMatchMedia,
			})
			mockMatchMedia.mockReturnValue({ matches: true })
			expect(resolveTheme()).toBe("dark")
		})
	})

	describe("applyTheme", () => {
		beforeEach(() => {
			// Restore matchMedia after getSystemTheme tests may have cleared it
			Object.defineProperty(window, "matchMedia", {
				writable: true,
				value: mockMatchMedia,
			})
		})

		it("applies dark theme classes and attributes", () => {
			applyTheme("dark")

			expect(mockClassList.remove).toHaveBeenCalledWith(
				"sds-theme-light",
				"sds-theme-dark",
				"dark",
				"light",
			)
			expect(mockClassList.add).toHaveBeenCalledWith("sds-theme-dark")
			expect(mockClassList.add).toHaveBeenCalledWith("dark")
		})

		it("applies light theme classes and attributes", () => {
			applyTheme("light")

			expect(mockClassList.remove).toHaveBeenCalledWith(
				"sds-theme-light",
				"sds-theme-dark",
				"dark",
				"light",
			)
			expect(mockClassList.add).toHaveBeenCalledWith("sds-theme-light")
		})

		it("does nothing when document is undefined", () => {
			const originalDocument = global.document
			// @ts-ignore - intentionally undefined for test
			global.document = undefined

			expect(() => applyTheme("dark")).not.toThrow()

			global.document = originalDocument
		})
	})

	describe("persistTheme", () => {
		beforeEach(() => {
			Object.defineProperty(window, "matchMedia", {
				writable: true,
				value: mockMatchMedia,
			})
		})

		it("writes the theme to localStorage via storage.setItem", () => {
			persistTheme("dark")
			expect(storage.setItem).toHaveBeenCalledWith("learnvault:theme", "dark")
		})

		it("writes light theme to localStorage when toggling to light", () => {
			persistTheme("light")
			expect(storage.setItem).toHaveBeenCalledWith("learnvault:theme", "light")
		})

		it("calls applyTheme after persisting (classes are applied)", () => {
			persistTheme("dark")
			// persistTheme calls applyTheme internally; verify classList.add was called
			expect(mockClassList.add).toHaveBeenCalledWith("sds-theme-dark")
		})

		it("overrides a previously stored theme", () => {
			persistTheme("dark")
			vi.clearAllMocks()
			persistTheme("light")
			expect(storage.setItem).toHaveBeenCalledWith("learnvault:theme", "light")
			expect(mockClassList.add).toHaveBeenCalledWith("sds-theme-light")
		})
	})
})
