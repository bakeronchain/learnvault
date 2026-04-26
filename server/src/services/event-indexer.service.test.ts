import { type Pool } from "pg"
import {
	indexEventsBatch,
	getLastIndexedLedger,
	updateIndexerState,
	getAllIndexerState,
} from "./event-indexer.service"

// Mock the pool
const mockQuery = jest.fn()
const mockPool = {
	query: mockQuery,
} as unknown as Pool

jest.mock("pg", () => ({
	Pool: jest.fn(() => mockPool),
}))

// Mock the leaderboard emitter
const mockEmitUpdate = jest.fn()
jest.mock("../lib/leaderboard-emitter", () => ({
	leaderboardEmitter: {
		emitUpdate: mockEmitUpdate,
	},
}))

// Mock event config
jest.mock("../lib/event-config", () => ({
	SOROBAN_RPC_URL: "https://testnet.sorobanrpc.com",
	INDEXER_CONFIG: {
		startingLedger: 0,
		pollIntervalMs: 5000,
		batchSize: 100,
	},
	getPollingTargets: () => [
		{
			contractId: "test-contract",
			topics: ["TestEvent"],
		},
	],
}))

// Mock Stellar SDK
const mockGetEvents = jest.fn()
jest.mock("@stellar/stellar-sdk", () => ({
	rpc: {
		Server: jest.fn(() => ({
			getEvents: mockGetEvents,
		})),
		Api: {
			EventFilter: {},
		},
	},
}))

