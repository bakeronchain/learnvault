import { type Request, type Response } from "express"
import { pool } from "../db/index"
import { stellarContractService } from "../services/stellar-contract.service"

export interface UserProfile {
	id: string
	stellarAddress: string
	displayName: string | null
	bio: string | null
	avatarUrl: string | null
	avatarCid: string | null
	socialLinks: SocialLinks
	reputationRank: number | null
	createdAt: string
	updatedAt: string
}

export interface SocialLinks {
	twitter?: string
	github?: string
	linkedin?: string
	website?: string
	discord?: string
}

export interface ProfileStats {
	lrnBalance: number
	coursesCompleted: number
	reputationRank: number | null
	percentile: number
}

const DEFAULT_SOCIAL_LINKS: SocialLinks = {}

function parseSocialLinks(links: unknown): SocialLinks {
	if (typeof links !== "object" || links === null) return DEFAULT_SOCIAL_LINKS
	const obj = links as Record<string, unknown>
	return {
		twitter: typeof obj.twitter === "string" ? obj.twitter : undefined,
		github: typeof obj.github === "string" ? obj.github : undefined,
		linkedin: typeof obj.linkedin === "string" ? obj.linkedin : undefined,
		website: typeof obj.website === "string" ? obj.website : undefined,
		discord: typeof obj.discord === "string" ? obj.discord : undefined,
	}
}

function mapDbRowToProfile(row: Record<string, unknown>): UserProfile {
	return {
		id: String(row.id),
		stellarAddress: String(row.stellar_address),
		displayName: row.display_name ? String(row.display_name) : null,
		bio: row.bio ? String(row.bio) : null,
		avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
		avatarCid: row.avatar_cid ? String(row.avatar_cid) : null,
		socialLinks: parseSocialLinks(row.social_links),
		reputationRank: row.reputation_rank ? Number(row.reputation_rank) : null,
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at),
	}
}

function calculatePercentile(address: string, lrnBalance: number): number {
	const hash = address.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
	return Math.min(99, Math.max(1, Math.floor((hash + lrnBalance) % 100)))
}

export async function getUserProfile(
	req: Request,
	res: Response,
): Promise<void> {
	const { address } = req.params

	if (!address) {
		res.status(400).json({ error: "Stellar address is required" })
		return
	}

	try {
		// Fetch profile from database
		const profileResult = await pool.query(
			`SELECT * FROM user_profiles WHERE stellar_address = $1`,
			[address],
		)

		let profile: UserProfile | null = null
		if (profileResult.rows.length > 0) {
			profile = mapDbRowToProfile(profileResult.rows[0])
		}

		// Fetch on-chain stats
		const lrnBalance =
			await stellarContractService.getLearnTokenBalance(address)
		const enrolledCourses =
			await stellarContractService.getEnrolledCourses(address)
		const credentials =
			await stellarContractService.getScholarCredentials(address)

		// Fetch milestone stats
		const milestoneStatsResult = await pool.query(
			`SELECT 
				COUNT(*) FILTER (WHERE status = 'approved') AS completed,
				COUNT(*) FILTER (WHERE status = 'pending') AS pending
			 FROM milestone_reports
			 WHERE scholar_address = $1`,
			[address],
		)
		const stats = milestoneStatsResult.rows[0]

		// Calculate percentile
		const percentile = calculatePercentile(address, Number(lrnBalance))

		res.status(200).json({
			profile,
			stats: {
				lrnBalance,
				coursesCompleted: credentials.length,
				reputationRank: profile?.reputationRank ?? null,
				percentile,
			},
			milestones: {
				completed: Number(stats?.completed ?? 0),
				pending: Number(stats?.pending ?? 0),
			},
			credentials,
		})
	} catch (error) {
		console.error("[user-profile] Error fetching profile:", error)
		res.status(500).json({ error: "Failed to fetch user profile" })
	}
}

export async function upsertUserProfile(
	req: Request,
	res: Response,
): Promise<void> {
	const walletAddress = req.walletAddress

	if (!walletAddress) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const { displayName, bio, avatarUrl, avatarCid, socialLinks } = req.body

	// Validate inputs
	if (displayName !== undefined && displayName !== null) {
		if (typeof displayName !== "string" || displayName.length > 100) {
			res.status(400).json({
				error: "Display name must be a string with max 100 characters",
			})
			return
		}
	}

	if (bio !== undefined && bio !== null) {
		if (typeof bio !== "string" || bio.length > 1000) {
			res
				.status(400)
				.json({ error: "Bio must be a string with max 1000 characters" })
			return
		}
	}

	if (avatarUrl !== undefined && avatarUrl !== null) {
		if (typeof avatarUrl !== "string" || avatarUrl.length > 500) {
			res.status(400).json({
				error: "Avatar URL must be a valid URL with max 500 characters",
			})
			return
		}
	}

	if (avatarCid !== undefined && avatarCid !== null) {
		if (typeof avatarCid !== "string" || avatarCid.length > 100) {
			res.status(400).json({ error: "Avatar CID must be a valid IPFS CID" })
			return
		}
	}

	// Validate social links
	const validatedSocialLinks: SocialLinks = {}
	if (socialLinks !== undefined && socialLinks !== null) {
		if (typeof socialLinks !== "object") {
			res.status(400).json({ error: "Social links must be an object" })
			return
		}

		const allowedKeys = ["twitter", "github", "linkedin", "website", "discord"]
		for (const key of allowedKeys) {
			const value = (socialLinks as Record<string, unknown>)[key]
			if (value !== undefined && value !== null) {
				if (typeof value !== "string" || value.length > 200) {
					res.status(400).json({ error: `Invalid ${key} link` })
					return
				}
				validatedSocialLinks[key as keyof SocialLinks] = value
			}
		}
	}

	try {
		// Upsert profile (insert or update)
		const result = await pool.query(
			`INSERT INTO user_profiles 
			 (stellar_address, display_name, bio, avatar_url, avatar_cid, social_links)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 ON CONFLICT (stellar_address) 
			 DO UPDATE SET 
				display_name = COALESCE($2, user_profiles.display_name),
				bio = COALESCE($3, user_profiles.bio),
				avatar_url = COALESCE($4, user_profiles.avatar_url),
				avatar_cid = COALESCE($5, user_profiles.avatar_cid),
				social_links = user_profiles.social_links || COALESCE($6, '{}'::jsonb)
			 RETURNING *`,
			[
				walletAddress,
				displayName ?? null,
				bio ?? null,
				avatarUrl ?? null,
				avatarCid ?? null,
				JSON.stringify(validatedSocialLinks),
			],
		)

		const profile = mapDbRowToProfile(result.rows[0])
		res.status(200).json({ profile })
	} catch (error) {
		console.error("[user-profile] Error upserting profile:", error)
		res.status(500).json({ error: "Failed to update profile" })
	}
}

export async function deleteUserProfile(
	req: Request,
	res: Response,
): Promise<void> {
	const walletAddress = req.walletAddress

	if (!walletAddress) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	try {
		await pool.query(`DELETE FROM user_profiles WHERE stellar_address = $1`, [
			walletAddress,
		])
		res.status(200).json({ message: "Profile deleted successfully" })
	} catch (error) {
		console.error("[user-profile] Error deleting profile:", error)
		res.status(500).json({ error: "Failed to delete profile" })
	}
}
