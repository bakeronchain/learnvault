import { type Pool } from "pg"

export interface PoolStats {
	total: number
	idle: number
	active: number
	waitingCount: number
	capacityUsagePercent: number
	isNearCapacity: boolean
	maxConnections: number
	minConnections: number
	idleTimeoutMillis: number
	connectionTimeoutMillis: number
}

export interface PoolAlert {
	level: "warning" | "critical"
	message: string
	capacityUsagePercent: number
	timestamp: string
}

class PoolMonitor {
	private pool: Pool | null = null
	private capacityThreshold = 0.8 // 80% capacity triggers warning
	private criticalThreshold = 0.95 // 95% capacity triggers critical
	private lastAlert: PoolAlert | null = null
	private alertLocks = new Set<string>() // Prevent alert spam

	/**
	 * Initialize the pool monitor with a Pool instance
	 */
	initializeMonitor(pool: Pool): void {
		this.pool = pool

		// Emit events for debugging
		pool.on("error", (err: any) => {
			console.error("[pool-monitor] Unexpected error in pool:", err)
		})

		pool.on("connect", () => {
			console.debug("[pool-monitor] Client connected")
		})

		// Log pool statistics every minute in development
		if (process.env.NODE_ENV === "development") {
			setInterval(() => {
				const stats = this.getPoolStats()
				if (stats) {
					console.debug(
						`[pool-monitor] Stats - Active: ${stats.active}/${stats.total}, Usage: ${stats.capacityUsagePercent.toFixed(1)}%`,
					)
				}
			}, 60000)
		}
	}

	/**
	 * Get current pool statistics
	 */
	getPoolStats(): PoolStats | null {
		if (!this.pool) {
			return null
		}

		try {
			// Access internal pool state
			const poolState = (this.pool as any)._clients // Available clients
			const waiting = (this.pool as any).waitingCount || 0
			const totalSize = this.pool.options.max || 10

			const idleCount = poolState ? poolState.length : 0
			const activeCount = totalSize - idleCount - waiting

			const activeConnections = Math.max(0, activeCount)
			const capacityUsagePercent = (activeConnections / totalSize) * 100
			const isNearCapacity =
				capacityUsagePercent >= this.capacityThreshold * 100

			return {
				total: totalSize,
				idle: idleCount,
				active: activeConnections,
				waitingCount: waiting,
				capacityUsagePercent,
				isNearCapacity,
				maxConnections: this.pool.options.max || 10,
				minConnections: this.pool.options.min || 1,
				idleTimeoutMillis: this.pool.options.idleTimeoutMillis || 30000,
				connectionTimeoutMillis:
					this.pool.options.connectionTimeoutMillis || 5000,
			}
		} catch (error) {
			console.error("[pool-monitor] Error retrieving pool stats:", error)
			return null
		}
	}

	/**
	 * Check pool health and generate alerts if needed
	 */
	checkPoolHealth(): PoolAlert | null {
		const stats = this.getPoolStats()
		if (!stats) {
			return null
		}

		const usagePercent = stats.capacityUsagePercent

		// Check for critical alert (95% capacity)
		if (usagePercent >= this.criticalThreshold * 100) {
			const alertKey = "critical"
			if (!this.alertLocks.has(alertKey)) {
				this.alertLocks.add(alertKey)
				setTimeout(() => this.alertLocks.delete(alertKey), 300000) // 5 minute cooldown

				const alert: PoolAlert = {
					level: "critical",
					message: `🚨 CRITICAL: Database pool approaching capacity (${usagePercent.toFixed(1)}%)! Active: ${stats.active}/${stats.total}`,
					capacityUsagePercent: usagePercent,
					timestamp: new Date().toISOString(),
				}

				this.lastAlert = alert
				console.error("[pool-monitor]", alert.message)
				return alert
			}
		}

		// Check for warning alert (80% capacity)
		if (
			usagePercent >= this.capacityThreshold * 100 &&
			usagePercent < this.criticalThreshold * 100
		) {
			const alertKey = "warning"
			if (!this.alertLocks.has(alertKey)) {
				this.alertLocks.add(alertKey)
				setTimeout(() => this.alertLocks.delete(alertKey), 600000) // 10 minute cooldown

				const alert: PoolAlert = {
					level: "warning",
					message: `⚠️  WARNING: Database pool approaching capacity (${usagePercent.toFixed(1)}%)! Active: ${stats.active}/${stats.total}`,
					capacityUsagePercent: usagePercent,
					timestamp: new Date().toISOString(),
				}

				this.lastAlert = alert
				console.warn("[pool-monitor]", alert.message)
				return alert
			}
		}

		return null
	}

	/**
	 * Get the last alert that was generated
	 */
	getLastAlert(): PoolAlert | null {
		return this.lastAlert
	}

	/**
	 * Reset the last alert
	 */
	resetLastAlert(): void {
		this.lastAlert = null
	}

	/**
	 * Get pool querying information for debugging
	 */
	getPoolDebugInfo(): {
		clientCount: number | null
		waitingCount: number | null
		idlingCount: number | null
	} {
		if (!this.pool) {
			return { clientCount: null, waitingCount: null, idlingCount: null }
		}

		try {
			return {
				clientCount: (this.pool as any)._clients
					? (this.pool as any)._clients.length
					: null,
				waitingCount: (this.pool as any).waitingCount || 0,
				idlingCount: (this.pool as any)._idle || 0,
			}
		} catch {
			return { clientCount: null, waitingCount: null, idlingCount: null }
		}
	}
}

// Export singleton instance
export const poolMonitor = new PoolMonitor()
