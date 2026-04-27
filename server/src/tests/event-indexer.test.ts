import { rpc as StellarRpc } from "@stellar/stellar-sdk"
import { Pool } from "pg"
import { leaderboardEmitter } from "../lib/leaderboard-emitter"
import {
	indexEventsBatch,
	getLastIndexedLedger,
} from "../services/event-indexer.service"
import { startEventPoller, stopEventPoller } from "../workers/event-poller"

// --- Mocks Setup ---

const mockQuery = jest.fn()
jest.mock("pg", () => {
	return {
		Pool: jest.fn(() => ({
			query: (...args: any[]) => mockQuery(...args),
		})),
	}
})

const mockGetEvents = jest.fn()
const mockGetNetwork = jest.fn()
const mockGetLatestLedger = jest.fn()
jest.mock("@stellar/stellar-sdk", () => {
	return {
		rpc: {
			Server: jest.fn(() => ({
				getEvents: (...args: any[]) => mockGetEvents(...args),
				getNetwork: (...args: any[]) => mockGetNetwork(...args),
				getLatestLedger: (...args: any[]) => mockGetLatestLedger(...args),
			})),
		},
	}
})

jest.mock("../lib/leaderboard-emitter", () => ({
	leaderboardEmitter: {
		emitUpdate: jest.fn(),
	},
}))

jest.mock("../lib/event-config", () => ({
	SOROBAN_RPC_URL: "http://localhost:8000/soroban/rpc",
	INDEXER_CONFIG: {
		startingLedger: 100,
		batchSize: 50,
		pollIntervalMs: 1000, // Make it high enough so it doesn't run repeatedly during test
	},
	getPollingTargets: jest.fn(() => [
		{ contractId: "C123", topics: ["LearnToken_Mint", "Other_Topic"] },
	]),
}))

describe("Event Indexer & Poller Integration Tests", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		// Setup default successful mock returns
		mockQuery.mockResolvedValue({ rowCount: 0, rows: [] })
		mockGetEvents.mockResolvedValue({ events: [] })
		mockGetNetwork.mockResolvedValue({ passphrase: "Test" })
		mockGetLatestLedger.mockResolvedValue(1000)
	})

	afterEach(() => {
		stopEventPoller()
	})

	describe("Normal Operation", () => {
		it("should fetch events and insert them into the database", async () => {
			const mockEvent = {
				id: "ev1",
				type: "contract",
				ledger: "105",
			}

			// First getEvents call (for LearnToken_Mint) returns our mock event
			mockGetEvents.mockImplementationOnce(async () => ({
				events: [mockEvent],
			}))

			// Second getEvents call (for Other_Topic) returns empty
			mockGetEvents.mockImplementationOnce(async () => ({
				events: [],
			}))
			mockQuery
				.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] })
				.mockResolvedValueOnce({ rowCount: 0, rows: [] })

			await indexEventsBatch(100, 150)

			expect(mockGetEvents).toHaveBeenCalledTimes(2) // Once per topic

			// Check insertion query was called for the event payload
			expect(mockQuery).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO events"),
				[
					"C123",
					"LearnToken_Mint",
					{
						id: "ev1",
						type: "contract",
						ledger: "105",
						topic: undefined,
						value: undefined,
					},
					105,
					undefined,
					undefined,
				],
			)

			// Check leaderboard was updated
			expect(leaderboardEmitter.emitUpdate).toHaveBeenCalledTimes(1)
		})
	})

	describe("Duplicate Event Handling", () => {
		it("should skip duplicate events when idempotency check finds them", async () => {
			const mockEvent = { id: "ev1", type: "contract", ledger: "105" }
			mockGetEvents.mockImplementationOnce(async () => ({
				events: [mockEvent],
			}))
			mockGetEvents.mockImplementationOnce(async () => ({ events: [] }))

			// Simulate ON CONFLICT DO NOTHING for the event insert
			mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })

			await indexEventsBatch(100, 150)

			const eventInsertCalls = mockQuery.mock.calls.filter((call) =>
				call[0].includes("INSERT INTO events"),
			)
			expect(eventInsertCalls).toHaveLength(1)

			expect(leaderboardEmitter.emitUpdate).not.toHaveBeenCalled()
		})
	})

	describe("Network Failures", () => {
		it("should handle rpc errors gracefully without crashing", async () => {
			// Simulate RPC error
			mockGetEvents.mockRejectedValueOnce(new Error("RPC Timeout"))

			// Should not throw
			await indexEventsBatch(100, 150)
			expect(mockQuery).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO indexer_state"),
				["C123", 100],
			)
		})
	})

	describe("Restart Recovery", () => {
		it("should get the last indexed ledger from the database", async () => {
			mockQuery.mockResolvedValueOnce({
				rows: [{ last_processed_ledger: "205" }],
			})

			const ledger = await getLastIndexedLedger("C123")

			expect(mockQuery).toHaveBeenCalledWith(
				"SELECT last_processed_ledger FROM indexer_state WHERE contract = $1",
				["C123"],
			)
			expect(ledger).toBe(205)
		})

		it("should return the starting ledger from config if no events exist", async () => {
			mockQuery
				.mockResolvedValueOnce({ rows: [] })
				.mockResolvedValueOnce({ rows: [{ max: null }] })

			const ledger = await getLastIndexedLedger("C123")

			expect(ledger).toBe(100) // from mock INDEXER_CONFIG
		})
	})

	describe("Poller", () => {
		it("should start poller and fetch batches correctly", async () => {
			const logSpy = jest.spyOn(console, "log").mockImplementation(() => {})

			mockGetLatestLedger.mockResolvedValueOnce({ sequence: "100" }) // Initial latest
			mockGetLatestLedger.mockResolvedValueOnce({ sequence: "200" }) // Next latest

			jest.useFakeTimers()

			// We cannot await startEventPoller here completely if fake timers interfere,
			// but startEventPoller is async.
			// Let's just mock setInterval so we can run the callback directly.
			const mockSetInterval = jest.spyOn(global, "setInterval")

			await startEventPoller()

			// Run the callback directly
			const intervalCallback = mockSetInterval.mock.calls[0][0] as Function
			await intervalCallback()

			// indexEventsBatch should be called for the batches
			// From 101 to 200 in batches of 50 -> [101-150], [151-200]
			expect(mockGetEvents).toHaveBeenCalled()

			mockSetInterval.mockRestore()
			jest.useRealTimers()
			logSpy.mockRestore()
		})
	})
})
