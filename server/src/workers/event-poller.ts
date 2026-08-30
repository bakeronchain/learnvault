import { rpc } from "@stellar/stellar-sdk"
import { INDEXER_CONFIG, SOROBAN_RPC_URL } from "../lib/event-config"
import { logger } from "../lib/logger"
import { indexEventsBatch } from "../services/event-indexer.service"
import { syncLrnBalances } from "../services/scholar-balance-indexer.service"

const log = logger.child({ module: "poller" })

let pollInterval: NodeJS.Timeout | null = null

export async function startEventPoller(): Promise<void> {
	log.info("Starting event indexer")

	const network = new rpc.Server(SOROBAN_RPC_URL)
	let currentLedger = (await network.getLatestLedger()).sequence

	pollInterval = setInterval(async () => {
		try {
			const latestLedger = (await network.getLatestLedger()).sequence

			// The LRN balance projection resumes from its own persisted checkpoint
			// rather than from `currentLedger`, so a restart replays whatever the
			// process missed while it was down instead of starting at the head.
			await syncLrnBalances(latestLedger).catch((err) =>
				log.error({ err }, "LRN balance sync failed"),
			)

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

export function stopEventPoller(): void {
	if (pollInterval) {
		clearInterval(pollInterval)
		pollInterval = null
	}
	log.info("Poller stopped")
}

// Graceful shutdown
process.on("SIGTERM", stopEventPoller)
process.on("SIGINT", stopEventPoller)
