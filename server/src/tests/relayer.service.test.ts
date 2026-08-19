/**
 * Fee-bump relayer guardrail tests (#1054).
 *
 * The allowlist check is the security-critical piece of this issue, so it's
 * tested against REAL locally-built transaction envelopes (Account/
 * TransactionBuilder/Operation are pure, offline SDK constructs — no network
 * call needed to build or sign one), not mocks. This exercises the exact XDR
 * decode path the relayer runs in production.
 *
 * COURSE_MILESTONE_CONTRACT_ID is captured into a module-level constant in
 * relayer.service.ts (same pattern as every other *_CONTRACT_ID in this
 * codebase), so it must be set before that module is first imported — ts-jest
 * compiles to CommonJS with `module: "commonjs"`, which preserves source
 * order (imports are `require()` calls emitted exactly where written, not
 * hoisted), so setting it here above the import works. Same technique as
 * admin-milestones.test.ts's `process.env.JWT_SECRET` line.
 */

import { StrKey } from "@stellar/stellar-sdk"

// Real, checksummed contract strkeys (fixed 32-byte payloads) — a hand-typed
// "CAAA...AAA" fails stellar-base's checksum/type validation the moment
// Operation.invokeContractFunction builds an Address from it.
const COURSE_MILESTONE_CONTRACT_ID = StrKey.encodeContract(
	Buffer.alloc(32, 1),
)
process.env.COURSE_MILESTONE_CONTRACT_ID = COURSE_MILESTONE_CONTRACT_ID
const OTHER_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 2))

import {
	Account,
	BASE_FEE,
	Keypair,
	Networks,
	Operation,
	TransactionBuilder,
} from "@stellar/stellar-sdk"

import {
	parseInnerTransaction,
	RelayRejection,
	validateParsedTransaction,
	type ParsedInnerTransaction,
} from "../services/relayer.service"

function buildSignedInnerTx(options: {
	source: InstanceType<typeof Keypair>
	contract?: string
	functionName?: string
	feeStroops?: number
}): string {
	const {
		source,
		contract = COURSE_MILESTONE_CONTRACT_ID,
		functionName = "enroll",
		feeStroops,
	} = options

	const account = new Account(source.publicKey(), "1")
	const builder = new TransactionBuilder(account, {
		fee: feeStroops !== undefined ? feeStroops.toString() : BASE_FEE,
		networkPassphrase: Networks.TESTNET,
	})
		.addOperation(
			Operation.invokeContractFunction({
				contract,
				function: functionName,
				args: [],
			}),
		)
		.setTimeout(30)

	const tx = builder.build()
	tx.sign(source)
	return tx.toXDR()
}

describe("parseInnerTransaction", () => {
	it("rejects an invalid envelope", async () => {
		await expect(parseInnerTransaction("not-valid-xdr")).rejects.toMatchObject(
			{ reason: "INVALID_ENVELOPE" },
		)
	})

	it("rejects an envelope that is already a fee-bump transaction", async () => {
		const inner = Keypair.random()
		const sponsor = Keypair.random()
		const innerXdr = buildSignedInnerTx({ source: inner })
		const { Transaction } = await import("@stellar/stellar-sdk")
		const innerTx = TransactionBuilder.fromXDR(
			innerXdr,
			Networks.TESTNET,
		) as InstanceType<typeof Transaction>
		const feeBump = TransactionBuilder.buildFeeBumpTransaction(
			sponsor,
			BASE_FEE,
			innerTx,
			Networks.TESTNET,
		)

		await expect(
			parseInnerTransaction(feeBump.toXDR()),
		).rejects.toMatchObject({ reason: "ALREADY_FEE_BUMP" })
	})

	it("parses source, fee, and invoked contract/function from a valid envelope", async () => {
		const learner = Keypair.random()
		const xdr = buildSignedInnerTx({ source: learner })

		const parsed = await parseInnerTransaction(xdr)

		expect(parsed.sourceAccount).toBe(learner.publicKey())
		expect(parsed.feeStroops).toBe(BigInt(BASE_FEE))
		expect(parsed.operations).toEqual([
			{ contractId: COURSE_MILESTONE_CONTRACT_ID, functionName: "enroll" },
		])
	})

	it("rejects an operation that is not a contract invocation", async () => {
		const learner = Keypair.random()
		const account = new Account(learner.publicKey(), "1")
		const tx = new TransactionBuilder(account, {
			fee: BASE_FEE,
			networkPassphrase: Networks.TESTNET,
		})
			.addOperation(
				Operation.payment({
					destination: Keypair.random().publicKey(),
					asset: (
						await import("@stellar/stellar-sdk")
					).Asset.native(),
					amount: "1",
				}),
			)
			.setTimeout(30)
			.build()
		tx.sign(learner)

		await expect(parseInnerTransaction(tx.toXDR())).rejects.toMatchObject({
			reason: "NON_CONTRACT_OPERATION",
		})
	})
})

