import { logger } from "../lib/logger"
import { type DataRightsService } from "../services/data-rights.service"

const DEFAULT_INTERVAL_MS = 60_000
const configuredInterval = Number.parseInt(
	process.env.DATA_RIGHTS_WORKER_INTERVAL_MS ?? "",
	10,
)
const intervalMs =
	Number.isFinite(configuredInterval) && configuredInterval > 0
		? configuredInterval
		: DEFAULT_INTERVAL_MS

let timer: NodeJS.Timeout | null = null
const log = logger.child({ module: "data-rights-worker" })

async function processAvailableWork(service: DataRightsService): Promise<void> {
	try {
		while (await service.processNextExport()) {
			// Drain queued exports before sleeping.
		}
		while (await service.processNextDeletion()) {
			// Drain expired deletion requests before sleeping.
		}
	} catch (error) {
		log.error({ err: error }, "Data rights worker cycle failed")
	}
}

/** Starts the export and account-erasure background worker. */
export async function startDataRightsWorker(
	service: DataRightsService,
): Promise<void> {
	if (timer) return
	log.info({ intervalMs }, "Data rights worker started")
	await processAvailableWork(service)
	timer = setInterval(() => {
		void processAvailableWork(service)
	}, intervalMs)
}

export function stopDataRightsWorker(): void {
	if (!timer) return
	clearInterval(timer)
	timer = null
	log.info("Data rights worker stopped")
}
