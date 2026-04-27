/**
 * Security tests for the JWT service.
 *
 * Verifies that the service enforces RS256, rejects HS256-signed tokens, and
 * validates iss, aud, and jti claims on every token it issues.
 */

import crypto from "node:crypto"

import jwt from "jsonwebtoken"

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
const service = createJwtService(privateKeyPem, publicKeyPem)

const TEST_ADDRESS = "GABCDEF1234567890"

// ---------------------------------------------------------------------------
// Algorithm enforcement
// ---------------------------------------------------------------------------

describe("JWT algorithm enforcement", () => {
	it("rejects a token signed with HS256", () => {
		const hs256Token = jwt.sign({ sub: TEST_ADDRESS }, "some-hmac-secret", {
			algorithm: "HS256",
		})

		expect(() => service.verifyWalletToken(hs256Token)).toThrow()
	})

	it("rejects a token signed with a different RS256 key pair", () => {
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

		expect(() => service.verifyWalletToken(foreignToken)).toThrow()
	})
})

// ---------------------------------------------------------------------------
// Claim validation
// ---------------------------------------------------------------------------

describe("JWT claim validation", () => {
	it("rejects a token with a wrong issuer", () => {
		const token = jwt.sign(
			{ sub: TEST_ADDRESS, jti: crypto.randomUUID() },
			privateKeyPem,
			{
				algorithm: "RS256",
				issuer: "evil-issuer",
				audience: JWT_AUDIENCE,
			},
		)

		expect(() => service.verifyWalletToken(token)).toThrow()
	})

	it("rejects a token with a wrong audience", () => {
		const token = jwt.sign(
			{ sub: TEST_ADDRESS, jti: crypto.randomUUID() },
			privateKeyPem,
			{
				algorithm: "RS256",
				issuer: JWT_ISSUER,
				audience: "wrong-audience",
			},
		)

		expect(() => service.verifyWalletToken(token)).toThrow()
	})

	it("rejects a token missing the jti claim", () => {
		const token = jwt.sign({ sub: TEST_ADDRESS }, privateKeyPem, {
			algorithm: "RS256",
			issuer: JWT_ISSUER,
			audience: JWT_AUDIENCE,
		})

		expect(() => service.verifyWalletToken(token)).toThrow("missing jti")
	})

	it("rejects a token missing the sub claim", () => {
		const token = jwt.sign({ jti: crypto.randomUUID() }, privateKeyPem, {
			algorithm: "RS256",
			issuer: JWT_ISSUER,
			audience: JWT_AUDIENCE,
		})

		expect(() => service.verifyWalletToken(token)).toThrow("missing sub")
	})

	it("rejects an expired token", () => {
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

		expect(() => service.verifyWalletToken(token)).toThrow()
	})
})

// ---------------------------------------------------------------------------
// Valid token round-trip
// ---------------------------------------------------------------------------

describe("JWT valid token", () => {
	it("signs and verifies a token returning sub and jti", () => {
		const token = service.signWalletToken(TEST_ADDRESS)
		const { sub, jti } = service.verifyWalletToken(token)

		expect(sub).toBe(TEST_ADDRESS)
		expect(typeof jti).toBe("string")
		expect(jti.length).toBeGreaterThan(0)
	})

	it("includes unique jti on every token", () => {
		const t1 = service.signWalletToken(TEST_ADDRESS)
		const t2 = service.signWalletToken(TEST_ADDRESS)

		const { jti: jti1 } = service.verifyWalletToken(t1)
		const { jti: jti2 } = service.verifyWalletToken(t2)

		expect(jti1).not.toBe(jti2)
	})
})
