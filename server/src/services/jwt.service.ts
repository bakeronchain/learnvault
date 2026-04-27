import crypto from "node:crypto"

import jwt from "jsonwebtoken"

import { type TokenStore } from "../db/token-store"

const JWT_EXPIRY = "24h"

export const JWT_ISSUER = "learnvault"
export const JWT_AUDIENCE = "learnvault-api"

function normalizePem(pem: string): string {
	return pem.replace(/\\n/g, "\n").trim()
}

/** In-memory RSA pair for local dev when JWT_* env vars are unset (not for production). */
export function generateEphemeralDevJwtKeys(): {
	privateKeyPem: string
	publicKeyPem: string
} {
	const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
		modulusLength: 2048,
		publicKeyEncoding: { type: "spki", format: "pem" },
		privateKeyEncoding: { type: "pkcs8", format: "pem" },
	})
	return { privateKeyPem: privateKey, publicKeyPem: publicKey }
}

export type JwtService = {
	signWalletToken(stellarAddress: string): string
	verifyWalletToken(token: string): Promise<{ sub: string; jti: string }>
	revokeToken(token: string): Promise<void>
}

export function createJwtService(
	privateKeyPem: string,
	publicKeyPem: string,
	tokenStore: TokenStore,
): JwtService {
	const privateKey = normalizePem(privateKeyPem)
	const publicKey = normalizePem(publicKeyPem)

	return {
		signWalletToken(stellarAddress: string): string {
			return jwt.sign(
				{ sub: stellarAddress, jti: crypto.randomUUID() },
				privateKey,
				{
					algorithm: "RS256",
					expiresIn: JWT_EXPIRY,
					issuer: JWT_ISSUER,
					audience: JWT_AUDIENCE,
				},
			)
		},

		async verifyWalletToken(token: string): Promise<{ sub: string; jti: string }> {
			const isRevoked = await tokenStore.isRevoked(token)
			if (isRevoked) {
				throw new Error("Token has been revoked")
			}

			const decoded = jwt.verify(token, publicKey, {
				algorithms: ["RS256"],
				issuer: JWT_ISSUER,
				audience: JWT_AUDIENCE,
			}) as { sub?: string; jti?: string }

			if (typeof decoded.sub !== "string" || decoded.sub.length === 0) {
				throw new Error("Invalid token payload: missing sub")
			}
			if (typeof decoded.jti !== "string" || decoded.jti.length === 0) {
				throw new Error("Invalid token payload: missing jti")
			}

			return { sub: decoded.sub, jti: decoded.jti }
		},

		async revokeToken(token: string): Promise<void> {
			const decoded = jwt.decode(token) as { exp?: number }
			const nowSeconds = Math.floor(Date.now() / 1000)
			const ttl = (decoded?.exp ?? nowSeconds + 86400) - nowSeconds

			if (ttl > 0) {
				await tokenStore.revoke(token, ttl)
			}
		},
	}
}

