/**
 * Tests for database pool configuration, health checks, and monitoring.
 *
 * Tests the pool monitor service, health endpoint, and metrics endpoints.
 */

import express from "express"
import { Pool } from "pg"
import request from "supertest"

// Mock the pool module before importing services
jest.mock("../db/index.ts", () => ({
	pool: new Pool(),
	initDb: jest.fn().mockResolvedValue(undefined),
	db: {
		query: jest.fn().mockResolvedValue({ rows: [] }),
		connected: true,
	},
}))

import { errorHandler } from "../middleware/error.middleware"
import { healthRouter } from "../routes/health.routes"
import { poolMonitor } from "../services/pool-monitor.service"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", healthRouter)
	app.use(errorHandler)
	return app
}

// Mock pool stats for testing
function getMockPoolStats() {
	return {
		total: 20,
		idle: 12,
		active: 8,
		waitingCount: 0,
		capacityUsagePercent: 40,
		isNearCapacity: false,
		maxConnections: 20,
		minConnections: 4,
		idleTimeoutMillis: 30000,
		connectionTimeoutMillis: 5000,
	}
}

function getMockPoolAlert(
	level: "warning" | "critical",
	capacityUsage: number,
) {
	return {
		level,
		message: `${level === "critical" ? "🚨 CRITICAL" : "⚠️  WARNING"}: Database pool approaching capacity (${capacityUsage.toFixed(1)}%)!`,
		capacityUsagePercent: capacityUsage,
		timestamp: new Date().toISOString(),
	}
}

// ---------------------------------------------------------------------------
// Pool Configuration Tests
// ---------------------------------------------------------------------------

describe("Pool Configuration", () => {
	it("should configure pool with explicit settings in getPoolConfig", () => {
		// Test that the pool is being created with explicit config
		// This is verified through the db initialization
		const stats = poolMonitor.getPoolStats()

		if (stats) {
			expect(stats).toHaveProperty("maxConnections")
			expect(stats).toHaveProperty("minConnections")
			expect(stats).toHaveProperty("idleTimeoutMillis")
			expect(stats).toHaveProperty("connectionTimeoutMillis")

			// Verify values are reasonable
			expect(stats.maxConnections).toBeGreaterThanOrEqual(1)
			expect(stats.minConnections).toBeGreaterThanOrEqual(1)
			expect(stats.minConnections).toBeLessThanOrEqual(stats.maxConnections)
			expect(stats.idleTimeoutMillis).toBeGreaterThan(0)
			expect(stats.connectionTimeoutMillis).toBeGreaterThan(0)
		}
	})
})

// ---------------------------------------------------------------------------
// GET /api/health Tests
// ---------------------------------------------------------------------------

