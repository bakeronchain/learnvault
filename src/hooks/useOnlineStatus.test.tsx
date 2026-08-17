import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useOnlineStatus } from "./useOnlineStatus"

describe("useOnlineStatus", () => {
	beforeEach(() => {
		vi.stubGlobal("navigator", { onLine: true })
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("returns isOnline from navigator.onLine", () => {
		const { result } = renderHook(() => useOnlineStatus())
		expect(result.current.isOnline).toBe(true)
	})

	it("updates when going offline", async () => {
		vi.stubGlobal("navigator", { onLine: false })
		const { result } = renderHook(() => useOnlineStatus())
		expect(result.current.isOnline).toBe(false)
	})

	it("sets wasOffline to true after reconnect", async () => {
		vi.useFakeTimers()
		vi.stubGlobal("navigator", { onLine: true })

		const { result, rerender } = renderHook(() => useOnlineStatus())

		// Simulate going offline then back online
		vi.stubGlobal("navigator", { onLine: false })
		window.dispatchEvent(new Event("offline"))
		rerender()

		vi.stubGlobal("navigator", { onLine: true })
		window.dispatchEvent(new Event("online"))
		rerender()

		expect(result.current.wasOffline).toBe(true)

		// After 5 seconds, wasOffline resets
		vi.advanceTimersByTime(5000)
		rerender()
		expect(result.current.wasOffline).toBe(false)
		vi.useRealTimers()
	})
})
