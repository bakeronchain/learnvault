import { type NextFunction, type Request, type Response } from "express"
import jwt from "jsonwebtoken"

import { pool } from "../db"

type TokenPayload = {
	sub?: string
	address?: string
	role?: string
	isAdmin?: boolean
}

export type TranslatorContext = {
	address: string
	language: string
	isAdminBypass: boolean
}

declare module "express-serve-static-core" {
	interface Request {
		translatorContext?: TranslatorContext
	}
}

export type LanguageResolver = (req: Request) => string | null

export const languageFromParam =
	(name = "languageCode"): LanguageResolver =>
	(req) =>
		typeof req.params[name] === "string" ? req.params[name] : null

export const languageFromQuery =
	(name = "language"): LanguageResolver =>
	(req) =>
		typeof req.query[name] === "string" ? (req.query[name] as string) : null

function getJwtPublicKey(): string | undefined {
	return process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, "\n").trim()
}

function getJwtSecret(): string | undefined {
	if (process.env.NODE_ENV === "production") return undefined
	const secret = process.env.JWT_SECRET?.trim()
	return secret && secret.length > 0 ? secret : undefined
}

function getAdminApiKey(): string | undefined {
	const apiKey = process.env.ADMIN_API_KEY?.trim()
	return apiKey && apiKey.length > 0 ? apiKey : undefined
}

function getAdminAddresses(): string[] {
	return (process.env.ADMIN_ADDRESSES ?? "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean)
}

// A course-admin (api key, JWT role=="admin"/isAdmin, or an allow-listed
// address) is authorized as a translator for every language — useful for
// bootstrapping/QA and for course-admins to seed initial translations.
function isCourseAdmin(req: Request, decoded: TokenPayload | null): boolean {
	const adminApiKey = getAdminApiKey()
	const providedApiKey = req.header("x-api-key")
	if (adminApiKey && providedApiKey && providedApiKey === adminApiKey) {
		return true
	}
	if (!decoded) return false
	const address = decoded.sub ?? decoded.address ?? ""
	const isAdminRole = decoded.role === "admin" || decoded.isAdmin === true
	const isAllowedAddress =
		address.length > 0 && getAdminAddresses().includes(address)
	return isAdminRole || isAllowedAddress
}

function verifyToken(req: Request): TokenPayload | null {
	const authHeader = req.headers.authorization
	if (!authHeader?.startsWith("Bearer ")) return null
	const token = authHeader.slice("Bearer ".length).trim()
	if (!token) return null

	const jwtPublicKey = getJwtPublicKey()
	const jwtSecret = getJwtSecret()
	if (!jwtPublicKey && !jwtSecret) return null

	try {
		if (jwtPublicKey) {
			return jwt.verify(token, jwtPublicKey, {
				algorithms: ["RS256"],
			}) as TokenPayload
		}
		return jwt.verify(token, jwtSecret!) as TokenPayload
	} catch {
		return null
	}
}

// Grants translator access scoped to a single language, resolved per-request
// via `resolveLanguage` (e.g. a :languageCode route param or a ?language=
// query param). Course-admins bypass the grants table entirely.
export function requireTranslator(resolveLanguage: LanguageResolver) {
	return async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		const decoded = verifyToken(req)

		if (isCourseAdmin(req, decoded)) {
			const language = resolveLanguage(req)
			if (!language) {
				res.status(400).json({ error: "A target language is required" })
				return
			}
			req.translatorContext = {
				address: decoded?.sub ?? decoded?.address ?? "admin",
				language,
				isAdminBypass: true,
			}
			next()
			return
		}

		if (!decoded) {
			res.status(401).json({ error: "Unauthorized" })
			return
		}

		const address = decoded.sub ?? decoded.address ?? ""
		if (!address) {
			res.status(401).json({ error: "Unauthorized" })
			return
		}

		const language = resolveLanguage(req)
		if (!language) {
			res.status(400).json({ error: "A target language is required" })
			return
		}

		const grant = (await pool.query(
			`SELECT 1 FROM translator_grants
			 WHERE wallet_address = $1 AND language_code = $2 AND revoked_at IS NULL
			 LIMIT 1`,
			[address, language],
		)) as { rowCount: number }

		if (grant.rowCount === 0) {
			res.status(403).json({
				error: `Not granted as a translator for language "${language}"`,
			})
			return
		}

		req.translatorContext = { address, language, isAdminBypass: false }
		next()
	}
}
