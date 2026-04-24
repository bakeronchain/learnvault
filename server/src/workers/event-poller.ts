import { rpc } from "@stellar/stellar-sdk" // dynamic later
import { INDEXER_CONFIG, getPollingTargets } from "../lib/event-config"
import { logger } from "../lib/logger"
import {
	indexEventsBatch,
	getLastIndexedLedger,
	getAllIndexerState,
} from "../services/event-indexer.service"

const log = logger.child({ module: "poller" })

let pollInterval: NodeJS.Timeout | null = null

/**
 * Get the minimum starting ledger across all contracts
 * This ensures we don't miss any events for any contract on restart
 */
async function getMinStartingLedger(): Promise<number> {
	const targets = getPollingTargets()
	const ledgers = await Promise.all(
		targets.map(({ contractId }) => getLastIndexedLedger(contractId)),
	)

	// Return the minimum ledger, or fallback to config starting ledger
	const minLedger = Math.min(...ledgers)
	return minLedger === Infinity ? INDEXER_CONFIG.startingLedger : minLedger
}

export async function startEventPoller(): Promise<void> {
	log.info("Starting event indexer")

	const network = new rpc.Server(process.env.SOROBAN_RPC_URL!)

	// Get the minimum starting ledger from indexer state
	// This ensures we resume from where we left off on restart
	const startingLedger = await getMinStartingLedger()
	let currentLedger = startingLedger

	console.log(`[poller] Resuming from ledger ${startingLedger}`)

	// Log current indexer state for all contracts
	const indexerState = await getAllIndexerState()
	if (indexerState.length > 0) {
		console.log("[poller] Current indexer state:")
		for (const state of indexerState) {
			console.log(
				`  - ${state.contract}: ledger ${state.last_processed_ledger} (updated ${state.updated_at.toISOString()})`,
			)
		}
	}

	pollInterval = setInterval(async () => {
		try {
			const newInfo = await network.getLatestLedger()
			const latestLedger = Number(newInfo.sequence)

			if (currentLedger >= latestLedger) return

			// Poll from current to latest in batches
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
