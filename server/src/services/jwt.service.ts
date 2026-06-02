import crypto from "node:crypto"
import jwt from "jsonwebtoken"
import { type TokenStore } from "../db/token-store"

const ACCESS_TOKEN_EXPIRY = "24h"
const REFRESH_TOKEN_EXPIRY = "30d"
const DEFAULT_REVOKE_TTL_SECONDS = 30 * 24 * 60 * 60

export const JWT_ISSUER = "learnvault"
export const JWT_AUDIENCE = "learnvault-api"
export const JWT_REFRESH_AUDIENCE = "learnvault-api-refresh"

function normalizePem(pem: string): string {
	return pem.replace(/\\n/g, "\n").trim()
}

function computeRevocationTtlSeconds(token: string): number {
	const decoded = jwt.decode(token) as { exp?: number } | null
	if (decoded && typeof decoded.exp === "number") {
		const now = Math.floor(Date.now() / 1000)
		return Math.max(0, decoded.exp - now)
	}
	return DEFAULT_REVOKE_TTL_SECONDS
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
	signRefreshToken(stellarAddress: string): string
	issueTokenPair(stellarAddress: string): {
		accessToken: string
		refreshToken: string
	}
	verifyWalletToken(token: string): Promise<{ sub: string; jti: string }>
	verifyRefreshToken(token: string): Promise<{ sub: string; jti: string }>
	rotateRefreshToken(refreshToken: string): Promise<{
		accessToken: string
		refreshToken: string
		sub: string
	}>
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
				{ sub: stellarAddress, jti: crypto.randomUUID(), type: "access" },
				privateKey,
				{
					algorithm: "RS256",
					expiresIn: ACCESS_TOKEN_EXPIRY,
					issuer: JWT_ISSUER,
					audience: JWT_AUDIENCE,
				},
			)
		},
		signRefreshToken(stellarAddress: string): string {
			return jwt.sign(
				{ sub: stellarAddress, jti: crypto.randomUUID(), type: "refresh" },
				privateKey,
				{
					algorithm: "RS256",
					expiresIn: REFRESH_TOKEN_EXPIRY,
					issuer: JWT_ISSUER,
					audience: JWT_REFRESH_AUDIENCE,
				},
			)
		},
		issueTokenPair(stellarAddress: string): {
			accessToken: string
			refreshToken: string
		} {
			return {
				accessToken: this.signWalletToken(stellarAddress),
				refreshToken: this.signRefreshToken(stellarAddress),
			}
		},

		async verifyWalletToken(
			token: string,
		): Promise<{ sub: string; jti: string }> {
			const isRevoked = await tokenStore.isRevoked(token)
			if (isRevoked) {
				throw new Error("Token has been revoked")
			}

			const decoded = jwt.verify(token, publicKey, {
				algorithms: ["RS256"],
				issuer: JWT_ISSUER,
				audience: JWT_AUDIENCE,
			}) as { sub?: string; jti?: string; type?: string }

			if (typeof decoded.sub !== "string" || decoded.sub.length === 0) {
				throw new Error("Invalid token payload: missing sub")
			}
			if (typeof decoded.jti !== "string" || decoded.jti.length === 0) {
				throw new Error("Invalid token payload: missing jti")
			}
			if (decoded.type !== "access") {
				throw new Error("Invalid token type")
			}

			return { sub: decoded.sub, jti: decoded.jti }
		},
		async verifyRefreshToken(
			token: string,
		): Promise<{ sub: string; jti: string }> {
			const isRevoked = await tokenStore.isRevoked(token)
			if (isRevoked) {
				throw new Error("Refresh token has been revoked")
			}

			const decoded = jwt.verify(token, publicKey, {
				algorithms: ["RS256"],
				issuer: JWT_ISSUER,
				audience: JWT_REFRESH_AUDIENCE,
			}) as { sub?: string; jti?: string; type?: string }

			if (typeof decoded.sub !== "string" || decoded.sub.length === 0) {
				throw new Error("Invalid token payload: missing sub")
			}
			if (typeof decoded.jti !== "string" || decoded.jti.length === 0) {
				throw new Error("Invalid token payload: missing jti")
			}
			if (decoded.type !== "refresh") {
				throw new Error("Invalid refresh token type")
			}

			return { sub: decoded.sub, jti: decoded.jti }
		},
		async rotateRefreshToken(refreshToken: string): Promise<{
			accessToken: string
			refreshToken: string
			sub: string
		}> {
			const { sub } = await this.verifyRefreshToken(refreshToken)
			await this.revokeToken(refreshToken)
			const next = this.issueTokenPair(sub)
			return { ...next, sub }
		},

		async revokeToken(token: string): Promise<void> {
			await tokenStore.revoke(token, computeRevocationTtlSeconds(token))
		},
	}
}
