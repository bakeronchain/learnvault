import { type NextFunction, type Request, type Response } from "express"
import jwt from "jsonwebtoken"

import { type JwtService } from "../services/jwt.service"

// ---------------------------------------------------------------------------
// Factory-based auth (used by routes that receive jwtService via DI)
// ---------------------------------------------------------------------------

export function createRequireAuth(jwtService: JwtService) {
	return function requireAuth(
		req: Request,
		res: Response,
		next: NextFunction,
	): void {
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
			const { sub } = jwtService.verifyWalletToken(token)
			req.walletAddress = sub
			next()
		} catch {
			res.status(401).json({ error: "Invalid or expired token" })
		}
	}
}

// ---------------------------------------------------------------------------
// Standalone auth (used by self-contained routers, e.g. upload, comments)
// ---------------------------------------------------------------------------

const JWT_SECRET = process.env.JWT_SECRET || "learnvault-secret"

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
		const decoded = jwt.verify(token, JWT_SECRET) as { address: string }
		req.user = decoded
		next()
	} catch {
		return res.status(401).json({ error: "Invalid token" })
	}
}
