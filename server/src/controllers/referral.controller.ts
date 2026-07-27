import crypto from "node:crypto"
import { type Response, type Request } from "express"
import { pool } from "../db"
import { type AuthRequest } from "../middleware/auth.middleware"

function generateReferralCode(): string {
	return crypto.randomBytes(6).toString("base64url")
}

async function getOrCreateCode(address: string): Promise<string> {
	const existing = await pool.query(
		"SELECT code FROM referrals WHERE referrer_addr = $1 AND referred_addr = $1 LIMIT 1",
		[address],
	)
	if (existing.rows.length > 0) {
		return existing.rows[0].code as string
	}

	for (let i = 0; i < 10; i++) {
		const code = generateReferralCode()
		const result = await pool.query(
			"INSERT INTO referrals (referrer_addr, referred_addr, code) VALUES ($1, $1, $2) ON CONFLICT (referred_addr) DO NOTHING RETURNING code",
			[address, code],
		)
		if (result.rows.length > 0) {
			return result.rows[0].code as string
		}
	}

	throw new Error("Failed to generate unique referral code")
}

export async function getReferralCode(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const address = req.user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	try {
		const code = await getOrCreateCode(address)

		const stats = await pool.query(
			`SELECT
				 COUNT(*) FILTER (WHERE status = 'pending')  AS pending_count,
				 COUNT(*) FILTER (WHERE status = 'qualified') AS qualified_count,
				 COUNT(*) FILTER (WHERE status = 'rewarded')  AS rewarded_count
			 FROM referrals
			 WHERE referrer_addr = $1 AND referred_addr != $1`,
			[address],
		)

		res.json({
			code,
			link: `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/?ref=${code}`,
			stats: stats.rows[0],
		})
	} catch (err) {
		res.status(500).json({ error: "Failed to get referral code" })
	}
}

export async function claimReferral(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const address = req.user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const code = (req.body?.code as string | undefined)?.trim()
	if (!code) {
		res.status(400).json({ error: "Missing required field: code" })
		return
	}

	try {
		const referrer = await pool.query(
			"SELECT referrer_addr FROM referrals WHERE code = $1 AND referred_addr = referrer_addr LIMIT 1",
			[code],
		)
		if (referrer.rows.length === 0) {
			res.status(404).json({ error: "Invalid referral code" })
			return
		}

		const referrerAddr = referrer.rows[0].referrer_addr as string
		if (referrerAddr === address) {
			res.status(400).json({ error: "Cannot refer yourself" })
			return
		}

		const alreadyReferred = await pool.query(
			"SELECT id FROM referrals WHERE referred_addr = $1 AND referred_addr != referrer_addr LIMIT 1",
			[address],
		)
		if (alreadyReferred.rows.length > 0) {
			res.status(409).json({ error: "Already referred by someone" })
			return
		}

		const sybil = await pool.query(
			`SELECT COUNT(*)::int AS count
			 FROM identity_verifications
			 WHERE wallet_address = $1 AND status = 'verified'`,
			[address],
		)
		if (sybil.rows[0].count < 1) {
			res
				.status(403)
				.json({ error: "Complete at least one identity verification first" })
			return
		}

		await pool.query(
			"INSERT INTO referrals (referrer_addr, referred_addr, code, status) VALUES ($1, $2, $3, 'pending')",
			[referrerAddr, address, code],
		)

		res.status(201).json({ message: "Referral claimed successfully" })
	} catch (err) {
		if (
			err instanceof Error &&
			err.message.includes("duplicate key") &&
			err.message.includes("referred_addr")
		) {
			res.status(409).json({ error: "Already referred by someone" })
			return
		}
		res.status(500).json({ error: "Failed to claim referral" })
	}
}

export async function getMyReferrals(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const address = req.user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	try {
		const result = await pool.query(
			`SELECT id, referred_addr, status, qualified_at, created_at
			 FROM referrals
			 WHERE referrer_addr = $1 AND referred_addr != $1
			 ORDER BY created_at DESC`,
			[address],
		)

		res.json({ data: result.rows })
	} catch (err) {
		res.status(500).json({ error: "Failed to fetch referrals" })
	}
}
