import { resolvePoolEnvConfig } from "../db/pool-config"

describe("resolvePoolEnvConfig", () => {
	const originalEnv = process.env

	beforeEach(() => {
		process.env = { ...originalEnv }
		delete process.env.DB_POOL_MAX
		delete process.env.DB_POOL_MIN
		delete process.env.DB_POOL_IDLE_TIMEOUT_MS
		delete process.env.DB_POOL_CONNECTION_TIMEOUT_MS
	})

	afterAll(() => {
		process.env = originalEnv
	})

	it("uses production defaults when NODE_ENV=production", () => {
		process.env.NODE_ENV = "production"
		const config = resolvePoolEnvConfig()
		expect(config.max).toBe(20)
		expect(config.min).toBe(4)
		expect(config.idleTimeoutMillis).toBe(30000)
		expect(config.connectionTimeoutMillis).toBe(2000)
	})

	it("reads DB_POOL_MAX and connection timeout overrides", () => {
		process.env.NODE_ENV = "production"
		process.env.DB_POOL_MAX = "30"
		process.env.DB_POOL_CONNECTION_TIMEOUT_MS = "1500"
		const config = resolvePoolEnvConfig()
		expect(config.max).toBe(30)
		expect(config.connectionTimeoutMillis).toBe(1500)
	})

	it("clamps min to max", () => {
		process.env.NODE_ENV = "development"
		process.env.DB_POOL_MAX = "3"
		process.env.DB_POOL_MIN = "10"
		const config = resolvePoolEnvConfig()
		expect(config.max).toBe(3)
		expect(config.min).toBe(3)
	})
})
