import { type Request, type Response } from "express"

import { poolMonitor } from "../services/pool-monitor.service"

export const getHealth = (_req: Request, res: Response): void => {
	const poolStats = poolMonitor.getPoolStats()
	const lastAlert = poolMonitor.getLastAlert()

	// Check pool health and generate alerts if needed
	const alert = poolMonitor.checkPoolHealth()

	res.status(200).json({
		status: "ok",
		timestamp: new Date().toISOString(),
		database: {
			connected: true,
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
						maxConnections: poolStats.maxConnections,
						minConnections: poolStats.minConnections,
						idleTimeoutMillis: poolStats.idleTimeoutMillis,
						connectionTimeoutMillis: poolStats.connectionTimeoutMillis,
					}
				: null,
			alert:
				alert || lastAlert
					? {
							level: alert?.level || lastAlert?.level,
							message: alert?.message || lastAlert?.message,
							capacityUsagePercent:
								alert?.capacityUsagePercent || lastAlert?.capacityUsagePercent,
						}
					: null,
		},
	})
}
