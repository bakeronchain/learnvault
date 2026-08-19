/**
 * Anchor cash-out service tests (#1053).
 *
 * No live network, no live anchor account — per the issue's own testing
 * note. StellarToml.Resolver.resolve, global.fetch, and the DB store are all
 * mocked; nothing here ever reaches a real network or database.
 */

jest.mock("@stellar/stellar-sdk", () => ({
	StellarToml: { Resolver: { resolve: jest.fn() } },
}))

jest.mock("../db/anchor-withdrawal-store", () => ({
	anchorWithdrawalStore: {
		insertWithdrawal: jest.fn(),
		updateWithdrawalStatus: jest.fn(),
		listWithdrawalsForLearner: jest.fn(),
		listIncompleteWithdrawals: jest.fn(),
	},
}))

import { StellarToml } from "@stellar/stellar-sdk"
import { anchorWithdrawalStore } from "../db/anchor-withdrawal-store"
import {
	AnchorNotAllowlistedError,
	getAnchorAuthChallenge,
	getFirmQuote,
	getIndicativePrice,
	initiateWithdrawal,
	isQuoteExpired,
	isTerminalStatus,
	listAnchorsForCountry,
	reconcileWithdrawal,
	submitAnchorAuth,
} from "../services/anchor.service"

const mockResolve = StellarToml.Resolver.resolve as jest.Mock
const ALLOWLISTED_DOMAIN = "testanchor.stellar.org"

const VALID_TOML = {
	TRANSFER_SERVER_SEP0024: "https://testanchor.stellar.org/sep24",
	ANCHOR_QUOTE_SERVER: "https://testanchor.stellar.org/sep38",
	WEB_AUTH_ENDPOINT: "https://testanchor.stellar.org/auth",
}

function mockFetchOnce(status: number, body: unknown): void {
	;(global.fetch as jest.Mock).mockResolvedValueOnce({
		ok: status >= 200 && status < 300,
		status,
		statusText: status === 200 ? "OK" : "Error",
		json: async () => body,
		text: async () => JSON.stringify(body),
	})
}

beforeEach(() => {
	jest.clearAllMocks()
	global.fetch = jest.fn()
	mockResolve.mockResolvedValue(VALID_TOML)
})

describe("allowlist enforcement", () => {
	const NOT_ALLOWLISTED = "evil-phishing-domain.example"

	it("rejects a non-allowlisted domain before any network call (auth challenge)", async () => {
		await expect(
			getAnchorAuthChallenge(NOT_ALLOWLISTED, "GLEARNER"),
		).rejects.toThrow(AnchorNotAllowlistedError)
		expect(mockResolve).not.toHaveBeenCalled()
		expect(global.fetch).not.toHaveBeenCalled()
	})

	it("rejects a non-allowlisted domain before any network call (submit auth)", async () => {
		await expect(
			submitAnchorAuth(NOT_ALLOWLISTED, "signed-xdr"),
		).rejects.toThrow(AnchorNotAllowlistedError)
		expect(global.fetch).not.toHaveBeenCalled()
	})

	it("rejects a non-allowlisted domain before any network call (quote)", async () => {
		await expect(
			getIndicativePrice(NOT_ALLOWLISTED, {
				sellAsset: "USDC",
				buyAsset: "NGN",
				sellAmount: "50",
			}),
		).rejects.toThrow(AnchorNotAllowlistedError)
		expect(global.fetch).not.toHaveBeenCalled()
	})

	it("rejects a non-allowlisted domain before any network call (withdraw)", async () => {
		await expect(
			initiateWithdrawal(NOT_ALLOWLISTED, {
				learnerAddr: "GLEARNER",
				assetCode: "USDC",
				assetOut: "NGN",
				amount: "50",
				anchorToken: "tok",
			}),
		).rejects.toThrow(AnchorNotAllowlistedError)
		expect(global.fetch).not.toHaveBeenCalled()
	})

	it("rejects a non-allowlisted domain before any network call (reconcile)", async () => {
		await expect(
			reconcileWithdrawal(NOT_ALLOWLISTED, "tx-1", "tok"),
		).rejects.toThrow(AnchorNotAllowlistedError)
		expect(global.fetch).not.toHaveBeenCalled()
	})

	it("proceeds (past the allowlist check) for an allowlisted domain", async () => {
		mockFetchOnce(200, { transaction: "xdr", network_passphrase: "Test" })
		await expect(
			getAnchorAuthChallenge(ALLOWLISTED_DOMAIN, "GLEARNER"),
		).resolves.toEqual({ transaction: "xdr", network_passphrase: "Test" })
	})
})

