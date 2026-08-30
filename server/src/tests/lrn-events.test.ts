/**
 * Decoder unit tests. The decoder is the only place that knows the on-chain
 * wire format, so these cases pin the exact topic/payload shapes emitted by
 * contracts/learn_token/src/lib.rs.
 */

// Stand-in for the SDK: an ScVal is anything exposing switch(), and converting
// one yields its `__native` payload. Plain values pass through untouched, which
// is what the webhook relay and these fixtures hand over.
jest.mock("@stellar/stellar-sdk", () => ({
	scValToNative: (value: { __native: unknown }) => value.__native,
	xdr: {
		ScVal: class ScVal {
			static scvSymbol(name: string) {
				return { toXDR: () => `symbol:${name}` }
			}
		},
	},
}))

import {
	decodeLrnBalanceDelta,
	lrnEventTopicFilters,
	LRN_BURN_TOPIC,
	LRN_MINT_TOPIC,
} from "../lib/lrn-events"

const SCHOLAR = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ"

function mintEvent(overrides: Record<string, unknown> = {}) {
	return {
		id: "0000000100-abc123-0",
		ledger: 100,
		ledgerClosedAt: "2026-01-01T00:00:00Z",
		topic: [LRN_MINT_TOPIC, SCHOLAR],
		value: 500n,
		...overrides,
	}
}

function burnEvent(overrides: Record<string, unknown> = {}) {
	return {
		id: "0000000101-def456-2",
		ledger: 101,
		topic: [LRN_BURN_TOPIC],
		value: { amount: 200n, from: SCHOLAR },
		...overrides,
	}
}

describe("decodeLrnBalanceDelta", () => {
	it("decodes a mint into a positive delta", () => {
		expect(decodeLrnBalanceDelta(mintEvent())).toEqual({
			eventId: "0000000100-abc123-0",
			address: SCHOLAR,
			delta: 500n,
			eventType: "mint",
			ledgerSequence: 100,
			txHash: "abc123",
			occurredAt: new Date("2026-01-01T00:00:00Z"),
		})
	})

	it("decodes a burn into a negative delta", () => {
		const delta = decodeLrnBalanceDelta(burnEvent())
		expect(delta).toMatchObject({
			address: SCHOLAR,
			delta: -200n,
			eventType: "burn",
			ledgerSequence: 101,
			txHash: "def456",
		})
	})

	it("prefers the RPC-supplied txHash over the one embedded in the event id", () => {
		const delta = decodeLrnBalanceDelta(mintEvent({ txHash: "explicit" }))
		expect(delta?.txHash).toBe("explicit")
	})

	it("converts ScVal topics and payloads through the SDK", () => {
		const scVal = (native: unknown) => ({ switch: () => 0, __native: native })
		const delta = decodeLrnBalanceDelta(
			mintEvent({
				topic: [scVal(LRN_MINT_TOPIC), scVal(SCHOLAR)],
				value: scVal(750n),
			}),
		)
		expect(delta).toMatchObject({ address: SCHOLAR, delta: 750n })
	})

	it("accepts amounts serialised as decimal strings without losing precision", () => {
		const huge = "170141183460469231731687303715884105727"
		const delta = decodeLrnBalanceDelta(mintEvent({ value: huge }))
		expect(delta?.delta).toBe(BigInt(huge))
	})

	it.each([
		["an unrelated topic", mintEvent({ topic: ["set_admin", SCHOLAR] })],
		["no topics at all", mintEvent({ topic: [] })],
		["a zero amount", mintEvent({ value: 0n })],
		["a negative amount", mintEvent({ value: -5n })],
		["an unparseable amount", mintEvent({ value: "not-a-number" })],
		["a missing recipient", mintEvent({ topic: [LRN_MINT_TOPIC] })],
		["a burn with no payload", burnEvent({ value: null })],
		["a burn with no sender", burnEvent({ value: { amount: 10n } })],
		["a non-numeric ledger", mintEvent({ ledger: "unknown" })],
	])("returns null for %s", (_label, event) => {
		expect(decodeLrnBalanceDelta(event as never)).toBeNull()
	})
})

describe("lrnEventTopicFilters", () => {
	it("matches mint on two topic segments and burn on one", () => {
		// Topic patterns match by exact segment count, so mint (topic + address)
		// and burn (topic only) cannot share a single pattern.
		expect(lrnEventTopicFilters()).toEqual([
			["symbol:lrn_mint", "*"],
			["symbol:lrn_burned"],
		])
	})
})
