/**
 * Security tests for the JWT service.
 *
 * Verifies that the service enforces RS256, rejects HS256-signed tokens, and
 * validates iss, aud, and jti claims on every token it issues.
 */

import crypto from "node:crypto"

import jwt from "jsonwebtoken"

import { createTokenStore } from "../db/token-store"
import {
	JWT_AUDIENCE,
	JWT_ISSUER,
	createJwtService,
	generateEphemeralDevJwtKeys,
} from "../services/jwt.service"

// ---------------------------------------------------------------------------
// Shared test key pair (RS256, 2048-bit)
// ---------------------------------------------------------------------------

const { privateKeyPem, publicKeyPem } = generateEphemeralDevJwtKeys()
const tokenStore = createTokenStore(undefined)
const service = createJwtService(privateKeyPem, publicKeyPem, tokenStore)

const TEST_ADDRESS = "GABCDEF1234567890"

// ---------------------------------------------------------------------------
// Algorithm enforcement
// ---------------------------------------------------------------------------

describe("JWT algorithm enforcement", () => {
	it("rejects a token signed with HS256", async () => {
		const hs256Token = jwt.sign({ sub: TEST_ADDRESS }, "some-hmac-secret", {
			algorithm: "HS256",
		})

		await expect(service.verifyWalletToken(hs256Token)).rejects.toThrow()
	})

	it("rejects a token signed with a different RS256 key pair", async () => {
		const { privateKeyPem: otherPrivate, publicKeyPem: otherPublic } =
			generateEphemeralDevJwtKeys()
		void otherPublic

		const foreignToken = jwt.sign(
			{ sub: TEST_ADDRESS, jti: crypto.randomUUID() },
			otherPrivate,
			{
				algorithm: "RS256",
				issuer: JWT_ISSUER,
				audience: JWT_AUDIENCE,
			},
		)

		await expect(service.verifyWalletToken(foreignToken)).rejects.toThrow()
	})
})

// ---------------------------------------------------------------------------
// Claim validation
// ---------------------------------------------------------------------------

describe("JWT claim validation", () => {
	it("rejects a token with a wrong issuer", async () => {
		const token = jwt.sign(
			{ sub: TEST_ADDRESS, jti: crypto.randomUUID() },
			privateKeyPem,
			{
				algorithm: "RS256",
				issuer: "evil-issuer",
				audience: JWT_AUDIENCE,
			},
		)

		await expect(service.verifyWalletToken(token)).rejects.toThrow()
	})

	it("rejects a token with a wrong audience", async () => {
		const token = jwt.sign(
			{ sub: TEST_ADDRESS, jti: crypto.randomUUID() },
			privateKeyPem,
			{
				algorithm: "RS256",
				issuer: JWT_ISSUER,
				audience: "wrong-audience",
			},
		)

		await expect(service.verifyWalletToken(token)).rejects.toThrow()
	})

	it("rejects a token missing the jti claim", async () => {
		const token = jwt.sign({ sub: TEST_ADDRESS }, privateKeyPem, {
			algorithm: "RS256",
			issuer: JWT_ISSUER,
			audience: JWT_AUDIENCE,
		})

		await expect(service.verifyWalletToken(token)).rejects.toThrow(
			/missing jti/i,
		)
	})

	it("rejects a token missing the sub claim", async () => {
		const token = jwt.sign({ jti: crypto.randomUUID() }, privateKeyPem, {
			algorithm: "RS256",
			issuer: JWT_ISSUER,
			audience: JWT_AUDIENCE,
		})

		await expect(service.verifyWalletToken(token)).rejects.toThrow(
			/missing sub/i,
		)
	})

	it("rejects an expired token", async () => {
		const token = jwt.sign(
			{ sub: TEST_ADDRESS, jti: crypto.randomUUID() },
			privateKeyPem,
			{
				algorithm: "RS256",
				issuer: JWT_ISSUER,
				audience: JWT_AUDIENCE,
				expiresIn: -1,
			},
		)

		await expect(service.verifyWalletToken(token)).rejects.toThrow()
	})
})

// ---------------------------------------------------------------------------
// Valid token round-trip
// ---------------------------------------------------------------------------

describe("JWT valid token", () => {
	it("signs and verifies a token returning sub and jti", async () => {
		const token = service.signWalletToken(TEST_ADDRESS)
		const { sub, jti } = await service.verifyWalletToken(token)

		expect(sub).toBe(TEST_ADDRESS)
		expect(typeof jti).toBe("string")
		expect(jti.length).toBeGreaterThan(0)
	})

	it("includes unique jti on every token", async () => {
		const t1 = service.signWalletToken(TEST_ADDRESS)
		const t2 = service.signWalletToken(TEST_ADDRESS)

		const { jti: jti1 } = await service.verifyWalletToken(t1)
		const { jti: jti2 } = await service.verifyWalletToken(t2)

		expect(jti1).not.toBe(jti2)
	})
})