describe("listAnchorsForCountry", () => {
	it("returns allowlisted anchors serving the given country, enriched from stellar.toml", async () => {
		const anchors = await listAnchorsForCountry("NG")
		expect(anchors).toEqual([
			expect.objectContaining({
				domain: ALLOWLISTED_DOMAIN,
				transferServerSep24: VALID_TOML.TRANSFER_SERVER_SEP0024,
				anchorQuoteServer: VALID_TOML.ANCHOR_QUOTE_SERVER,
				webAuthEndpoint: VALID_TOML.WEB_AUTH_ENDPOINT,
			}),
		])
	})

	it("returns an empty list for a country no allowlisted anchor serves", async () => {
		const anchors = await listAnchorsForCountry("FR")
		expect(anchors).toEqual([])
		expect(mockResolve).not.toHaveBeenCalled()
	})

	it("skips an anchor whose stellar.toml is unreachable instead of failing the whole list", async () => {
		mockResolve.mockRejectedValueOnce(new Error("network error"))
		const anchors = await listAnchorsForCountry("NG")
		expect(anchors).toEqual([])
	})
})

describe("SEP-10 anchor auth handshake", () => {
	it("getAnchorAuthChallenge fetches the anchor's WEB_AUTH_ENDPOINT with the account", async () => {
		mockFetchOnce(200, { transaction: "challenge-xdr", network_passphrase: "Test SDF Network" })

		const result = await getAnchorAuthChallenge(ALLOWLISTED_DOMAIN, "GLEARNER123")

		expect(result).toEqual({
			transaction: "challenge-xdr",
			network_passphrase: "Test SDF Network",
		})
		const [url] = (global.fetch as jest.Mock).mock.calls[0]
		expect(String(url)).toContain("testanchor.stellar.org/auth")
		expect(String(url)).toContain("account=GLEARNER123")
	})

	it("submitAnchorAuth posts the signed transaction and returns the anchor's token", async () => {
		mockFetchOnce(200, { token: "anchor-jwt" })

		const result = await submitAnchorAuth(ALLOWLISTED_DOMAIN, "signed-xdr")

		expect(result).toEqual({ token: "anchor-jwt" })
		const [, init] = (global.fetch as jest.Mock).mock.calls[0]
		expect(init.method).toBe("POST")
		expect(JSON.parse(init.body)).toEqual({ transaction: "signed-xdr" })
	})

	it("surfaces the anchor's error when auth submission fails", async () => {
		mockFetchOnce(401, { error: "bad signature" })
		await expect(
			submitAnchorAuth(ALLOWLISTED_DOMAIN, "signed-xdr"),
		).rejects.toThrow(/401/)
	})
})

describe("quotes", () => {
	it("getIndicativePrice calls GET /price with no Authorization header", async () => {
		mockFetchOnce(200, {
			total_price: "1500",
			price: "1500",
			sell_amount: "50",
			buy_amount: "75000",
			fee: { total: "0.5", asset: "USDC" },
		})

		const price = await getIndicativePrice(ALLOWLISTED_DOMAIN, {
			sellAsset: "USDC",
			buyAsset: "NGN",
			sellAmount: "50",
		})

		expect(price.buy_amount).toBe("75000")
		const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
		expect(String(url)).toContain("/sep38/price")
		expect(init?.headers).toBeUndefined()
	})

	it("getFirmQuote posts /quote with Bearer auth and returns id + expires_at", async () => {
		mockFetchOnce(200, {
			id: "quote-1",
			expires_at: "2099-01-01T00:00:00Z",
			total_price: "1500",
			price: "1500",
			sell_amount: "50",
			buy_amount: "75000",
			sell_asset: "USDC",
			buy_asset: "NGN",
			fee: { total: "0.5", asset: "USDC" },
		})

		const quote = await getFirmQuote(
			ALLOWLISTED_DOMAIN,
			{ sellAsset: "USDC", buyAsset: "NGN", sellAmount: "50" },
			"anchor-jwt",
		)

		expect(quote.id).toBe("quote-1")
		expect(quote.expires_at).toBe("2099-01-01T00:00:00Z")
		const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
		expect(String(url)).toContain("/sep38/quote")
		expect(init.headers.Authorization).toBe("Bearer anchor-jwt")
	})

	it("isQuoteExpired respects the quote's expiry", () => {
		const now = new Date("2026-01-15T12:00:00Z")
		expect(
			isQuoteExpired({ expires_at: "2026-01-15T11:59:59Z" }, now),
		).toBe(true)
		expect(
			isQuoteExpired({ expires_at: "2026-01-15T12:00:01Z" }, now),
		).toBe(false)
	})

	it("isQuoteExpired treats an unparseable expiry as expired (fail closed)", () => {
		expect(isQuoteExpired({ expires_at: "not-a-date" })).toBe(true)
	})
})

