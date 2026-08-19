/**
 * Sponsorship service input-validation tests (#1054).
 *
 * The Stellar RPC boundary (loading the sponsor account, submitting) isn't
 * exercised here — same rationale as passkey-signer.service.test.ts: no live
 * network in this environment. This covers what's testable without it: the
 * fail-fast guards that run before any network call.
 *
 * SPONSOR_SECRET is captured into a module-level constant at import time
 * (same pattern as STELLAR_SECRET_KEY elsewhere in this codebase), so
 * toggling it between "configured" and "not configured" across test cases
 * needs a fresh module instance per case — jest.resetModules() + a dynamic
 * require() inside each test, rather than a single static top-level import.
 */

jest.mock("../db/index", () => ({
	pool: { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
}))

function loadServiceWithSponsorSecret(secret: string | undefined) {
	jest.resetModules()
	if (secret === undefined) {
		delete process.env.SPONSOR_SECRET
	} else {
		process.env.SPONSOR_SECRET = secret
	}
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	return require("../services/sponsorship.service") as typeof import("../services/sponsorship.service")
}

describe("buildSponsorAccountTransaction - input validation", () => {
	const originalSponsorSecret = process.env.SPONSOR_SECRET

	afterEach(() => {
		if (originalSponsorSecret === undefined) {
			delete process.env.SPONSOR_SECRET
		} else {
			process.env.SPONSOR_SECRET = originalSponsorSecret
		}
	})

	it("fails fast on missing SPONSOR_SECRET config", async () => {
		const { buildSponsorAccountTransaction } = loadServiceWithSponsorSecret(
			undefined,
		)
		await expect(
			buildSponsorAccountTransaction(
				"GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ",
			),
		).rejects.toThrow(/SPONSOR_SECRET not configured/)
	})

	it("rejects a learner address that is not a valid Stellar public key", async () => {
		const { buildSponsorAccountTransaction } = loadServiceWithSponsorSecret(
			"SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
		)
		await expect(
			buildSponsorAccountTransaction("not-a-valid-address"),
		).rejects.toThrow(/must be a valid Stellar public key/)
	})
})