describe("validateParsedTransaction", () => {
	const learner = "GLEARNER00000000000000000000000000000000000000000000000"

	const validParsed: ParsedInnerTransaction = {
		sourceAccount: learner,
		feeStroops: 100n,
		operations: [
			{ contractId: COURSE_MILESTONE_CONTRACT_ID, functionName: "enroll" },
		],
	}

	it("accepts a valid, allowlisted, in-budget transaction", () => {
		expect(() =>
			validateParsedTransaction(validParsed, {
				learnerAddress: learner,
				spendTodayStroops: 0n,
			}),
		).not.toThrow()
	})

	it("rejects when the inner transaction source is not the authenticated learner", () => {
		expect(() =>
			validateParsedTransaction(validParsed, {
				learnerAddress: "GSOMEONEELSE0000000000000000000000000000000000000000000",
				spendTodayStroops: 0n,
			}),
		).toThrow(RelayRejection)

		try {
			validateParsedTransaction(validParsed, {
				learnerAddress: "GSOMEONEELSE0000000000000000000000000000000000000000000",
				spendTodayStroops: 0n,
			})
		} catch (err) {
			expect((err as RelayRejection).reason).toBe("SOURCE_MISMATCH")
		}
	})

	it("rejects an operation on a contract that is not allowlisted", () => {
		const parsed: ParsedInnerTransaction = {
			...validParsed,
			operations: [{ contractId: OTHER_CONTRACT_ID, functionName: "enroll" }],
		}
		expect(() =>
			validateParsedTransaction(parsed, {
				learnerAddress: learner,
				spendTodayStroops: 0n,
			}),
		).toThrow(
			expect.objectContaining({ reason: "NOT_ALLOWLISTED" }),
		)
	})

	it("rejects a function that is not on the allowlist even on an allowlisted contract", () => {
		const parsed: ParsedInnerTransaction = {
			...validParsed,
			operations: [
				{ contractId: COURSE_MILESTONE_CONTRACT_ID, functionName: "withdraw" },
			],
		}
		expect(() =>
			validateParsedTransaction(parsed, {
				learnerAddress: learner,
				spendTodayStroops: 0n,
			}),
		).toThrow(expect.objectContaining({ reason: "NOT_ALLOWLISTED" }))
	})

	it("rejects when the fee exceeds the sponsor's per-transaction cap", () => {
		// Default SPONSOR_MAX_FEE_STROOPS is 100_000 (0.01 XLM) — well above the tiny fee above.
		const parsed: ParsedInnerTransaction = {
			...validParsed,
			feeStroops: 1_000_000n,
		}
		expect(() =>
			validateParsedTransaction(parsed, {
				learnerAddress: learner,
				spendTodayStroops: 0n,
			}),
		).toThrow(expect.objectContaining({ reason: "FEE_OVER_CAP" }))
	})

	it("rejects when today's spend plus this fee would exceed the daily cap", () => {
		// Default SPONSOR_DAILY_SPEND_CAP_STROOPS is 500_000_000 (50 XLM).
		expect(() =>
			validateParsedTransaction(validParsed, {
				learnerAddress: learner,
				spendTodayStroops: 499_999_999n,
			}),
		).toThrow(expect.objectContaining({ reason: "DAILY_CAP_EXCEEDED" }))
	})

	it("allows a transaction that keeps spend under the daily cap", () => {
		expect(() =>
			validateParsedTransaction(validParsed, {
				learnerAddress: learner,
				spendTodayStroops: 1_000n,
			}),
		).not.toThrow()
	})
})

