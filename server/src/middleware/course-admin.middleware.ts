import { type NextFunction, type Request, type Response } from "express"
import jwt from "jsonwebtoken"

const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, "\n").trim()
const JWT_SECRET = process.env.JWT_SECRET
const ADMIN_API_KEY = process.env.ADMIN_API_KEY
const ADMIN_ADDRESSES = (process.env.ADMIN_ADDRESSES ?? "")
	.split(",")
	.map((value) => value.trim())
	.filter(Boolean)

type TokenPayload = {
	sub?: string
	address?: string
	role?: string
	isAdmin?: boolean
}

export function requireCourseAdmin(
	req: Request,
	res: Response,
	next: NextFunction,
): void {
	const apiKey = req.header("x-api-key")
	if (ADMIN_API_KEY && apiKey && apiKey === ADMIN_API_KEY) {
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

	if (!JWT_PUBLIC_KEY && !JWT_SECRET) {
		res.status(500).json({ error: "JWT verification not configured" })
		return
	}

	let decoded: TokenPayload
	try {
		if (JWT_PUBLIC_KEY) {
			decoded = jwt.verify(token, JWT_PUBLIC_KEY, {
				algorithms: ["RS256"],
			}) as TokenPayload
		} else {
			decoded = jwt.verify(token, JWT_SECRET!) as TokenPayload
		}
	} catch {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const address = decoded.sub ?? decoded.address ?? ""
	const isAdminRole = decoded.role === "admin" || decoded.isAdmin === true
	const isAllowedAddress =
		address.length > 0 && ADMIN_ADDRESSES.includes(address)

	if (!isAdminRole && !isAllowedAddress) {
		res.status(403).json({ error: "Forbidden" })
		return
	}

	next()
}