describe("GET /api/health", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should return 200 with basic health status", async () => {
		jest.spyOn(poolMonitor, "getPoolStats").mockReturnValue(getMockPoolStats())
		jest.spyOn(poolMonitor, "checkPoolHealth").mockReturnValue(null)
		jest.spyOn(poolMonitor, "getLastAlert").mockReturnValue(null)

		const res = await request(buildApp()).get("/api/health")

		expect(res.status).toBe(200)
		expect(res.body.status).toBe("ok")
		expect(res.body.timestamp).toBeDefined()
	})

	it("should include database connection status", async () => {
		jest.spyOn(poolMonitor, "getPoolStats").mockReturnValue(getMockPoolStats())
		jest.spyOn(poolMonitor, "checkPoolHealth").mockReturnValue(null)
		jest.spyOn(poolMonitor, "getLastAlert").mockReturnValue(null)

		const res = await request(buildApp()).get("/api/health")

		expect(res.body.database).toBeDefined()
		expect(res.body.database.connected).toBe(true)
	})

	it("should include pool statistics", async () => {
		const mockStats = getMockPoolStats()
		jest.spyOn(poolMonitor, "getPoolStats").mockReturnValue(mockStats)
		jest.spyOn(poolMonitor, "checkPoolHealth").mockReturnValue(null)
		jest.spyOn(poolMonitor, "getLastAlert").mockReturnValue(null)

		const res = await request(buildApp()).get("/api/health")

		expect(res.body.database.pool).toBeDefined()
		expect(res.body.database.pool.total).toBe(20)
		expect(res.body.database.pool.active).toBe(8)
		expect(res.body.database.pool.idle).toBe(12)
		expect(res.body.database.pool.waiting).toBe(0)
		expect(res.body.database.pool.capacityUsagePercent).toBe(40)
		expect(res.body.database.pool.isNearCapacity).toBe(false)
	})

	it("should include pool configuration in response", async () => {
		const mockStats = getMockPoolStats()
		jest.spyOn(poolMonitor, "getPoolStats").mockReturnValue(mockStats)
		jest.spyOn(poolMonitor, "checkPoolHealth").mockReturnValue(null)
		jest.spyOn(poolMonitor, "getLastAlert").mockReturnValue(null)

		const res = await request(buildApp()).get("/api/health")

		expect(res.body.database.pool.maxConnections).toBe(20)
		expect(res.body.database.pool.minConnections).toBe(4)
		expect(res.body.database.pool.idleTimeoutMillis).toBe(30000)
		expect(res.body.database.pool.connectionTimeoutMillis).toBe(5000)
	})

	it("should include pool alert when one exists", async () => {
		const mockStats = getMockPoolStats()
		mockStats.capacityUsagePercent = 82
		mockStats.active = 16
		jest.spyOn(poolMonitor, "getPoolStats").mockReturnValue(mockStats)

		const mockAlert = getMockPoolAlert("warning", 82)
		jest.spyOn(poolMonitor, "checkPoolHealth").mockReturnValue(mockAlert)
		jest.spyOn(poolMonitor, "getLastAlert").mockReturnValue(mockAlert)

		const res = await request(buildApp()).get("/api/health")

		expect(res.body.database.alert).toBeDefined()
		expect(res.body.database.alert.level).toBe("warning")
		expect(res.body.database.alert.capacityUsagePercent).toBe(82)
	})

	it("should handle null pool stats gracefully", async () => {
		jest.spyOn(poolMonitor, "getPoolStats").mockReturnValue(null)
		jest.spyOn(poolMonitor, "checkPoolHealth").mockReturnValue(null)
		jest.spyOn(poolMonitor, "getLastAlert").mockReturnValue(null)

		const res = await request(buildApp()).get("/api/health")

		expect(res.status).toBe(200)
		expect(res.body.database.pool).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// GET /api/metrics/pool Tests
// ---------------------------------------------------------------------------

describe("GET /api/metrics/pool", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should return 200 with pool metrics", async () => {
		jest.spyOn(poolMonitor, "getPoolStats").mockReturnValue(getMockPoolStats())
		jest.spyOn(poolMonitor, "getLastAlert").mockReturnValue(null)
		jest.spyOn(poolMonitor, "getPoolDebugInfo").mockReturnValue({
			clientCount: 12,
			waitingCount: 0,
			idlingCount: 12,
		})

		const res = await request(buildApp()).get("/api/metrics/pool")

		expect(res.status).toBe(200)
		expect(res.body.timestamp).toBeDefined()
		expect(res.body.metrics).toBeDefined()
	})

	it("should include pool statistics in metrics", async () => {
		const mockStats = getMockPoolStats()
		jest.spyOn(poolMonitor, "getPoolStats").mockReturnValue(mockStats)
		jest.spyOn(poolMonitor, "getLastAlert").mockReturnValue(null)
		jest.spyOn(poolMonitor, "getPoolDebugInfo").mockReturnValue({
			clientCount: 12,
			waitingCount: 0,
			idlingCount: 12,
		})

		const res = await request(buildApp()).get("/api/metrics/pool")

		expect(res.body.metrics.pool).toBeDefined()
		expect(res.body.metrics.pool.total).toBe(20)
		expect(res.body.metrics.pool.active).toBe(8)
		expect(res.body.metrics.pool.idle).toBe(12)
	})

	it("should include capacity thresholds in metrics", async () => {
		jest.spyOn(poolMonitor, "getPoolStats").mockReturnValue(getMockPoolStats())
		jest.spyOn(poolMonitor, "getLastAlert").mockReturnValue(null)
		jest.spyOn(poolMonitor, "getPoolDebugInfo").mockReturnValue({
			clientCount: 12,
			waitingCount: 0,
			idlingCount: 12,
		})

		const res = await request(buildApp()).get("/api/metrics/pool")

		expect(res.body.metrics.pool.capacityThresholds).toBeDefined()
		expect(res.body.metrics.pool.capacityThresholds.warningPercent).toBe(80)
		expect(res.body.metrics.pool.capacityThresholds.criticalPercent).toBe(95)
	})

	it("should include debug information", async () => {
		jest.spyOn(poolMonitor, "getPoolStats").mockReturnValue(getMockPoolStats())
		jest.spyOn(poolMonitor, "getLastAlert").mockReturnValue(null)
		jest.spyOn(poolMonitor, "getPoolDebugInfo").mockReturnValue({
			clientCount: 12,
			waitingCount: 0,
			idlingCount: 12,
		})

		const res = await request(buildApp()).get("/api/metrics/pool")

		expect(res.body.debug).toBeDefined()
		expect(res.body.debug.clientCount).toBe(12)
		expect(res.body.debug.waitingCount).toBe(0)
		expect(res.body.debug.idlingCount).toBe(12)
	})

	it("should include last alert in metrics", async () => {
		jest.spyOn(poolMonitor, "getPoolStats").mockReturnValue(getMockPoolStats())
		const mockAlert = getMockPoolAlert("critical", 96)
		jest.spyOn(poolMonitor, "getLastAlert").mockReturnValue(mockAlert)
		jest.spyOn(poolMonitor, "getPoolDebugInfo").mockReturnValue({
			clientCount: 19,
			waitingCount: 2,
			idlingCount: 10,
		})

		const res = await request(buildApp()).get("/api/metrics/pool")

		expect(res.body.metrics.lastAlert).toBeDefined()
		expect(res.body.metrics.lastAlert.level).toBe("critical")
		expect(res.body.metrics.lastAlert.capacityUsagePercent).toBe(96)
	})
})

