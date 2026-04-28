import { type NextFunction, type Request, type Response } from "express"
import jwt from "jsonwebtoken"

<<<<<<< HEAD
const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, "\n").trim()
const JWT_SECRET = process.env.JWT_SECRET
const ADMIN_API_KEY = process.env.ADMIN_API_KEY
const ADMIN_ADDRESSES = (process.env.ADMIN_ADDRESSES ?? "")
	.split(",")
	.map((value) => value.trim())
	.filter(Boolean)
=======
import { JWT_AUDIENCE, JWT_ISSUER } from "../services/jwt.service"
>>>>>>> main

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
	// HS256 fallback is development-only; production must use RS256 via JWT_PUBLIC_KEY.
	if (process.env.NODE_ENV === "production") return undefined
	return process.env.JWT_SECRET?.trim()
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

<<<<<<< HEAD
	if (!JWT_PUBLIC_KEY && !JWT_SECRET) {
=======
	if (!jwtPublicKey && !jwtSecret) {
>>>>>>> main
		res.status(500).json({ error: "JWT verification not configured" })
		return
	}

	let decoded: TokenPayload
	try {
<<<<<<< HEAD
		if (JWT_PUBLIC_KEY) {
			decoded = jwt.verify(token, JWT_PUBLIC_KEY, {
				algorithms: ["RS256"],
			}) as TokenPayload
		} else {
			decoded = jwt.verify(token, JWT_SECRET!) as TokenPayload
=======
		if (jwtPublicKey) {
			decoded = jwt.verify(token, jwtPublicKey, {
				algorithms: ["RS256"],
				issuer: JWT_ISSUER,
				audience: JWT_AUDIENCE,
			}) as TokenPayload
		} else {
			decoded = jwt.verify(token, jwtSecret!) as TokenPayload
>>>>>>> main
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
