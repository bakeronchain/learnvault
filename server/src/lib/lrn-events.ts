import { scValToNative, xdr } from "@stellar/stellar-sdk"

/**
 * Decoding for the two `learn_token` events that move an LRN balance.
 *
 * Pure functions only -- no RPC, no database. Keeping the wire format in one
 * testable place means the indexer and the backfill script agree on how a raw
 * Soroban event becomes a signed balance delta.
 *
 * Topic shapes, taken from contracts/learn_token/src/lib.rs:
 *
 *   mint  `env.events().publish((symbol_short!("lrn_mint"), to), amount)`
 *         topics: [Symbol("lrn_mint"), Address(to)]   data: i128 amount
 *
 *   burn  `LRNBurned { from, amount }.publish(&env)`
 *         `#[contractevent]` with no explicit topics, so soroban-sdk derives the
 *         topic from the struct name in snake_case and encodes the non-topic
 *         fields as a map.
 *         topics: [Symbol("lrn_burned")]              data: { amount, from }
 */

/** Topic symbol emitted by `LearnToken::mint`. */
export const LRN_MINT_TOPIC = "lrn_mint"

/** Topic symbol derived from the `LRNBurned` contract event struct. */
export const LRN_BURN_TOPIC = "lrn_burned"

export type LrnBalanceEventType = "mint" | "burn"

/** A single, already-validated balance movement ready to be journalled. */
export interface LrnBalanceDelta {
	/** Soroban event id, `<ledger>-<tx_hash>-<index>`. Unique across the chain. */
	eventId: string
	address: string
	/** Signed atomic LRN: positive on mint, negative on burn. */
	delta: bigint
	eventType: LrnBalanceEventType
	ledgerSequence: number
	txHash: string | null
	occurredAt: Date | null
}

/**
 * The subset of a Soroban RPC event this module reads. Declared structurally so
 * the decoder can also be fed plain JSON (webhook relay, fixtures) rather than
 * only `xdr.ScVal` instances.
 */
export interface RawContractEvent {
	id: string
	ledger: string | number
	ledgerClosedAt?: string
	txHash?: string
	topic: unknown[]
	value: unknown
}

/**
 * Convert an RPC-supplied value to its native JS form.
 *
 * `getEvents` hands back `xdr.ScVal` instances; fixtures and the webhook relay
 * hand back values that are already native. Duck-typing on the XDR union's
 * `switch()` accessor distinguishes the two without a try/catch that would
 * swallow genuine decode failures.
 */
function toNative(value: unknown): unknown {
	if (value === null || value === undefined) return null
	if (value instanceof xdr.ScVal) return scValToNative(value)
	if (typeof value === "object" && typeof (value as { switch?: unknown }).switch === "function") {
		return scValToNative(value as xdr.ScVal)
	}
	return value
}

/** Parse an unsigned atomic amount, rejecting anything that is not a positive integer. */
function parsePositiveAmount(value: unknown): bigint | null {
	if (value === null || value === undefined) return null
	try {
		const amount = typeof value === "bigint" ? value : BigInt(String(value))
		return amount > 0n ? amount : null
	} catch {
		return null
	}
}

function parseAddress(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null
}

/**
 * Event ids are `<ledger>-<tx_hash>-<event_index>`; the RPC also returns
 * `txHash` directly on newer versions, which is preferred when present.
 */
function resolveTxHash(event: RawContractEvent): string | null {
	if (event.txHash) return event.txHash
	const parts = event.id.split("-")
	return parts.length >= 2 && parts[1].length > 0 ? parts[1] : null
}

/**
 * Decode one raw contract event into a balance delta.
 *
 * Returns `null` for anything that is not a well-formed LRN mint or burn -- an
 * unrelated topic, a malformed payload, a non-positive amount. Callers skip
 * those rather than guessing, so a bad event can never corrupt a balance.
 *
 * O(1) time and space per event.
 */
export function decodeLrnBalanceDelta(
	event: RawContractEvent,
): LrnBalanceDelta | null {
	if (!event.id || !Array.isArray(event.topic) || event.topic.length === 0) {
		return null
	}

	const topicName = toNative(event.topic[0])
	if (typeof topicName !== "string") return null

	const ledgerSequence = Number(event.ledger)
	if (!Number.isFinite(ledgerSequence)) return null

	const base = {
		eventId: event.id,
		ledgerSequence,
		txHash: resolveTxHash(event),
		occurredAt: event.ledgerClosedAt ? new Date(event.ledgerClosedAt) : null,
	}

	if (topicName === LRN_MINT_TOPIC) {
		// Recipient is the second topic; the amount is the whole event payload.
		const address = parseAddress(toNative(event.topic[1]))
		const amount = parsePositiveAmount(toNative(event.value))
		if (!address || amount === null) return null
		return { ...base, address, delta: amount, eventType: "mint" }
	}

	if (topicName === LRN_BURN_TOPIC) {
		const data = toNative(event.value)
		if (typeof data !== "object" || data === null) return null
		const { from, amount: rawAmount } = data as Record<string, unknown>
		const address = parseAddress(from)
		const amount = parsePositiveAmount(rawAmount)
		if (!address || amount === null) return null
		return { ...base, address, delta: -amount, eventType: "burn" }
	}

	return null
}

/**
 * Base64 XDR topic filters for `getEvents`.
 *
 * A topic pattern matches only events with exactly as many topic segments, so
 * mint (topic + address) and burn (topic only) need separate patterns. Both are
 * passed in a single filter, which keeps the whole sync to one RPC call per page.
 */
export function lrnEventTopicFilters(): string[][] {
	const symbol = (name: string) => xdr.ScVal.scvSymbol(name).toXDR("base64")
	return [[symbol(LRN_MINT_TOPIC), "*"], [symbol(LRN_BURN_TOPIC)]]
}
