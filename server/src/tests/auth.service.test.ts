import jwt from "jsonwebtoken"
import { createTokenStore } from "../db/token-store"
import { createJwtService, generateEphemeralDevJwtKeys } from "../services/jwt.service"

describe("Auth / JWT Service", () => {
	const { privateKeyPem, publicKeyPem } = generateEphemeralDevJwtKeys()
	const tokenStore = createTokenStore(undefined) // Use memory store
	const jwtService = createJwtService(privateKeyPem, publicKeyPem, tokenStore)
	const address = "GABC123..."

	describe("JWT Generation & Claims", () => {
		it("generates a JWT with correct claims (sub, iat, exp)", async () => {
			const token = jwtService.signWalletToken(address)
			const decoded = jwt.decode(token) as any

			expect(decoded.sub).toBe(address)
			expect(decoded.iat).toBeDefined()
			expect(decoded.exp).toBeDefined()
			// exp should be 24h after iat
			expect(decoded.exp - decoded.iat).toBe(24 * 60 * 60)
		})

		it("uses RS256 algorithm", async () => {
			const token = jwtService.signWalletToken(address)
			const header = JSON.parse(
				Buffer.from(token.split(".")[0], "base64").toString(),
			)
			expect(header.alg).toBe("RS256")
		})
	})

	describe("JWT Validation", () => {
		it("passes for valid tokens", async () => {
			const token = jwtService.signWalletToken(address)
			const result = await jwtService.verifyWalletToken(token)
			expect(result.sub).toBe(address)
		})

		it("fails for expired tokens", async () => {
			// Create a token that expired 1 hour ago
			const expiredToken = jwt.sign(
				{ sub: address, exp: Math.floor(Date.now() / 1000) - 3600 },
				privateKeyPem,
				{ algorithm: "RS256" },
			)

			await expect(jwtService.verifyWalletToken(expiredToken)).rejects.toThrow(
				/jwt expired/i,
			)
		})

		it("fails for tampered tokens (payload changed)", async () => {
			const token = jwtService.signWalletToken(address)
			const [header, payload, signature] = token.split(".")
			const decodedPayload = JSON.parse(
				Buffer.from(payload, "base64").toString(),
			)
			decodedPayload.sub = "G_EVIL_ADDRESS"
			const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload))
				.toString("base64url")
				.replace(/=+$/, "")
			const tamperedToken = `${header}.${tamperedPayload}.${signature}`

			await expect(jwtService.verifyWalletToken(tamperedToken)).rejects.toThrow(
				/invalid signature|invalid token/i,
			)

		})

		it("fails when using HS256 to verify (algorithm enforcement)", async () => {
			// Attempting to use a symmetric key (HS256) instead of the public key
			const hs256Token = jwt.sign({ sub: address }, "some-secret", {
				algorithm: "HS256",
			})

			await expect(jwtService.verifyWalletToken(hs256Token)).rejects.toThrow(
				/invalid algorithm/i,
			)
		})
	})

	describe("Logout & Blocklist", () => {
		it("rejects tokens after logout", async () => {
			const token = jwtService.signWalletToken(address)

			// Initially valid
			await expect(jwtService.verifyWalletToken(token)).resolves.toBeDefined()

			// Logout
			await jwtService.revokeToken(token)

			// Now invalid
			await expect(jwtService.verifyWalletToken(token)).rejects.toThrow(
				/revoked/i,
			)
		})

		it("retains revocation state across multiple checks", async () => {
			const token = jwtService.signWalletToken(address)
			await jwtService.revokeToken(token)

			await expect(jwtService.verifyWalletToken(token)).rejects.toThrow(/revoked/i)
			await expect(jwtService.verifyWalletToken(token)).rejects.toThrow(/revoked/i)
		})
	})
})
