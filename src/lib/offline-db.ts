import { openDB, type IDBPDatabase } from "idb"

// ── Types ────────────────────────────────────────────────────────────────────

export interface DownloadRecord {
	trackSlug: string
	title: string
	downloadedAt: string
	courseSlugs: string[]
	totalSize: number
	manifestVersion: number
}

export interface OutboxItem {
	id: string
	type: "lesson_read" | "quiz_submission" | "milestone_evidence"
	payload: Record<string, unknown>
	courseId: string
	lessonId?: number
	createdAt: string
	status: "pending" | "synced" | "failed"
	attempts: number
	lastAttemptAt?: string
	errorMessage?: string
}

interface LearnVaultDB {
	downloads: {
		key: string
		value: DownloadRecord
	}
	outbox: {
		key: string
		value: OutboxItem
		indexes: {
			"by-status": string
			"by-created": string
		}
	}
}

const DB_NAME = "learnvault-offline"
const DB_VERSION = 1

// ── Singleton ────────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase<LearnVaultDB>> | null = null

function getDB(): Promise<IDBPDatabase<LearnVaultDB>> {
	if (!dbPromise) {
		dbPromise = openDB<LearnVaultDB>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains("downloads")) {
					db.createObjectStore("downloads", { keyPath: "trackSlug" })
				}
				if (!db.objectStoreNames.contains("outbox")) {
					const store = db.createObjectStore("outbox", { keyPath: "id" })
					store.createIndex("by-status", "status")
					store.createIndex("by-created", "createdAt")
				}
			},
		})
	}
	return dbPromise
}

/**
 * Reset the singleton DB connection and delete the database.
 * Used in tests to get a fresh database between test runs.
 */
export async function resetOfflineDB(): Promise<void> {
	if (dbPromise) {
		try {
			const db = await dbPromise
			db.close()
		} catch {
			// Ignore — DB may already be closed
		}
	}
	dbPromise = null
	return new Promise<void>((resolve, reject) => {
		const req = indexedDB.deleteDatabase(DB_NAME)
		req.onsuccess = () => resolve()
		req.onerror = () => reject(req.error)
		req.onblocked = () => resolve()
	})
}

// ── Downloads ────────────────────────────────────────────────────────────────

export async function getDownloadedTracks(): Promise<DownloadRecord[]> {
	const db = await getDB()
	return db.getAll("downloads")
}

export async function getDownload(trackSlug: string): Promise<DownloadRecord | undefined> {
	const db = await getDB()
	return db.get("downloads", trackSlug)
}

export async function saveDownload(record: DownloadRecord): Promise<void> {
	const db = await getDB()
	await db.put("downloads", record)
}

export async function deleteDownload(trackSlug: string): Promise<void> {
	const db = await getDB()
	await db.delete("downloads", trackSlug)
}

// ── Outbox ───────────────────────────────────────────────────────────────────

export async function enqueueOutboxItem(item: OutboxItem): Promise<void> {
	const db = await getDB()
	await db.put("outbox", item)
}

export async function getOutboxItem(id: string): Promise<OutboxItem | undefined> {
	const db = await getDB()
	return db.get("outbox", id)
}

export async function getPendingOutboxItems(): Promise<OutboxItem[]> {
	const db = await getDB()
	const all = await db.getAllFromIndex("outbox", "by-status", "pending")
	return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function updateOutboxItem(item: OutboxItem): Promise<void> {
	const db = await getDB()
	await db.put("outbox", item)
}

export async function deleteOutboxItem(id: string): Promise<void> {
	const db = await getDB()
	await db.delete("outbox", id)
}

export async function getFailedOutboxItems(): Promise<OutboxItem[]> {
	const db = await getDB()
	return db.getAllFromIndex("outbox", "by-status", "failed")
}

export async function getSyncedOutboxItems(): Promise<OutboxItem[]> {
	const db = await getDB()
	return db.getAllFromIndex("outbox", "by-status", "synced")
}

export async function clearSyncedOutbox(): Promise<void> {
	const db = await getDB()
	const synced = await db.getAllFromIndex("outbox", "by-status", "synced")
	const tx = db.transaction("outbox", "readwrite")
	for (const item of synced) {
		void tx.store.delete(item.id)
	}
	await tx.done
}
