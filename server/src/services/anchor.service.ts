/**
 * Anchor cash-out (#1053) — SEP-24 interactive withdrawal, SEP-38 firm
 * quotes, and the SEP-10-to-anchor client handshake both of those depend on.
 *
 * Every function here takes an anchor `domain` and resolves it through
 * config/anchors.ts's ANCHOR_ALLOWLIST first — an unlisted domain is
 * rejected before any network call is made. That allowlist is the entire
 * security boundary of this file: letting an arbitrary caller-supplied
 * domain reach `fetch` would let anyone point a learner's withdrawal at a
 * phishing endpoint impersonating an anchor.
 *
 * SEP-12 (KYC) is intentionally absent from this file — it happens entirely
 * inside the anchor's own interactive webapp (the URL returned by
 * initiateWithdrawal). LearnVault never sees or stores KYC documents.
 */

import { StellarToml } from "@stellar/stellar-sdk"

import { logger } from "../lib/logger"
import { getAnchorConfig, listAnchorConfigsForCountry } from "../config/anchors"
import { anchorWithdrawalStore } from "../db/anchor-withdrawal-store"

const log = logger.child({ module: "anchor" })

// Terminal SEP-24 transaction statuses — once reached, the reconciliation
// worker stops polling that row. Matches anchor-withdrawal-store.ts's
// listIncompleteWithdrawals() NOT IN clause.
const TERMINAL_STATUSES = new Set(["completed", "refunded", "expired", "error"])

export class AnchorNotAllowlistedError extends Error {
	constructor(domain: string) {
		super(`Anchor domain is not on the allowlist: ${domain}`)
		this.name = "AnchorNotAllowlistedError"
	}
}

async function requireAllowlistedToml(domain: string): Promise<StellarToml.Api.StellarToml> {
	if (!getAnchorConfig(domain)) {
		throw new AnchorNotAllowlistedError(domain)
	}
	try {
		return await StellarToml.Resolver.resolve(domain, { timeout: 10_000 })
	} catch (err) {
		log.error({ err, domain }, "Failed to resolve anchor stellar.toml")
		throw new Error(`Could not resolve stellar.toml for anchor: ${domain}`)
	}
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, init)
	if (!response.ok) {
		const text = await response.text().catch(() => "")
		throw new Error(
			`Anchor request failed (${response.status} ${response.statusText}): ${text.slice(0, 500)}`,
		)
	}
	return (await response.json()) as T
}

// ── Anchor registry ──────────────────────────────────────────────────────

export interface AnchorListing {
	domain: string
	name: string
	countries: string[]
	transferServerSep24: string | null
	anchorQuoteServer: string | null
	webAuthEndpoint: string | null
}

/**
 * Lists allowlisted anchors serving `country` (or all allowlisted anchors if
 * omitted), enriched with each anchor's own stellar.toml endpoints. Tolerant
 * of one anchor's toml being unreachable — that anchor is skipped (logged),
 * never fails the whole list.
 */
export async function listAnchorsForCountry(
	country?: string,
): Promise<AnchorListing[]> {
	const configs = listAnchorConfigsForCountry(country)

	const results = await Promise.allSettled(
		configs.map(async (cfg) => {
			const toml = await StellarToml.Resolver.resolve(cfg.domain, {
				timeout: 10_000,
			})
			const listing: AnchorListing = {
				domain: cfg.domain,
				name: cfg.name,
				countries: cfg.countries,
				transferServerSep24: toml.TRANSFER_SERVER_SEP0024 ?? null,
				anchorQuoteServer: toml.ANCHOR_QUOTE_SERVER ?? null,
				webAuthEndpoint: toml.WEB_AUTH_ENDPOINT ?? null,
			}
			return listing
		}),
	)

	const listings: AnchorListing[] = []
	results.forEach((result, i) => {
		if (result.status === "fulfilled") {
			listings.push(result.value)
		} else {
			log.warn(
				{ domain: configs[i].domain, err: result.reason },
				"Skipping anchor: stellar.toml unreachable",
			)
		}
	})
	return listings
}

// ── SEP-10-to-anchor auth handshake ─────────────────────────────────────
//
// Mirrors this server's OWN sep10.service.ts challenge/verify contract, but
// as a client to a third-party anchor rather than as the auth server. The
// learner's wallet signs the challenge locally — this never sees a learner
// secret key, same rule as every other flow in this codebase.

