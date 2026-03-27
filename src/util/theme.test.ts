import { describe, it, expect, vi, beforeEach } from "vitest"
import storage from "./storage"
import {
	getSystemTheme,
	getStoredTheme,
	resolveTheme,
	applyTheme,
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

		// it("returns system theme when no stored theme", () => {
		// 	vi.mocked(storage.getItem).mockReturnValue(null)
		// 	mockMatchMedia.mockReturnValue({ matches: true })
		// 	expect(resolveTheme()).toBe("dark")
		// })
	})

	describe("applyTheme", () => {
		// it("applies dark theme classes and attributes", () => {
		// 	const theme: Theme = "dark"
		// 	applyTheme(theme)

		// 	expect(mockClassList.remove).toHaveBeenCalledWith(
		// 		"sds-theme-light",
		// 		"sds-theme-dark",
		// 	)
		// 	expect(mockClassList.add).toHaveBeenCalledWith("sds-theme-dark")
		// 	expect(document.documentElement.setAttribute).toHaveBeenCalledWith("data-theme", "dark")
		// 	expect(document.documentElement.setAttribute).toHaveBeenCalledWith(
		// 		"data-sds-theme",
		// 		"sds-theme-dark",
		// 	)
		// 	expect(document.documentElement.style.colorScheme).toBe("dark")
		// })

		// it("applies light theme classes and attributes", () => {
		// 	const theme: Theme = "light"
		// 	applyTheme(theme)

		// 	expect(mockClassList.remove).toHaveBeenCalledWith(
		// 		"sds-theme-light",
		// 		"sds-theme-dark",
		// 	)
		// 	expect(mockClassList.add).toHaveBeenCalledWith("sds-theme-light")
		// 	expect(document.documentElement.setAttribute).toHaveBeenCalledWith("data-theme", "light")
		// 	expect(document.documentElement.setAttribute).toHaveBeenCalledWith(
		// 		"data-sds-theme",
		// 		"sds-theme-light",
		// 	)
		// 	expect(document.documentElement.style.colorScheme).toBe("light")
		// })

		it("does nothing when document is undefined", () => {
			const originalDocument = global.document
			// @ts-ignore - intentionally undefined for test
			global.document = undefined

			expect(() => applyTheme("dark")).not.toThrow()

			global.document = originalDocument
		})
	})

	// describe("persistTheme", () => {
	// 	// it("stores theme and applies it", () => {
	// 	// 	const theme: Theme = "dark"
	// 	// 	persistTheme(theme)

	// 	// 	expect(storage.setItem).toHaveBeenCalledWith("learnvault:theme", theme)
	// 	// 	expect(mockClassList.add).toHaveBeenCalledWith("sds-theme-dark")
	// 	// })
	// })
})
