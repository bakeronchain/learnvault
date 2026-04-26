import { processEscrowTimeouts } from "../services/escrow-timeout.service"

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000
const intervalMs = Number.parseInt(
	process.env.ESCROW_TIMEOUT_CRON_INTERVAL_MS || "",
	10,
)
const pollEveryMs =
	Number.isFinite(intervalMs) && intervalMs > 0
		? intervalMs
		: DEFAULT_INTERVAL_MS

let timer: NodeJS.Timeout | null = null

export async function startEscrowTimeoutWorker(): Promise<void> {
	if (timer) {
		return
	}

	console.log(`[escrow-timeout] Worker started (interval=${pollEveryMs}ms)`)

	await processEscrowTimeouts()

	timer = setInterval(() => {
		void processEscrowTimeouts()
	}, pollEveryMs)
}

export function stopEscrowTimeoutWorker(): void {
	if (timer) {
		clearInterval(timer)
		timer = null
	}
	console.log("[escrow-timeout] Worker stopped")
}
