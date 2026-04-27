import { type Request, type Response } from "express"

import { poolMonitor } from "../services/pool-monitor.service"

/**
 * Get pool metrics for monitoring dashboard
 * Returns pool statistics and recent alerts
 */
export const getPoolMetrics = (_req: Request, res: Response): void => {
	const poolStats = poolMonitor.getPoolStats()
	const lastAlert = poolMonitor.getLastAlert()
	const debugInfo = poolMonitor.getPoolDebugInfo()

	res.status(200).json({
		timestamp: new Date().toISOString(),
		metrics: {
			pool: poolStats
				? {
						total: poolStats.total,
						active: poolStats.active,
						idle: poolStats.idle,
						waiting: poolStats.waitingCount,
						capacityUsagePercent: parseFloat(
							poolStats.capacityUsagePercent.toFixed(2),
						),
						isNearCapacity: poolStats.isNearCapacity,
						capacityThresholds: {
							warningPercent: 80,
							criticalPercent: 95,
						},
						configuration: {
							maxConnections: poolStats.maxConnections,
							minConnections: poolStats.minConnections,
							idleTimeoutMillis: poolStats.idleTimeoutMillis,
							connectionTimeoutMillis: poolStats.connectionTimeoutMillis,
						},
					}
				: null,
			lastAlert: lastAlert
				? {
						level: lastAlert.level,
						message: lastAlert.message,
						timestamp: lastAlert.timestamp,
					}
				: null,
		},
		debug: debugInfo,
	})
}

/**
 * Reset pool alerts (typically used by monitoring systems)
 */
export const resetPoolAlerts = (_req: Request, res: Response): void => {
	poolMonitor.resetLastAlert()

	res.status(200).json({
		status: "ok",
		message: "Pool alerts have been reset",
		timestamp: new Date().toISOString(),
	})
}
