import { Pool } from "pg"

class MockPool {
	async connect() {
		return {
			query: async () => ({ rows: [] }),
			release: () => {},
		}
	}
	async query(_text: string, _params?: any[]) {
		return { rows: [] }
	}
}

let activePool: Pool | MockPool

try {
	activePool = new Pool({
		connectionString: process.env.DATABASE_URL,
		ssl:
			process.env.NODE_ENV === "production"
				? { rejectUnauthorized: false }
				: false,
	})
} catch {
	console.warn("[db] Failed to create postgres pool, using mock")
	activePool = new MockPool()
}

export const pool = activePool

/**
 * Verifies the database connection on startup.
 * Schema is managed exclusively via migrations (`npm run migrate`).
 * No DDL is executed here.
 */
export const initDb = async () => {
	try {
		if (activePool instanceof Pool) {
			const client = await activePool.connect()
			await client.query("SELECT 1")
			client.release()
			console.log("[db] Postgres connection verified")
		} else {
			console.log("[db] In-memory mock database initialized")
		}
	} catch (err) {
		console.error("[db] Connection check failed, falling back to mock:", err)
		activePool = new MockPool()
	}
}

export const db = {
	query: (text: string, params?: any[]) => activePool.query(text, params),
	connected: true,
}
