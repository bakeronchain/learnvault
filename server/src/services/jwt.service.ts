import crypto from "node:crypto"

import jwt from "jsonwebtoken"

const JWT_EXPIRY = "24h"

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
	verifyWalletToken(token: string): { sub: string }
}

export function createJwtService(
	privateKeyPem: string,
	publicKeyPem: string,
): JwtService {
	const privateKey = normalizePem(privateKeyPem)
	const publicKey = normalizePem(publicKeyPem)

	return {
		signWalletToken(stellarAddress: string): string {
			return jwt.sign({ sub: stellarAddress }, privateKey, {
				algorithm: "RS256",
				expiresIn: JWT_EXPIRY,
			})
		},

		verifyWalletToken(token: string): { sub: string } {
			const decoded = jwt.verify(token, publicKey, {
				algorithms: ["RS256"],
			}) as { sub?: string }

			if (typeof decoded.sub !== "string" || decoded.sub.length === 0) {
				throw new Error("Invalid token payload")
			}

			return { sub: decoded.sub }
		},
	}
}
