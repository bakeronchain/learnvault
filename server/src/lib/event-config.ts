// Event configuration and helpers
import {
	CONTRACT_IDS,
	EVENTS_TO_INDEX,
	EVENT_TOPICS,
	type ContractName,
} from "../types/events"

// Re-export types/constants for reuse by consumers
export {
	type ContractName,
	type EventTopic,
	type EventTopicValue,
	type ApiEvent,
	CONTRACT_IDS,
	EVENTS_TO_INDEX,
	EVENT_DATA_SCHEMAS,
	DB_EVENT_SCHEMA,
} from "../types/events"

// Soroban RPC endpoints
export const SOROBAN_RPC_URL =
	process.env.SOROBAN_RPC_URL ??
	(process.env.STELLAR_NETWORK === "mainnet"
		? "https://soroban-rpc.stellar.org"
		: "https://soroban-testnet.stellar.org")

// Indexer config
export const INDEXER_CONFIG = {
	startingLedger: Number(process.env.STARTING_LEDGER ?? "0"),
	pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? "5000"),
	batchSize: 100, // ledgers per poll
} as const

// Helper to get flat list of {contractId, topics[]} for polling
export function getPollingTargets(): Array<{
	contractId: string
	topics: string[]
}> {
	return (Object.entries(CONTRACT_IDS) as Array<[ContractName, string]>)
		.map(([name, id]) => ({
			contractId: id,
			topics: (EVENTS_TO_INDEX[name] ?? []).map((topic) => EVENT_TOPICS[topic]),
		}))
		.filter(
			(t) =>
				t.topics.length > 0 &&
				typeof t.contractId === "string" &&
				t.contractId.length > 0,
		)
}
