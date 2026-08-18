/**
 * Unit tests for passkey wallet deployment input validation. The Stellar RPC
 * boundary itself isn't exercised here (no live network in unit tests) — see
 * wallet.routes.test.ts for the controller/route contract with this service
 * mocked.
 */

jest.mock("../db/index", () => ({
	pool: { query: jest.fn(), connect: jest.fn() },
}))

import { deployPasskeyWallet } from "../services/passkey-wallet.service"

const validPublicKey = Buffer.from([0x04, ...new Array(64).fill(7)]).toString(
	"base64url",
)
const validCredentialId = Buffer.from("device-1").toString("base64url")

describe("deployPasskeyWallet - input validation", () => {
	it("rejects a missing credentialId", async () => {
		await expect(
			deployPasskeyWallet({
				credentialId: "",
				publicKey: validPublicKey,
			}),
		).rejects.toThrow(/credentialId is required/)
	})

	it("rejects a missing publicKey", async () => {
		await expect(
			deployPasskeyWallet({
				credentialId: validCredentialId,
				publicKey: "",
			}),
		).rejects.toThrow(/publicKey is required/)
	})

	it("rejects a publicKey that isn't 65 bytes", async () => {
		const shortKey = Buffer.from([0x04, 1, 2, 3]).toString("base64url")
		await expect(
			deployPasskeyWallet({
				credentialId: validCredentialId,
				publicKey: shortKey,
			}),
		).rejects.toThrow(/65-byte uncompressed SEC1 P-256 point/)
	})

	it("rejects a publicKey without the 0x04 uncompressed-point prefix", async () => {
		const wrongPrefix = Buffer.from([0x03, ...new Array(64).fill(7)]).toString(
			"base64url",
		)
		await expect(
			deployPasskeyWallet({
				credentialId: validCredentialId,
				publicKey: wrongPrefix,
			}),
		).rejects.toThrow(/65-byte uncompressed SEC1 P-256 point/)
	})

	it("reports missing STELLAR_SECRET_KEY config once params are valid, without needing a live network", async () => {
		// STELLAR_SECRET_KEY is captured at module load and is unset in this
		// test environment, so valid input should reach — and fail on — the
		// config check rather than ever attempting a network call.
		await expect(
			deployPasskeyWallet({
				credentialId: validCredentialId,
				publicKey: validPublicKey,
			}),
		).rejects.toThrow(/STELLAR_SECRET_KEY not configured/)
	})
})
