import { type NextFunction, type Request, type Response } from "express"
import jwt from "jsonwebtoken"

import { type JwtService } from "../services/jwt.service"

// ---------------------------------------------------------------------------
// Factory-based auth (used by routes that receive jwtService via DI)
// ---------------------------------------------------------------------------

export function createRequireAuth(jwtService: JwtService) {
	return async function requireAuth(
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		const header = req.headers.authorization
		if (!header?.startsWith("Bearer ")) {
			res.status(401).json({ error: "Unauthorized" })
			return
		}

		const token = header.slice("Bearer ".length).trim()
		if (!token) {
			res.status(401).json({ error: "Unauthorized" })
			return
		}

		try {
			const { sub } = await jwtService.verifyWalletToken(token)
			req.walletAddress = sub
			;(req as AuthRequest).user = { address: sub }
			next()
		} catch (err) {
			const message = err instanceof Error ? err.message : "Invalid or expired token"
			res.status(401).json({ error: message })
		}
	}
}

// ---------------------------------------------------------------------------
// Standalone auth (used by self-contained routers, e.g. upload, comments)
// ---------------------------------------------------------------------------

const JWT_SECRET = process.env.JWT_SECRET || "learnvault-secret"
const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, "\n").trim()

export interface AuthRequest extends Request {
	user?: {
		address: string
	}
}

export const authMiddleware = (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
) => {
	const authHeader = req.headers.authorization
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return res.status(401).json({ error: "Unauthorized" })
	}

	const token = authHeader.split(" ")[1]
	try {
		let decoded: { sub?: string; address?: string }
		if (JWT_PUBLIC_KEY) {
			decoded = jwt.verify(token, JWT_PUBLIC_KEY, {
				algorithms: ["RS256"],
			}) as { sub?: string; address?: string }
		} else {
			decoded = jwt.verify(token, JWT_SECRET) as { sub?: string; address?: string }
		}

		const address = decoded.sub ?? decoded.address
		if (!address) {
			return res.status(401).json({ error: "Invalid token" })
		}
		req.user = { address }
		next()
	} catch {
		return res.status(401).json({ error: "Invalid token" })
	}
}

