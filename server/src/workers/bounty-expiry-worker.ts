import { bountyStore } from "../db/bounty-store"

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes
const intervalMs = Number.parseInt(
	process.env.BOUNTY_EXPIRY_CRON_INTERVAL_MS || "",
	10,
)
const pollEveryMs =
	Number.isFinite(intervalMs) && intervalMs > 0
		? intervalMs
		: DEFAULT_INTERVAL_MS

let timer: NodeJS.Timeout | null = null

export async function processExpiredClaims(): Promise<void> {
	try {
		const reopened = await bountyStore.reopenExpiredClaims()
		if (reopened > 0) {
			console.log(`[bounty-expiry] Reopened ${reopened} expired bounties`)
		}
	} catch (err) {
		console.error("[bounty-expiry] Error processing expired claims:", err)
	}
}

export async function startBountyExpiryWorker(): Promise<void> {
	if (timer) {
		return
	}

	console.log(`[bounty-expiry] Worker started (interval=${pollEveryMs}ms)`)

	await processExpiredClaims()

	timer = setInterval(() => {
		void processExpiredClaims()
	}, pollEveryMs)
}

export function stopBountyExpiryWorker(): void {
	if (timer) {
		clearInterval(timer)
		timer = null
	}
	console.log("[bounty-expiry] Worker stopped")
}