export interface AnchorAuthChallenge {
	transaction: string
	network_passphrase: string
}

export async function getAnchorAuthChallenge(
	domain: string,
	account: string,
): Promise<AnchorAuthChallenge> {
	const toml = await requireAllowlistedToml(domain)
	if (!toml.WEB_AUTH_ENDPOINT) {
		throw new Error(`Anchor ${domain} does not advertise a WEB_AUTH_ENDPOINT`)
	}

	const url = new URL(toml.WEB_AUTH_ENDPOINT)
	url.searchParams.set("account", account)
	return fetchJson<AnchorAuthChallenge>(url.toString())
}

export async function submitAnchorAuth(
	domain: string,
	signedTransactionXdr: string,
): Promise<{ token: string }> {
	const toml = await requireAllowlistedToml(domain)
	if (!toml.WEB_AUTH_ENDPOINT) {
		throw new Error(`Anchor ${domain} does not advertise a WEB_AUTH_ENDPOINT`)
	}

	return fetchJson<{ token: string }>(toml.WEB_AUTH_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ transaction: signedTransactionXdr }),
	})
}

// ── SEP-38 quotes ────────────────────────────────────────────────────────

export interface IndicativePrice {
	total_price: string
	price: string
	sell_amount: string
	buy_amount: string
	fee: { total: string; asset: string; details?: unknown }
}

export interface FirmQuote extends IndicativePrice {
	id: string
	expires_at: string
	sell_asset: string
	buy_asset: string
}

/**
 * GET /price on the anchor's SEP-38 quote server — an indicative price, no
 * hard expiry. Used for browsing before the learner has authenticated.
 * `anchorToken` is forwarded when supplied since some anchors require
 * SEP-10 auth even for indicative prices; we never assert an anchor doesn't
 * need it, we just pass through whatever the anchor decides.
 */
export async function getIndicativePrice(
	domain: string,
	params: { sellAsset: string; buyAsset: string; sellAmount: string },
	anchorToken?: string,
): Promise<IndicativePrice> {
	const toml = await requireAllowlistedToml(domain)
	if (!toml.ANCHOR_QUOTE_SERVER) {
		throw new Error(`Anchor ${domain} does not advertise an ANCHOR_QUOTE_SERVER`)
	}

	const url = new URL(`${toml.ANCHOR_QUOTE_SERVER.replace(/\/$/, "")}/price`)
	url.searchParams.set("sell_asset", params.sellAsset)
	url.searchParams.set("buy_asset", params.buyAsset)
	url.searchParams.set("sell_amount", params.sellAmount)
	url.searchParams.set("context", "sep24")

	return fetchJson<IndicativePrice>(url.toString(), {
		headers: anchorToken ? { Authorization: `Bearer ${anchorToken}` } : undefined,
	})
}

/**
 * POST /quote on the anchor's SEP-38 quote server — a firm, expiring quote
 * tied to the authenticated account. Requires the anchor's own SEP-10 token
 * (see getAnchorAuthChallenge/submitAnchorAuth above).
 */