describe("event-indexer.service", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		mockQuery.mockReset()
	})

	describe("getLastIndexedLedger", () => {
		it("should return ledger from indexer_state when available", async () => {
			mockQuery.mockResolvedValueOnce({
				rows: [{ last_processed_ledger: 1000 }],
			})

			const ledger = await getLastIndexedLedger("test-contract")
			expect(ledger).toBe(1000)
			expect(mockQuery).toHaveBeenCalledWith(
				"SELECT last_processed_ledger FROM indexer_state WHERE contract = $1",
				["test-contract"],
			)
		})

		it("should fallback to events table when indexer_state is empty", async () => {
			mockQuery
				.mockResolvedValueOnce({ rows: [] }) // No indexer_state
				.mockResolvedValueOnce({ rows: [{ max: 500 }] }) // Events table has max 500

			const ledger = await getLastIndexedLedger("test-contract")
			expect(ledger).toBe(500)
		})

		it("should fallback to INDEXER_CONFIG.startingLedger when no data exists", async () => {
			mockQuery
				.mockResolvedValueOnce({ rows: [] })
				.mockResolvedValueOnce({ rows: [{ max: null }] })

			const ledger = await getLastIndexedLedger("test-contract")
			expect(ledger).toBe(0)
		})
	})

	describe("updateIndexerState", () => {
		it("should upsert indexer state", async () => {
			mockQuery.mockResolvedValueOnce({ rows: [] })

			await updateIndexerState("test-contract", 1500)

			expect(mockQuery).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO indexer_state"),
				["test-contract", 1500],
			)
		})
	})

	describe("getAllIndexerState", () => {
		it("should return all indexer state entries", async () => {
			mockQuery.mockResolvedValueOnce({
				rows: [
					{
						contract: "contract1",
						last_processed_ledger: 1000,
						last_processed_at: new Date("2024-01-01"),
						updated_at: new Date("2024-01-02"),
					},
					{
						contract: "contract2",
						last_processed_ledger: 2000,
						last_processed_at: new Date("2024-01-03"),
						updated_at: new Date("2024-01-04"),
					},
				],
			})

			const state = await getAllIndexerState()

			expect(state).toHaveLength(2)
			expect(state[0].contract).toBe("contract1")
			expect(state[1].contract).toBe("contract2")
		})
	})

	describe("indexEventsBatch - idempotency", () => {
		const mockEvent = {
			id: "00001000-testtxhash-0",
			type: "contract",
			ledger: "1000",
			topic: [["TestEvent"]],
			value: { data: "test" },
		}

		beforeEach(() => {
			mockGetEvents.mockResolvedValue({
				events: [mockEvent],
			})
			// Mock pool.query for UPSERT
			mockQuery.mockResolvedValue({ rows: [{ id: 1 }] })
		})

		it("should use UPSERT with ON CONFLICT DO NOTHING", async () => {
			await indexEventsBatch(1000, 1001)

			// Find the INSERT query call
			const insertCall = mockQuery.mock.calls.find(
				(call) =>
					typeof call[0] === "string" &&
					call[0].includes("INSERT INTO events") &&
					call[0].includes("ON CONFLICT"),
			)

			expect(insertCall).toBeDefined()
			expect(insertCall[0]).toContain(
				"ON CONFLICT (ledger_sequence, tx_hash, event_index) DO NOTHING",
			)
		})

		it("should insert new events and skip duplicates (idempotent processing)", async () => {
			// First call - new event, should insert (rowCount > 0)
			mockQuery
				.mockResolvedValueOnce({ rows: [{ id: 1 }] }) // UPSERT returns new row
				.mockResolvedValueOnce({ rows: [] }) // updateIndexerState

			await indexEventsBatch(1000, 1001)

			// Should emit update for new events
			expect(mockEmitUpdate).toHaveBeenCalled()

			// Reset mocks for second call
			jest.clearAllMocks()

			// Second call - same event, should skip (rowCount = 0)
			mockQuery
				.mockResolvedValueOnce({ rows: [] }) // UPSERT returns no rows (duplicate)
				.mockResolvedValueOnce({ rows: [] }) // updateIndexerState

			mockGetEvents.mockResolvedValue({
				events: [mockEvent],
			})

			await indexEventsBatch(1000, 1001)

			// Should NOT emit update for duplicates
			expect(mockEmitUpdate).not.toHaveBeenCalled()
		})

		it("should extract tx_hash and event_index from event ID", async () => {
			await indexEventsBatch(1000, 1001)

			const insertCall = mockQuery.mock.calls.find(
				(call) =>
					typeof call[0] === "string" && call[0].includes("INSERT INTO events"),
			)

			// Check that tx_hash and event_index are extracted from "00001000-testtxhash-0"
			// Parameters: [contractId, topic, data, ledger, txHash, eventIndex]
			const params = insertCall[1]
			expect(params[4]).toBe("testtxhash") // tx_hash
			expect(params[5]).toBe(0) // event_index
		})

		it("should update indexer_state after processing batch", async () => {
			await indexEventsBatch(1000, 1001)

			// Should have called updateIndexerState
			const stateCall = mockQuery.mock.calls.find(
				(call) =>
					typeof call[0] === "string" &&
					call[0].includes("INSERT INTO indexer_state"),
			)

			expect(stateCall).toBeDefined()
			expect(stateCall[1]).toEqual(["test-contract", 1000])
		})
	})

	describe("process same event batch twice", () => {
		it("should verify no duplicate records on reprocessing", async () => {
			const mockEvent = {
				id: "00001000-testtxhash-0",
				type: "contract",
				ledger: "1000",
				topic: [["TestEvent"]],
				value: { data: "test" },
			}

			mockGetEvents.mockResolvedValue({
				events: [mockEvent],
			})

			// First processing - event inserted
			mockQuery
				.mockResolvedValueOnce({ rows: [{ id: 1 }] }) // First event - inserted
				.mockResolvedValueOnce({ rows: [] }) // updateIndexerState

			await indexEventsBatch(1000, 1001)

			const firstInsertCall = mockQuery.mock.calls.find(
				(call) =>
					typeof call[0] === "string" && call[0].includes("INSERT INTO events"),
			)
			expect(firstInsertCall[1][4]).toBe("testtxhash") // Verify tx_hash is correct

			// Reset and process same batch again
			jest.clearAllMocks()

			mockQuery
				.mockResolvedValueOnce({ rows: [] }) // UPSERT returns nothing - duplicate
				.mockResolvedValueOnce({ rows: [] }) // updateIndexerState

			mockGetEvents.mockResolvedValue({
				events: [mockEvent],
			})

			await indexEventsBatch(1000, 1001)

			// The second INSERT should return no rows (ON CONFLICT DO NOTHING)
			const secondInsertCall = mockQuery.mock.calls.find(
				(call) =>
					typeof call[0] === "string" && call[0].includes("INSERT INTO events"),
			)
			expect(secondInsertCall).toBeDefined()
			// The ON CONFLICT DO NOTHING should have been triggered
			expect(secondInsertCall[0]).toContain("ON CONFLICT")
		})
	})
})
