import { rpc } from "@stellar/stellar-sdk" // dynamic later
import { INDEXER_CONFIG, getPollingTargets } from "../lib/event-config.js"
import { createLogger } from "../lib/logger"
import {
	getLastIndexedLedger,
	indexEventsBatch,
} from "../services/event-indexer.service.js"

const logger = createLogger("event-poller")

let pollInterval: NodeJS.Timeout | null = null

export async function startEventPoller(): Promise<void> {
	logger.info("Starting event indexer")

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
			logger.error("Poll failed", { error: err })
		}
	}, INDEXER_CONFIG.pollIntervalMs)

	logger.info("Event poller running", {
		pollIntervalMs: INDEXER_CONFIG.pollIntervalMs,
		batchSize: INDEXER_CONFIG.batchSize,
		startingLedger: INDEXER_CONFIG.startingLedger,
	})
}

export function stopEventPoller(): void {
	if (pollInterval) {
		clearInterval(pollInterval)
		pollInterval = null
	}
	logger.info("Stopped")
}

// Graceful shutdown
process.on("SIGTERM", stopEventPoller)
process.on("SIGINT", stopEventPoller)