describe("fee-bump construction", () => {
	// buildFeeBumpTransaction requires baseFee >= the inner transaction's own
	// fee rate, or it throws "Invalid baseFee". submitFeeBump computes
	// feeBumpBaseFee as max(BASE_FEE, parsed.feeStroops) for exactly this
	// reason — reproduced here (not imported, since it isn't exported: it's a
	// one-line, low-drift-risk computation kept inline in the fix) so this
	// test exercises the real construction call, not just the arithmetic.
	function feeBumpBaseFeeFor(feeStroops: bigint): string {
		return feeStroops > BigInt(BASE_FEE) ? feeStroops.toString() : BASE_FEE
	}

	it("a naive hardcoded BASE_FEE throws for an inner transaction with a higher fee (documents the bug this fix addresses)", async () => {
		const learner = Keypair.random()
		const sponsor = Keypair.random()
		const xdr = buildSignedInnerTx({ source: learner, feeStroops: 1000 })
		const { Transaction } = await import("@stellar/stellar-sdk")
		const innerTx = TransactionBuilder.fromXDR(
			xdr,
			Networks.TESTNET,
		) as InstanceType<typeof Transaction>

		expect(() =>
			TransactionBuilder.buildFeeBumpTransaction(
				sponsor,
				BASE_FEE,
				innerTx,
				Networks.TESTNET,
			),
		).toThrow(/Invalid baseFee/)
	})

	it("a valid inner transaction with a fee higher than BASE_FEE reaches fee-bump construction without throwing", async () => {
		const learner = Keypair.random()
		const sponsor = Keypair.random()
		const xdr = buildSignedInnerTx({ source: learner, feeStroops: 1000 })

		const parsed = await parseInnerTransaction(xdr)
		expect(parsed.feeStroops).toBe(1000n)

		const { Transaction } = await import("@stellar/stellar-sdk")
		const innerTx = TransactionBuilder.fromXDR(
			xdr,
			Networks.TESTNET,
		) as InstanceType<typeof Transaction>

		let feeBumpTx: ReturnType<
			typeof TransactionBuilder.buildFeeBumpTransaction
		>
		expect(() => {
			feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
				sponsor,
				feeBumpBaseFeeFor(parsed.feeStroops),
				innerTx,
				Networks.TESTNET,
			)
		}).not.toThrow()

		feeBumpTx!.sign(sponsor)
		expect(feeBumpTx!.feeSource).toBe(sponsor.publicKey())
		expect(BigInt(feeBumpTx!.fee)).toBeGreaterThanOrEqual(parsed.feeStroops)
		expect(feeBumpTx!.innerTransaction.hash().toString("hex")).toBe(
			innerTx.hash().toString("hex"),
		)
	})

	it("still respects the sponsor's fee cap: a fee at exactly SPONSOR_MAX_FEE_STROOPS also constructs cleanly", async () => {
		// Default SPONSOR_MAX_FEE_STROOPS is 100_000 — validateParsedTransaction
		// (called before this step in submitFeeBump) guarantees feeStroops never
		// exceeds it, so this is the worst case the construction step ever sees.
		const learner = Keypair.random()
		const sponsor = Keypair.random()
		const xdr = buildSignedInnerTx({ source: learner, feeStroops: 100_000 })
		const parsed = await parseInnerTransaction(xdr)

		const { Transaction } = await import("@stellar/stellar-sdk")
		const innerTx = TransactionBuilder.fromXDR(
			xdr,
			Networks.TESTNET,
		) as InstanceType<typeof Transaction>

		expect(() =>
			TransactionBuilder.buildFeeBumpTransaction(
				sponsor,
				feeBumpBaseFeeFor(parsed.feeStroops),
				innerTx,
				Networks.TESTNET,
			),
		).not.toThrow()
	})
})