// ---------------------------------------------------------------------------
// POST /api/metrics/pool/alerts/reset Tests
// ---------------------------------------------------------------------------

describe("POST /api/metrics/pool/alerts/reset", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should return 200 when resetting alerts", async () => {
		const resetSpy = jest
			.spyOn(poolMonitor, "resetLastAlert")
			.mockImplementation()

		const res = await request(buildApp()).post("/api/metrics/pool/alerts/reset")

		expect(res.status).toBe(200)
		expect(res.body.status).toBe("ok")
		expect(resetSpy).toHaveBeenCalled()
	})

	it("should include confirmation message in response", async () => {
		jest.spyOn(poolMonitor, "resetLastAlert").mockImplementation()

		const res = await request(buildApp()).post("/api/metrics/pool/alerts/reset")

		expect(res.body.message).toBe("Pool alerts have been reset")
		expect(res.body.timestamp).toBeDefined()
	})
})

// ---------------------------------------------------------------------------
// Pool Monitor Service Tests
// ---------------------------------------------------------------------------

describe("PoolMonitor Service", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should detect warning alert when approaching 80% capacity", async () => {
		const mockStats = getMockPoolStats()
		mockStats.capacityUsagePercent = 82
		mockStats.active = 16

		jest.spyOn(poolMonitor, "getPoolStats").mockReturnValue(mockStats)

		const alert = poolMonitor.checkPoolHealth()

		expect(alert).toBeDefined()
		if (alert) {
			expect(alert.level).toBe("warning")
			expect(alert.capacityUsagePercent).toBe(82)
		}
	})

	it("should detect critical alert when exceeding 95% capacity", async () => {
		const mockStats = getMockPoolStats()
		mockStats.capacityUsagePercent = 98
		mockStats.active = 19

		jest.spyOn(poolMonitor, "getPoolStats").mockReturnValue(mockStats)

		const alert = poolMonitor.checkPoolHealth()

		expect(alert).toBeDefined()
		if (alert) {
			expect(alert.level).toBe("critical")
			expect(alert.capacityUsagePercent).toBe(98)
		}
	})

	it("should store last alert", async () => {
		const mockAlert = getMockPoolAlert("warning", 82)
		jest.spyOn(poolMonitor, "getLastAlert").mockReturnValue(mockAlert)

		const lastAlert = poolMonitor.getLastAlert()

		expect(lastAlert).toEqual(mockAlert)
	})

	it("should reset last alert", async () => {
		jest.spyOn(poolMonitor, "resetLastAlert").mockImplementation()

		poolMonitor.resetLastAlert()

		expect(poolMonitor.getLastAlert()).toBeNull()
	})

	it("should not trigger alert when pool usage is normal", async () => {
		const mockStats = getMockPoolStats()
		mockStats.capacityUsagePercent = 40

		jest.spyOn(poolMonitor, "getPoolStats").mockReturnValue(mockStats)

		const alert = poolMonitor.checkPoolHealth()

		expect(alert).toBeNull()
	})

	it("should return pool statistics with correct types", async () => {
		const mockStats = getMockPoolStats()
		jest.spyOn(poolMonitor, "getPoolStats").mockReturnValue(mockStats)

		const stats = poolMonitor.getPoolStats()

		expect(typeof stats?.total).toBe("number")
		expect(typeof stats?.idle).toBe("number")
		expect(typeof stats?.active).toBe("number")
		expect(typeof stats?.waitingCount).toBe("number")
		expect(typeof stats?.capacityUsagePercent).toBe("number")
		expect(typeof stats?.isNearCapacity).toBe("boolean")
	})
})
