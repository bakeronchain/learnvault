/**
 * Tests for src/util/usdc.ts
 *
 * getUSDCBalance is tested by mocking @stellar/stellar-sdk so we can exercise
 * all code paths without a live RPC node.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Helpers to build minimal ScVal / simulation response mocks
// ---------------------------------------------------------------------------

const makeI128ScVal = (lo: bigint, hi: bigint = 0n) => ({
	switch: () => ({ name: "scvI128" }),
	i128: () => ({
		lo: () => ({ toString: () => lo.toString() }),
		hi: () => ({ toString: () => hi.toString() }),
	}),
})

const makeSimSuccess = (retval: unknown) => ({
	result: { retval },
})

const makeSimError = () => ({
	error: "contract not found",
})

// ---------------------------------------------------------------------------
// Mock @stellar/stellar-sdk
// ---------------------------------------------------------------------------

const mockSimulate = vi.fn()
const mockGetAccount = vi.fn()

vi.mock("@stellar/stellar-sdk", async () => {
	const actual = await vi.importActual<any>("@stellar/stellar-sdk")
	return {
		...actual,
		Contract: class {
			call(_method: string, ..._args: unknown[]) {
				return { type: "invokeHostFunction" }
			}
		},
		SorobanRpc: {
			...actual.SorobanRpc,
			Server: class {
				simulateTransaction = mockSimulate
				getAccount = mockGetAccount
			},
			Api: {
				isSimulationError: (r: unknown) =>
					typeof r === "object" && r !== null && "error" in r,
			},
		},
		TransactionBuilder: class {
			constructor(_account: unknown, _opts: unknown) {}
			addOperation(_op: unknown) {
				return this
			}
			setTimeout(_t: number) {
				return this
			}
			build() {
				return {}
			}
		},
		BASE_FEE: "100",
		StrKey: {
			decodeEd25519PublicKey: (_addr: string) => new Uint8Array(32),
		},
		scValToNative: (val: unknown) => val,
	}
})

// Mock contracts/util so rpcUrl / networkPassphrase are stable
vi.mock("../contracts/util", () => ({
	rpcUrl: "http://localhost:8000/rpc",
	networkPassphrase: "Test SDF Network ; September 2015",
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const TEST_ADDRESS = "GTEST1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO"
const TEST_CONTRACT = "CUSDC1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO"

describe("getUSDCContractId", () => {
	it("returns undefined when env var is not set", async () => {
		vi.stubEnv("PUBLIC_USDC_CONTRACT_ID", "")
		vi.stubEnv("VITE_USDC_CONTRACT_ID", "")
		const { getUSDCContractId } = await import("./usdc")
		expect(getUSDCContractId()).toBeUndefined()
	})

	it("returns the contract id when PUBLIC_ prefix is set", async () => {
		vi.stubEnv("PUBLIC_USDC_CONTRACT_ID", TEST_CONTRACT)
		const { getUSDCContractId } = await import("./usdc")
		expect(getUSDCContractId()).toBe(TEST_CONTRACT)
	})
})

describe("getUSDCBalance", () => {
	beforeEach(() => {
		vi.resetModules()
		vi.stubEnv("PUBLIC_USDC_CONTRACT_ID", TEST_CONTRACT)
		mockGetAccount.mockResolvedValue({
			accountId: () => TEST_ADDRESS,
			sequenceNumber: () => "0",
			incrementSequenceNumber: () => {},
		})
	})

	it("returns 0n when contract ID is not configured", async () => {
		vi.stubEnv("PUBLIC_USDC_CONTRACT_ID", "")
		vi.stubEnv("VITE_USDC_CONTRACT_ID", "")
		vi.resetModules()
		const { getUSDCBalance } = await import("./usdc")
		const result = await getUSDCBalance(TEST_ADDRESS)
		expect(result).toBe(0n)
	})

	it("returns 0n when the account does not exist on-chain", async () => {
		mockGetAccount.mockResolvedValue(null)
		const { getUSDCBalance } = await import("./usdc")
		const result = await getUSDCBalance(TEST_ADDRESS)
		expect(result).toBe(0n)
	})

	it("returns 0n when simulation returns an error (contract not deployed)", async () => {
		mockSimulate.mockResolvedValue(makeSimError())
		const { getUSDCBalance } = await import("./usdc")
		const result = await getUSDCBalance(TEST_ADDRESS)
		expect(result).toBe(0n)
	})

	it("returns 0n when simulation result has no retval", async () => {
		mockSimulate.mockResolvedValue({ result: { retval: undefined } })
		const { getUSDCBalance } = await import("./usdc")
		const result = await getUSDCBalance(TEST_ADDRESS)
		expect(result).toBe(0n)
	})

	it("decodes an i128 ScVal correctly (small balance)", async () => {
		// 1000_0000000 = 1000 USDC with 7 decimal places
		const raw = 10_000_000_000n
		mockSimulate.mockResolvedValue(makeSimSuccess(makeI128ScVal(raw)))
		const { getUSDCBalance } = await import("./usdc")
		const result = await getUSDCBalance(TEST_ADDRESS)
		expect(result).toBe(raw)
	})

	it("decodes an i128 ScVal with high bits set", async () => {
		const lo = 0n
		const hi = 1n // represents 2^64
		mockSimulate.mockResolvedValue(makeSimSuccess(makeI128ScVal(lo, hi)))
		const { getUSDCBalance } = await import("./usdc")
		const result = await getUSDCBalance(TEST_ADDRESS)
		expect(result).toBe((hi << 64n) | lo)
	})

	it("returns 0n and does not throw when RPC call rejects", async () => {
		mockSimulate.mockRejectedValue(new Error("network error"))
		const { getUSDCBalance } = await import("./usdc")
		await expect(getUSDCBalance(TEST_ADDRESS)).resolves.toBe(0n)
	})
})