export async function getFirmQuote(
	domain: string,
	params: { sellAsset: string; buyAsset: string; sellAmount: string },
	anchorToken: string,
): Promise<FirmQuote> {
	const toml = await requireAllowlistedToml(domain)
	if (!toml.ANCHOR_QUOTE_SERVER) {
		throw new Error(`Anchor ${domain} does not advertise an ANCHOR_QUOTE_SERVER`)
	}

	const url = `${toml.ANCHOR_QUOTE_SERVER.replace(/\/$/, "")}/quote`
	return fetchJson<FirmQuote>(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${anchorToken}`,
		},
		body: JSON.stringify({
			context: "sep24",
			sell_asset: params.sellAsset,
			buy_asset: params.buyAsset,
			sell_amount: params.sellAmount,
		}),
	})
}

/** True when a firm quote's expires_at is still in the future. */
export function isQuoteExpired(quote: Pick<FirmQuote, "expires_at">, now = new Date()): boolean {
	const expiresAt = new Date(quote.expires_at)
	if (Number.isNaN(expiresAt.getTime())) return true
	return expiresAt.getTime() <= now.getTime()
}

// ── SEP-24 interactive withdrawal ────────────────────────────────────────

export interface InitiateWithdrawalParams {
	learnerAddr: string
	assetCode: string
	assetOut: string
	amount: string
	quoteId?: string
	anchorToken: string
}

export interface InteractiveWithdrawalResult {
	id: number
	transactionId: string
	url: string
}

export async function initiateWithdrawal(
	domain: string,
	params: InitiateWithdrawalParams,
): Promise<InteractiveWithdrawalResult> {
	const toml = await requireAllowlistedToml(domain)
	if (!toml.TRANSFER_SERVER_SEP0024) {
		throw new Error(`Anchor ${domain} does not advertise a TRANSFER_SERVER_SEP0024`)
	}

	// SEP-24 §"Deposit and Withdraw" requires multipart/form-data for the
	// interactive endpoints.
	const form = new FormData()
	form.set("asset_code", params.assetCode)
	form.set("account", params.learnerAddr)
	form.set("amount", params.amount)
	if (params.quoteId) form.set("quote_id", params.quoteId)

	const url = `${toml.TRANSFER_SERVER_SEP0024.replace(/\/$/, "")}/transactions/withdraw/interactive`
	const anchorResponse = await fetchJson<{
		type: string
		url: string
		id: string
	}>(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${params.anchorToken}` },
		body: form,
	})

	if (!anchorResponse.url || !anchorResponse.id) {
		throw new Error("Anchor response missing interactive url/id")
	}

	const row = await anchorWithdrawalStore.insertWithdrawal({
		learnerAddr: params.learnerAddr,
		anchorDomain: domain,
		transactionId: anchorResponse.id,
		amountIn: params.amount,
		assetOut: params.assetOut,
		quoteId: params.quoteId ?? null,
	})

	log.info(
		{ learnerAddr: params.learnerAddr, domain, transactionId: anchorResponse.id },
		"Initiated anchor withdrawal",
	)

	return { id: row.id, transactionId: anchorResponse.id, url: anchorResponse.url }
}

// ── Status reconciliation ────────────────────────────────────────────────

interface AnchorTransactionRecord {
	id: string
	status: string
	message?: string
	amount_out?: string
	stellar_transaction_id?: string
}

/**
 * Polls the anchor's GET /transactions?id= for one row and reconciles the
 * result into anchor_withdrawals. Idempotent — safe to call repeatedly for
 * the same transaction, including after it has already reached a terminal
 * status (the store write is a no-op in effect since the values won't have
 * changed).
 *
 * Called per-request (from POST /api/anchors/:domain/withdrawals/:id/reconcile,
 * while the learner's client is polling for status) rather than by a
 * background worker on a timer — reconciling requires the anchor's own
 * SEP-10 token, which this codebase deliberately does not persist (same
 * "never hold what we don't need" posture as everywhere else here), so
 * there is nothing a blind scheduled job could authenticate with. The
 * learner's still-open client session supplies a fresh token on each call.
 */
export async function reconcileWithdrawal(
	domain: string,
	transactionId: string,
	anchorToken: string,
): ReturnType<typeof anchorWithdrawalStore.updateWithdrawalStatus> {
	const toml = await requireAllowlistedToml(domain)
	if (!toml.TRANSFER_SERVER_SEP0024) {
		throw new Error(`Anchor ${domain} does not advertise a TRANSFER_SERVER_SEP0024`)
	}

	const url = new URL(
		`${toml.TRANSFER_SERVER_SEP0024.replace(/\/$/, "")}/transactions`,
	)
	url.searchParams.set("id", transactionId)

	const { transaction } = await fetchJson<{ transaction: AnchorTransactionRecord }>(
		url.toString(),
		{ headers: { Authorization: `Bearer ${anchorToken}` } },
	)

	const updated = await anchorWithdrawalStore.updateWithdrawalStatus(
		domain,
		transactionId,
		{
			status: transaction.status,
			statusMessage: transaction.message ?? null,
			amountOut: transaction.amount_out ?? null,
			stellarTxId: transaction.stellar_transaction_id ?? null,
		},
	)

	log.info(
		{ domain, transactionId, status: transaction.status },
		"Reconciled anchor withdrawal status",
	)

	return updated
}

export function isTerminalStatus(status: string): boolean {
	return TERMINAL_STATUSES.has(status)
}

export async function listWithdrawalsForLearner(learnerAddr: string) {
	return anchorWithdrawalStore.listWithdrawalsForLearner(learnerAddr)
}
