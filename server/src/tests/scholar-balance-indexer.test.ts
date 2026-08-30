/**
 * Indexer pipeline tests.
 *
 * The store is replaced with an in-memory journal that enforces the same
 * exactly-once contract as the SQL (one row per Soroban event id, deltas summed
 * per address). That keeps the tests off a database while still exercising the
 * property the whole design rests on: replaying a ledger range must not move a
 * balance twice.
 */

import type { LrnBalanceDelta } from "../lib/lrn-events"

const LEARN_TOKEN_CONTRACT = "CLEARNTOKEN000000000000000000000000000000000000000000000"
const SCHOLAR_A = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ"
const SCHOLAR_B = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H"

const mockGetEvents = jest.fn()
const mockGetLatestLedger = jest.fn()

jest.mock("@stellar/stellar-sdk", () => ({
	rpc: {
		Server: jest.fn(() => ({
			getEvents: mockGetEvents,
			getLatestLedger: mockGetLatestLedger,
		})),
	},
	scValToNative: (value: { __native: unknown }) => value.__native,
	xdr: {
		ScVal: class ScVal {
			static scvSymbol(name: string) {
				return { toXDR: () => `symbol:${name}` }
			}
		},
	},
}))

jest.mock("../lib/event-config", () => ({
	SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org",
	CONTRACT_IDS: { learnToken: LEARN_TOKEN_CONTRACT },
	INDEXER_CONFIG: { startingLedger: 50, pollIntervalMs: 5000, batchSize: 100 },
}))

// In-memory stand-in for db/scholar-balance-store, mirroring its guarantees.
const journal = new Map<string, LrnBalanceDelta>()
const balances = new Map<string, bigint>()

const mockApplyLrnBalanceDeltas = jest.fn(async (deltas: LrnBalanceDelta[]) => {
	const touched = new Set<string>()
	let applied = 0

	for (const delta of deltas) {
		if (journal.has(delta.eventId)) continue
		journal.set(delta.eventId, delta)
		balances.set(
			delta.address,
			(balances.get(delta.address) ?? 0n) + delta.delta,
		)
		touched.add(delta.address)
		applied++
	}

	return {
		applied,
		duplicates: deltas.length - applied,
		balances: [...touched].map((address) => ({
			address,
			lrnBalance: balances.get(address) ?? 0n,
		})),
	}
})

const mockGetJournalMaxLedger = jest.fn(async () => null as number | null)

jest.mock("../db/scholar-balance-store", () => ({
	applyLrnBalanceDeltas: (deltas: LrnBalanceDelta[]) =>
		mockApplyLrnBalanceDeltas(deltas),
	getJournalMaxLedger: () => mockGetJournalMaxLedger(),
	rebuildScholarBalances: jest.fn(),
}))

const mockUpdateIndexerState = jest.fn()
const mockGetLastIndexedLedger = jest.fn(async (_contract: string) => 0)

jest.mock("../services/event-indexer.service", () => ({
	updateIndexerState: (contract: string, ledger: number) =>
		mockUpdateIndexerState(contract, ledger),
	getLastIndexedLedger: (contract: string) => mockGetLastIndexedLedger(contract),
}))

const mockInvalidate = jest.fn()
jest.mock("../lib/rpc-cache", () => ({
	getRpcCache: () => ({ invalidate: mockInvalidate }),
	CacheKey: {
		learnBalance: (addr: string) => `balance:lrn:${addr}`,
		votingPower: (addr: string) => `voting_power:${addr}`,
	},
}))

const mockEmitUpdate = jest.fn()
jest.mock("../lib/leaderboard-emitter", () => ({
	leaderboardEmitter: { emitUpdate: mockEmitUpdate },
}))

import {
	getLrnBalanceCheckpoint,
	indexLrnBalanceEvents,
	syncLrnBalances,
} from "../services/scholar-balance-indexer.service"

const CHECKPOINT_KEY = `${LEARN_TOKEN_CONTRACT}:lrn_balances`

function mint(index: number, address: string, amount: bigint, ledger = 100) {
	return {
		id: `${ledger}-tx${index}-${index}`,
		ledger,
		ledgerClosedAt: "2026-01-01T00:00:00Z",
		topic: ["lrn_mint", address],
		value: amount,
	}
}

