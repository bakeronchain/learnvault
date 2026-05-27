import { type NextFunction, type Request, type Response } from "express"
import jwt from "jsonwebtoken"
import { validateAdminApiKey } from "../services/admin-key.service"

import { JWT_AUDIENCE, JWT_ISSUER } from "../services/jwt.service"

function getAdminAddresses(): string[] {
	return (process.env.ADMIN_ADDRESSES ?? "")
		.split(",")
		.map((a) => a.trim())
		.filter(Boolean)
}

function getJwtPublicKey(): string | undefined {
	return process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, "\n").trim()
}

function getJwtSecret(): string | undefined {
	// HS256 fallback is development-only; production must use RS256 via JWT_PUBLIC_KEY.
	if (process.env.NODE_ENV === "production") return undefined
	return process.env.JWT_SECRET?.trim()
}

export interface AdminRequest extends Request {
	adminAddress?: string
<<<<<<< HEAD
	walletAddress?: string
=======
	adminAuthMethod?: "jwt" | "api_key"
>>>>>>> 342a14b (feat(deploy): automate multi-contract Stellar deployment with CI support, verification, and frontend sync)
}

/**
 * Middleware that verifies the Bearer JWT and checks the wallet address
 * is in the ADMIN_ADDRESSES allowlist.
 *
 * In dev mode (no ADMIN_ADDRESSES set) any valid JWT is accepted so the
 * API remains usable without extra config.
 */
export function requireAdmin(
	req: AdminRequest,
	res: Response,
	next: NextFunction,
): void | Promise<void> {
	const apiKey = req.header("x-api-key")?.trim()
	if (apiKey) {
		void (async () => {
			if (await validateAdminApiKey(apiKey)) {
				req.adminAddress = "admin-api-key"
				req.adminAuthMethod = "api_key"
				req.walletAddress = "admin-api-key"
				next()
				return
			}

			res.status(401).json({ error: "Unauthorized" })
		})()
		return
	}

	const header = req.headers.authorization
	if (!header?.startsWith("Bearer ")) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const token = header.slice("Bearer ".length).trim()
	if (process.env.NODE_ENV !== "production" && token === "mock-admin-jwt") {
		req.adminAddress = "dev-admin"
		next()
		return
	}

	let decoded: { address?: string; sub?: string }
	const jwtPublicKey = getJwtPublicKey()
	const jwtSecret = getJwtSecret()

	if (!jwtPublicKey && !jwtSecret) {
		res.status(500).json({ error: "JWT verification not configured" })
		return
	}

	try {
		decoded = (
			jwtPublicKey
				? jwt.verify(token, jwtPublicKey, {
						algorithms: ["RS256"],
						issuer: JWT_ISSUER,
						audience: JWT_AUDIENCE,
					})
				: jwt.verify(token, jwtSecret!)
		) as { address?: string; sub?: string }
	} catch {
		res.status(401).json({ error: "Invalid or expired token" })
		return
	}

	const address = decoded.address ?? decoded.sub ?? ""
	if (!address) {
		res.status(401).json({ error: "Token missing address claim" })
		return
	}

	const adminAddresses = getAdminAddresses()

	// If ADMIN_ADDRESSES is configured, enforce the allowlist
	if (adminAddresses.length > 0 && !adminAddresses.includes(address)) {
		res.status(403).json({ error: "Forbidden: not an admin address" })
		return
	}

	req.adminAddress = address
	req.adminAuthMethod = "jwt"
	req.walletAddress = address
	next()
}
