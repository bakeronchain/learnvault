import { rpc } from "@stellar/stellar-sdk" // dynamic later
import { INDEXER_CONFIG, getPollingTargets } from "../lib/event-config"
import { logger } from "../lib/logger"
import {
	getLastIndexedLedger,
	indexEventsBatch,
} from "../services/event-indexer.service"

const log = logger.child({ module: "poller" })

let pollInterval: NodeJS.Timeout | null = null

export async function startEventPoller (): Promise<void> {
	log.info("Starting event indexer")

	// Get global latest ledger
	const network = new rpc.Server(process.env.SOROBAN_RPC_URL!)
	const info = await network.getLatestLedger()
	let currentLedger = Number(info.sequence)

	pollInterval = setInterval(async () => {
		try {
			const newInfo = await network.getLatestLedger()
			const latestLedger = Number(newInfo.sequence)

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
			log.error({ err }, "Poll failed")
		}
	}, INDEXER_CONFIG.pollIntervalMs)

	log.info(
		{
			intervalMs: INDEXER_CONFIG.pollIntervalMs,
			batchSize: INDEXER_CONFIG.batchSize,
			startingLedger: INDEXER_CONFIG.startingLedger,
		},
		"Poller running",
	)
}

export function stopEventPoller (): void {
	if (pollInterval) {
		clearInterval(pollInterval)
		pollInterval = null
	}
	log.info("Poller stopped")
}

// Graceful shutdown
process.on("SIGTERM", stopEventPoller)
process.on("SIGINT", stopEventPoller)
