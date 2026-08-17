import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useOfflineQueue } from "./useOfflineQueue"

// Mock the offline-db module
vi.mock("../lib/offline-db", () => ({
	enqueueOutboxItem: vi.fn().mockResolvedValue(undefined),
	getPendingOutboxItems: vi.fn().mockResolvedValue([]),
	getFailedOutboxItems: vi.fn().mockResolvedValue([]),
	getDownloadedTracks: vi.fn().mockResolvedValue([]),
	saveDownload: vi.fn().mockResolvedValue(undefined),
	deleteDownload: vi.fn().mockResolvedValue(undefined),
	updateOutboxItem: vi.fn().mockResolvedValue(undefined),
	clearSyncedOutbox: vi.fn().mockResolvedValue(undefined),
}))

describe("useOfflineQueue", () => {
	beforeEach(() => {
		vi.stubGlobal("navigator", { onLine: true })
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	it("initializes with zero pending count", () => {
		const { result } = renderHook(() => useOfflineQueue())
		expect(result.current.pendingCount).toBe(0)
		expect(result.current.failedItems).toEqual([])
	})

	it("enqueues an item and refreshes state", async () => {
		const { enqueueOutboxItem } = await import("../lib/offline-db")
		const mockEnqueue = enqueueOutboxItem as ReturnType<typeof vi.fn>
		mockEnqueue.mockResolvedValueOnce(undefined)

		const { result } = renderHook(() => useOfflineQueue())

		const id = await result.current.enqueue({
			type: "lesson_read",
			payload: { courseSlug: "test", lessonIds: [1] },
			courseId: "test",
		})

		expect(typeof id).toBe("string")
		expect(id.length).toBeGreaterThan(0)
		expect(mockEnqueue).toHaveBeenCalledTimes(1)
	})

	it("drain does not run concurrently", async () => {
		const { result } = renderHook(() => useOfflineQueue())

		// Start two drains simultaneously
		const drain1 = result.current.drain()
		const drain2 = result.current.drain()

		await Promise.all([drain1, drain2])

		// The second drain should have been skipped due to drainingRef
		const { clearSyncedOutbox } = await import("../lib/offline-db")
		// clearSyncedOutbox should only be called once (from the first drain)
		expect(clearSyncedOutbox).toHaveBeenCalledTimes(1)
	})

	it("registers online event listener for auto-drain", async () => {
		const addSpy = vi.spyOn(window, "addEventListener")
		const { unmount } = renderHook(() => useOfflineQueue())

		expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function))
		unmount()
		addSpy.mockRestore()
	})
})
