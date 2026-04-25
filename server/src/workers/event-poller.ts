import { rpc } from "@stellar/stellar-sdk" // dynamic later
import { INDEXER_CONFIG, getPollingTargets } from "../lib/event-config"
import {
	indexEventsBatch,
	getLastIndexedLedger,
} from "../services/event-indexer.service"

let pollInterval: NodeJS.Timeout | null = null

export async function startEventPoller(): Promise<void> {
	console.log("[poller] Starting event indexer...")

	// Get global latest ledger
	const network = new rpc.Server(process.env.SOROBAN_RPC_URL!)
	const info = await network.getNetwork()
	let currentLedger = Number(info.ledger)

	pollInterval = setInterval(async () => {
		try {
			const newInfo = await network.getNetwork()
			const latestLedger = Number(newInfo.ledger)

			if (currentLedger >= latestLedger) return

			// Simple: poll from current to latest in batches
			const batchSize = INDEXER_CONFIG.batchSize
			for (
				let start = currentLedger + 1;
				start <= latestLedger;
				start += batchSize
			) {
				const end = Math.min(start + batchSize - 1, latestLedger)
				await indexEventsBatch(start, end)
			}

			currentLedger = latestLedger
		} catch (err) {
			console.error("[poller] Poll failed:", err)
		}
	}, INDEXER_CONFIG.pollIntervalMs)

	console.log(
		`[poller] Running - poll ${INDEXER_CONFIG.pollIntervalMs}ms, batch ${INDEXER_CONFIG.batchSize}, from ledger ${INDEXER_CONFIG.startingLedger}`,
	)
}

export function stopEventPoller(): void {
	if (pollInterval) {
		clearInterval(pollInterval)
		pollInterval = null
	}
	console.log("[poller] Stopped")
}

// Graceful shutdown
process.on("SIGTERM", stopEventPoller)
process.on("SIGINT", stopEventPoller)
