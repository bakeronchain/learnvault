import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"
import {
	type DownloadRecord,
	type OutboxItem,
	deleteDownload,
	deleteOutboxItem,
	enqueueOutboxItem,
	getDownload,
	getDownloadedTracks,
	getFailedOutboxItems,
	getPendingOutboxItems,
	getSyncedOutboxItems,
	saveDownload,
	updateOutboxItem,
	clearSyncedOutbox,
	resetOfflineDB,
} from "./offline-db"

beforeEach(async () => {
	await resetOfflineDB()
})

describe("offline-db: downloads", () => {
	const sampleRecord: DownloadRecord = {
		trackSlug: "web3",
		title: "Web3",
		downloadedAt: "2026-01-15T10:00:00Z",
		courseSlugs: ["web3-fundamentals"],
		totalSize: 50000,
		manifestVersion: 1,
	}

	it("saves and retrieves a download record", async () => {
		await saveDownload(sampleRecord)
		const result = await getDownload("web3")
		expect(result).toBeDefined()
		expect(result?.trackSlug).toBe("web3")
		expect(result?.title).toBe("Web3")
	})

	it("lists all downloaded tracks", async () => {
		await saveDownload(sampleRecord)
		await saveDownload({
			...sampleRecord,
			trackSlug: "defi",
			title: "DeFi",
		})
		const tracks = await getDownloadedTracks()
		expect(tracks).toHaveLength(2)
	})

	it("deletes a download record", async () => {
		await saveDownload(sampleRecord)
		await deleteDownload("web3")
		const result = await getDownload("web3")
		expect(result).toBeUndefined()
	})
})

describe("offline-db: outbox", () => {
	const makeItem = (overrides?: Partial<OutboxItem>): OutboxItem => ({
		id: crypto.randomUUID(),
		type: "lesson_read",
		payload: { courseSlug: "web3-fundamentals", lessonIds: [1, 2] },
		courseId: "web3-fundamentals",
		createdAt: new Date().toISOString(),
		status: "pending",
		attempts: 0,
		...overrides,
	})

	it("enqueues and retrieves pending items", async () => {
		const item = makeItem()
		await enqueueOutboxItem(item)
		const pending = await getPendingOutboxItems()
		expect(pending).toHaveLength(1)
		expect(pending[0].id).toBe(item.id)
	})

	it("updates item status to synced", async () => {
		const item = makeItem()
		await enqueueOutboxItem(item)
		await updateOutboxItem({ ...item, status: "synced", attempts: 1 })
		const pending = await getPendingOutboxItems()
		expect(pending).toHaveLength(0)
		const synced = await getSyncedOutboxItems()
		expect(synced).toHaveLength(1)
	})

	it("updates item status to failed after max attempts", async () => {
		const item = makeItem({ attempts: 4 })
		await enqueueOutboxItem(item)
		await updateOutboxItem({
			...item,
			status: "failed",
			attempts: 5,
			errorMessage: "HTTP 500",
		})
		const failed = await getFailedOutboxItems()
		expect(failed).toHaveLength(1)
		expect(failed[0].errorMessage).toBe("HTTP 500")
	})

	it("clears synced outbox items", async () => {
		await enqueueOutboxItem(makeItem({ status: "synced", attempts: 1 }))
		await enqueueOutboxItem(makeItem({ status: "synced", attempts: 1 }))
		await enqueueOutboxItem(makeItem({ status: "pending" }))
		await clearSyncedOutbox()
		const pending = await getPendingOutboxItems()
		const synced = await getSyncedOutboxItems()
		expect(pending).toHaveLength(1)
		expect(synced).toHaveLength(0)
	})

	it("deletes individual outbox items", async () => {
		const item = makeItem()
		await enqueueOutboxItem(item)
		await deleteOutboxItem(item.id)
		const pending = await getPendingOutboxItems()
		expect(pending).toHaveLength(0)
	})

	it("returns pending items sorted by createdAt ascending", async () => {
		const first = makeItem({ createdAt: "2026-01-01T00:00:00Z" })
		const second = makeItem({ createdAt: "2026-01-02T00:00:00Z" })
		const third = makeItem({ createdAt: "2026-01-03T00:00:00Z" })
		await enqueueOutboxItem(third)
		await enqueueOutboxItem(first)
		await enqueueOutboxItem(second)
		const pending = await getPendingOutboxItems()
		expect(pending.map((i) => i.createdAt)).toEqual([
			"2026-01-01T00:00:00Z",
			"2026-01-02T00:00:00Z",
			"2026-01-03T00:00:00Z",
		])
	})
})
