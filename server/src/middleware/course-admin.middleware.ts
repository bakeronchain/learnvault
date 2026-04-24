import { type NextFunction, type Request, type Response } from "express"
import jwt from "jsonwebtoken"

const DEFAULT_NON_PROD_JWT_SECRET = "learnvault-secret"

type TokenPayload = {
	sub?: string
	address?: string
	role?: string
	isAdmin?: boolean
}

function getJwtPublicKey(): string | undefined {
	return process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, "\n").trim()
}

function getJwtSecret(): string | undefined {
	const secret = process.env.JWT_SECRET?.trim()
	if (secret) return secret
	if (process.env.NODE_ENV === "production") return undefined

	return DEFAULT_NON_PROD_JWT_SECRET
}

function getAdminApiKey(): string | undefined {
	const apiKey = process.env.ADMIN_API_KEY?.trim()
	return apiKey || undefined
}

function getAdminAddresses(): string[] {
	return (process.env.ADMIN_ADDRESSES ?? "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean)
}

function wantsUnpublishedCourses(req: Request): boolean {
	const rawValue = req.query.includeUnpublished
	if (typeof rawValue !== "string") return false

	return ["1", "true", "yes"].includes(rawValue.trim().toLowerCase())
}

export function requireCourseAdmin(
	req: Request,
	res: Response,
	next: NextFunction,
): void {
	const jwtPublicKey = getJwtPublicKey()
	const jwtSecret = getJwtSecret()
	const adminApiKey = getAdminApiKey()
	const adminAddresses = getAdminAddresses()
	const apiKey = req.header("x-api-key")
	if (adminApiKey && apiKey && apiKey === adminApiKey) {
		next()
		return
	}

	const authHeader = req.headers.authorization
	if (!authHeader?.startsWith("Bearer ")) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const token = authHeader.slice("Bearer ".length).trim()
	if (!token) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	if (!jwtPublicKey && !jwtSecret) {
		res.status(500).json({ error: "JWT verification not configured" })
		return
	}

	let decoded: TokenPayload
	try {
		if (jwtPublicKey) {
			decoded = jwt.verify(token, jwtPublicKey, {
				algorithms: ["RS256"],
			}) as TokenPayload
		} else {
			decoded = jwt.verify(token, jwtSecret!) as TokenPayload
		}
	} catch {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const address = decoded.sub ?? decoded.address ?? ""
	const isAdminRole = decoded.role === "admin" || decoded.isAdmin === true
	const isAllowedAddress =
		address.length > 0 && adminAddresses.includes(address)

	if (!isAdminRole && !isAllowedAddress) {
		res.status(403).json({ error: "Forbidden" })
		return
	}

	next()
}

export function requireCourseAdminIfRequested(
	req: Request,
	res: Response,
	next: NextFunction,
): void {
	if (!wantsUnpublishedCourses(req)) {
		next()
		return
	}

	requireCourseAdmin(req, res, next)
}
