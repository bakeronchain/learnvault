import { renderHook, act, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../util/theme", () => ({
	resolveTheme: vi.fn(),
	persistTheme: vi.fn(),
	applyTheme: vi.fn(),
}))

import { useTheme } from "./useTheme"
import { applyTheme, persistTheme, resolveTheme } from "../util/theme"

describe("useTheme", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("reads theme from localStorage on init", async () => {
		vi.mocked(resolveTheme).mockReturnValue("dark")

		const { result } = renderHook(() => useTheme())

		await waitFor(() => {
			expect(result.current.theme).toBe("dark")
		})
		expect(resolveTheme).toHaveBeenCalledTimes(1)
		expect(applyTheme).toHaveBeenCalledWith("dark")
	})

	it("defaults to system preference when no saved theme", async () => {
		// resolveTheme encapsulates fallback logic (stored -> system)
		vi.mocked(resolveTheme).mockReturnValue("light")

		const { result } = renderHook(() => useTheme())

		await waitFor(() => {
			expect(result.current.theme).toBe("light")
		})
		expect(resolveTheme).toHaveBeenCalledTimes(1)
	})

	it("toggle switches dark ↔ light", async () => {
		vi.mocked(resolveTheme).mockReturnValue("dark")
		const { result } = renderHook(() => useTheme())

		await waitFor(() => expect(result.current.theme).toBe("dark"))

		act(() => {
			result.current.toggleTheme()
		})
		expect(result.current.theme).toBe("light")

		act(() => {
			result.current.toggleTheme()
		})
		expect(result.current.theme).toBe("dark")
	})

	it("persists theme preference to localStorage on toggle", async () => {
		vi.mocked(resolveTheme).mockReturnValue("light")
		const { result } = renderHook(() => useTheme())
		await waitFor(() => expect(result.current.theme).toBe("light"))

		act(() => {
			result.current.toggleTheme()
		})

		expect(persistTheme).toHaveBeenCalledWith("dark")
	})

	it("applies data-theme changes via applyTheme to html element path", async () => {
		vi.mocked(resolveTheme).mockReturnValue("dark")
		renderHook(() => useTheme())

		await waitFor(() => {
			expect(applyTheme).toHaveBeenCalledWith("dark")
		})
	})
})