describe("initiateWithdrawal", () => {
	it("posts the interactive withdraw request and persists a row", async () => {
		mockFetchOnce(200, {
			type: "interactive_customer_info_needed",
			url: "https://testanchor.stellar.org/webapp?token=abc",
			id: "anchor-tx-1",
		})
		;(anchorWithdrawalStore.insertWithdrawal as jest.Mock).mockResolvedValue({
			id: 42,
		})

		const result = await initiateWithdrawal(ALLOWLISTED_DOMAIN, {
			learnerAddr: "GLEARNER",
			assetCode: "USDC",
			assetOut: "NGN",
			amount: "50",
			anchorToken: "anchor-jwt",
		})

		expect(result).toEqual({
			id: 42,
			transactionId: "anchor-tx-1",
			url: "https://testanchor.stellar.org/webapp?token=abc",
		})
		expect(anchorWithdrawalStore.insertWithdrawal).toHaveBeenCalledWith(
			expect.objectContaining({
				learnerAddr: "GLEARNER",
				anchorDomain: ALLOWLISTED_DOMAIN,
				transactionId: "anchor-tx-1",
				amountIn: "50",
				assetOut: "NGN",
			}),
		)
		const [, init] = (global.fetch as jest.Mock).mock.calls[0]
		expect(init.method).toBe("POST")
		expect(init.headers.Authorization).toBe("Bearer anchor-jwt")
	})

	it("throws if the anchor response is missing url or id", async () => {
		mockFetchOnce(200, { type: "interactive_customer_info_needed" })
		await expect(
			initiateWithdrawal(ALLOWLISTED_DOMAIN, {
				learnerAddr: "GLEARNER",
				assetCode: "USDC",
				assetOut: "NGN",
				amount: "50",
				anchorToken: "anchor-jwt",
			}),
		).rejects.toThrow(/missing interactive url\/id/)
	})
})

describe("status reconciliation", () => {
	it("reconcileWithdrawal polls the anchor and updates the stored row", async () => {
		mockFetchOnce(200, {
			transaction: {
				id: "anchor-tx-1",
				status: "pending_anchor",
				amount_out: "74500",
			},
		})
		;(anchorWithdrawalStore.updateWithdrawalStatus as jest.Mock).mockResolvedValue(
			{ id: 42, status: "pending_anchor" },
		)

		const updated = await reconcileWithdrawal(
			ALLOWLISTED_DOMAIN,
			"anchor-tx-1",
			"anchor-jwt",
		)

		expect(updated).toEqual({ id: 42, status: "pending_anchor" })
		expect(anchorWithdrawalStore.updateWithdrawalStatus).toHaveBeenCalledWith(
			ALLOWLISTED_DOMAIN,
			"anchor-tx-1",
			expect.objectContaining({
				status: "pending_anchor",
				amountOut: "74500",
			}),
		)
		const [url] = (global.fetch as jest.Mock).mock.calls[0]
		expect(String(url)).toContain("/sep24/transactions?id=anchor-tx-1")
	})

	it("is idempotent: re-polling an already-terminal status writes the same terminal status again without erroring", async () => {
		const terminalTransaction = {
			transaction: { id: "anchor-tx-1", status: "completed", amount_out: "74500" },
		}
		mockFetchOnce(200, terminalTransaction)
		mockFetchOnce(200, terminalTransaction)
		;(anchorWithdrawalStore.updateWithdrawalStatus as jest.Mock).mockResolvedValue(
			{ id: 42, status: "completed" },
		)

		await reconcileWithdrawal(ALLOWLISTED_DOMAIN, "anchor-tx-1", "anchor-jwt")
		await reconcileWithdrawal(ALLOWLISTED_DOMAIN, "anchor-tx-1", "anchor-jwt")

		const calls = (anchorWithdrawalStore.updateWithdrawalStatus as jest.Mock).mock
			.calls
		expect(calls).toHaveLength(2)
		// Same anchor-reported status both times -> the identical write repeated,
		// not an error and not a drifting/duplicated side effect.
		expect(calls[0]).toEqual(calls[1])
	})

	it("isTerminalStatus recognizes terminal vs. in-progress SEP-24 statuses", () => {
		expect(isTerminalStatus("completed")).toBe(true)
		expect(isTerminalStatus("refunded")).toBe(true)
		expect(isTerminalStatus("expired")).toBe(true)
		expect(isTerminalStatus("error")).toBe(true)
		expect(isTerminalStatus("pending_anchor")).toBe(false)
		expect(isTerminalStatus("pending_user_transfer_start")).toBe(false)
	})
})