function burn(index: number, address: string, amount: bigint, ledger = 101) {
	return {
		id: `${ledger}-tx${index}-${index}`,
		ledger,
		topic: ["lrn_burned"],
		value: { from: address, amount },
	}
}

/** A single page with no continuation. */
function page(events: unknown[], cursor?: string) {
	return { events, cursor, latestLedger: 200 }
}

beforeEach(() => {
	jest.clearAllMocks()
	journal.clear()
	balances.clear()
	mockGetLastIndexedLedger.mockResolvedValue(0)
	mockGetJournalMaxLedger.mockResolvedValue(null)
})

describe("indexLrnBalanceEvents", () => {
	it("applies mints and burns as signed deltas", async () => {
		mockGetEvents.mockResolvedValueOnce(
			page([
				mint(1, SCHOLAR_A, 1_000n),
				mint(2, SCHOLAR_B, 400n),
				burn(3, SCHOLAR_A, 250n),
			]),
		)

		const result = await indexLrnBalanceEvents({
			startLedger: 100,
			endLedger: 150,
		})

		expect(result).toMatchObject({
			scanned: 3,
			applied: 3,
			duplicates: 0,
			malformed: 0,
		})
		expect(balances.get(SCHOLAR_A)).toBe(750n)
		expect(balances.get(SCHOLAR_B)).toBe(400n)
	})

	it("is idempotent when the same range is replayed", async () => {
		const events = [mint(1, SCHOLAR_A, 1_000n), burn(2, SCHOLAR_A, 400n)]
		mockGetEvents.mockResolvedValue(page(events))

		await indexLrnBalanceEvents({ startLedger: 100, endLedger: 150 })
		const replay = await indexLrnBalanceEvents({
			startLedger: 100,
			endLedger: 150,
		})

		expect(replay.applied).toBe(0)
		expect(replay.duplicates).toBe(2)
		expect(balances.get(SCHOLAR_A)).toBe(600n)
	})

	it("collapses an event delivered twice inside one page", async () => {
		const duplicated = mint(1, SCHOLAR_A, 1_000n)
		mockGetEvents.mockResolvedValueOnce(page([duplicated, duplicated]))

		await indexLrnBalanceEvents({ startLedger: 100, endLedger: 150 })

		expect(balances.get(SCHOLAR_A)).toBe(1_000n)
	})

	it("checkpoints the end of the requested range, not the last event's ledger", async () => {
		mockGetEvents.mockResolvedValueOnce(page([mint(1, SCHOLAR_A, 10n, 100)]))

		await indexLrnBalanceEvents({ startLedger: 100, endLedger: 150 })

		// Checkpointing ledger 100 would rescan 101-150 on every tick forever.
		expect(mockUpdateIndexerState).toHaveBeenCalledWith(CHECKPOINT_KEY, 150)
	})

	it("follows the cursor until a short page arrives", async () => {
		const fullPage = Array.from({ length: 200 }, (_, i) =>
			mint(i, SCHOLAR_A, 1n, 100),
		)
		mockGetEvents
			.mockResolvedValueOnce(page(fullPage, "cursor-1"))
			.mockResolvedValueOnce(page([mint(999, SCHOLAR_B, 5n, 101)]))

		const result = await indexLrnBalanceEvents({
			startLedger: 100,
			endLedger: 150,
		})

		expect(result.scanned).toBe(201)
		expect(mockGetEvents).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ cursor: "cursor-1" }),
		)
		// A cursor carries its own position; sending a start ledger with it errors.
		expect(mockGetEvents.mock.calls[1][0]).not.toHaveProperty("startLedger")
	})

	it("stops instead of looping when the RPC repeats a cursor", async () => {
		const fullPage = Array.from({ length: 200 }, (_, i) =>
			mint(i, SCHOLAR_A, 1n, 100),
		)
		mockGetEvents.mockResolvedValue(page(fullPage, "cursor-1"))

		await indexLrnBalanceEvents({ startLedger: 100, endLedger: 150 })

		expect(mockGetEvents).toHaveBeenCalledTimes(2)
	})

	it("resumes from the oldest retained ledger when the range has aged out", async () => {
		mockGetEvents
			.mockRejectedValueOnce(
				new Error("startLedger must be within the ledger range: 900 - 1200"),
			)
			.mockResolvedValueOnce(page([mint(1, SCHOLAR_A, 10n, 950)]))

		const result = await indexLrnBalanceEvents({
			startLedger: 100,
			endLedger: 1200,
		})

		expect(mockGetEvents).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ startLedger: 900 }),
		)
		expect(result.applied).toBe(1)
	})

	it("propagates RPC failures it cannot interpret", async () => {
		mockGetEvents.mockRejectedValueOnce(new Error("connection refused"))

		await expect(
			indexLrnBalanceEvents({ startLedger: 100, endLedger: 150 }),
		).rejects.toThrow("connection refused")
		expect(mockUpdateIndexerState).not.toHaveBeenCalled()
	})

	it("counts undecodable events without letting them touch a balance", async () => {
		mockGetEvents.mockResolvedValueOnce(
			page([mint(1, SCHOLAR_A, 100n), { ...mint(2, SCHOLAR_A, 0n) }]),
		)

		const result = await indexLrnBalanceEvents({
			startLedger: 100,
			endLedger: 150,
		})

		expect(result).toMatchObject({ applied: 1, malformed: 1 })
		expect(balances.get(SCHOLAR_A)).toBe(100n)
	})

	it("invalidates cached reads and wakes leaderboard subscribers", async () => {
		mockGetEvents.mockResolvedValueOnce(page([mint(1, SCHOLAR_A, 100n)]))

		await indexLrnBalanceEvents({ startLedger: 100, endLedger: 150 })

		expect(mockInvalidate).toHaveBeenCalledWith(`balance:lrn:${SCHOLAR_A}`)
		expect(mockInvalidate).toHaveBeenCalledWith(`voting_power:${SCHOLAR_A}`)
		expect(mockEmitUpdate).toHaveBeenCalledTimes(1)
	})

	it("leaves the checkpoint alone when asked not to persist it", async () => {
		mockGetEvents.mockResolvedValueOnce(page([mint(1, SCHOLAR_A, 100n)]))

		await indexLrnBalanceEvents({
			startLedger: 100,
			endLedger: 150,
			persistCheckpoint: false,
		})

		expect(mockUpdateIndexerState).not.toHaveBeenCalled()
	})
})

