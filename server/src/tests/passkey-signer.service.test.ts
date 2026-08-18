/**
 * Unit tests for the add_signer relay's input validation and pending-request
 * bookkeeping. The Stellar RPC/XDR boundary isn't exercised here (no live
 * network) — see wallet.routes.test.ts for the controller contract with this
 * service mocked.
 */

jest.mock("../db/index", () => ({
	pool: { query: jest.fn(), connect: jest.fn() },
}))

import {
	_clearPendingAddSignerRequests,
	confirmAddSigner,
	prepareAddSigner,
} from "../services/passkey-signer.service"

const validPublicKey = Buffer.from([0x04, ...new Array(64).fill(7)]).toString(
	"base64url",
)
const validCredentialId = Buffer.from("device-2").toString("base64url")

beforeEach(() => {
	_clearPendingAddSignerRequests()
})

describe("prepareAddSigner - input validation", () => {
	it("rejects a missing credentialId", async () => {
		await expect(
			prepareAddSigner("CWALLET", "", validPublicKey),
		).rejects.toThrow(/credentialId is required/)
	})

	it("rejects a publicKey that isn't 65 bytes", async () => {
		const shortKey = Buffer.from([0x04, 1, 2, 3]).toString("base64url")
		await expect(
			prepareAddSigner("CWALLET", validCredentialId, shortKey),
		).rejects.toThrow(/65-byte uncompressed SEC1 P-256 point/)
	})

	it("fails fast on missing STELLAR_SECRET_KEY config for otherwise-valid input", async () => {
		await expect(
			prepareAddSigner("CWALLET", validCredentialId, validPublicKey),
		).rejects.toThrow(/STELLAR_SECRET_KEY not configured/)
	})
})

describe("confirmAddSigner", () => {
	it("rejects an unknown or expired requestId", async () => {
		await expect(
			confirmAddSigner("does-not-exist", {
				credentialId: validCredentialId,
				authenticatorData: Buffer.from("a").toString("base64url"),
				clientDataJSON: Buffer.from("{}").toString("base64url"),
				signature: Buffer.from(new Array(64).fill(1)).toString("base64url"),
			}),
		).rejects.toThrow(/not found or expired/)
	})
})
