import { type NextFunction, type Request, type Response } from "express"

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
			;(req as AuthRequest).user = { address: sub }
			next()
		} catch {
			res.status(401).json({ error: "Invalid or expired token" })
		}
	}
}

export function createOptionalAuth(jwtService: JwtService) {
	return function optionalAuth(
		req: Request,
		res: Response,
		next: NextFunction,
	): void {
		const header = req.headers.authorization
		if (!header?.startsWith("Bearer ")) {
			next()
			return
		}

		const token = header.slice("Bearer ".length).trim()
		if (!token) {
			next()
			return
		}

		try {
			const { sub } = jwtService.verifyWalletToken(token)
			req.walletAddress = sub
			;(req as AuthRequest).user = { address: sub }
		} catch {
			// Ignore invalid tokens for optional auth
		}
		next()
	}
}

// Extended request type for routes using createRequireAuth
export interface AuthRequest extends Request {
	user?: {
		address: string
	}
	walletAddress?: string
}