describe("getLrnBalanceCheckpoint", () => {
	it("prefers the persisted indexer state", async () => {
		mockGetLastIndexedLedger.mockResolvedValue(1_234)
		await expect(getLrnBalanceCheckpoint()).resolves.toBe(1_234)
		expect(mockGetLastIndexedLedger).toHaveBeenCalledWith(CHECKPOINT_KEY)
	})

	it("falls back to the journal high-water mark", async () => {
		mockGetLastIndexedLedger.mockResolvedValue(0)
		mockGetJournalMaxLedger.mockResolvedValue(777)
		await expect(getLrnBalanceCheckpoint()).resolves.toBe(777)
	})

	it("falls back to the configured starting ledger on a cold start", async () => {
		mockGetLastIndexedLedger.mockResolvedValue(0)
		mockGetJournalMaxLedger.mockResolvedValue(null)
		await expect(getLrnBalanceCheckpoint()).resolves.toBe(50)
	})
})

describe("syncLrnBalances", () => {
	it("resumes at the ledger after the checkpoint", async () => {
		mockGetLastIndexedLedger.mockResolvedValue(500)
		mockGetEvents.mockResolvedValueOnce(page([]))

		await syncLrnBalances(600)

		expect(mockGetEvents).toHaveBeenCalledWith(
			expect.objectContaining({ startLedger: 501, endLedger: 600 }),
		)
	})

	it("does nothing when the checkpoint is already at the head", async () => {
		mockGetLastIndexedLedger.mockResolvedValue(600)

		await expect(syncLrnBalances(600)).resolves.toBeNull()
		expect(mockGetEvents).not.toHaveBeenCalled()
	})
})
