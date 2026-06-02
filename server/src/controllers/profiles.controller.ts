import { type Request, type Response } from "express"
import sanitizeHtml from "sanitize-html"
import { pool } from "../db/index"
import { userProfileSchema } from "../lib/zod-schemas"

// Options for sanitize-html. We allow basic formatting.
const sanitizeOptions = {
	allowedTags: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
	allowedAttributes: {
		a: ["href", "target", "rel"],
	},
}

export async function getProfile(req: Request, res: Response): Promise<void> {
	try {
		const { address } = req.params

		if (!address) {
			res.status(400).json({ error: "Address is required" })
			return
		}

		const query = `
			SELECT address, display_name, bio, avatar_url, twitter, github, website, created_at, updated_at
			FROM user_profiles
			WHERE address = $1
		`
		const { rows } = await pool.query(query, [address])

		if (rows.length === 0) {
			// Return 404 if no profile exists for the address
			res.status(404).json({ error: "Profile not found" })
			return
		}

		res.status(200).json(rows[0])
	} catch (error) {
		console.error("[getProfile] Error:", error)
		res.status(500).json({ error: "Internal server error" })
	}
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
	try {
		// The authMiddleware should attach the user object
		const user = (req as any).user
		if (!user || !user.address) {
			res.status(401).json({ error: "Unauthorized" })
			return
		}

		const address = user.address

		// Validate request body
		const validationResult = userProfileSchema.safeParse(req.body)
		if (!validationResult.success) {
			res.status(400).json({
				error: "Validation failed",
				details: validationResult.error.issues,
			})
			return
		}

		const data = validationResult.data

		// Sanitize bio if provided
		const cleanBio = data.bio ? sanitizeHtml(data.bio, sanitizeOptions) : null

		// Upsert logic
		const query = `
			INSERT INTO user_profiles (address, display_name, bio, avatar_url, twitter, github, website, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
			ON CONFLICT (address) DO UPDATE SET
				display_name = EXCLUDED.display_name,
				bio = EXCLUDED.bio,
				avatar_url = EXCLUDED.avatar_url,
				twitter = EXCLUDED.twitter,
				github = EXCLUDED.github,
				website = EXCLUDED.website,
				updated_at = CURRENT_TIMESTAMP
			RETURNING *
		`

		const values = [
			address,
			data.display_name ?? null,
			cleanBio,
			data.avatar_url ?? null,
			data.twitter ?? null,
			data.github ?? null,
			data.website ?? null,
		]

		const { rows } = await pool.query(query, values)
		res.status(200).json(rows[0])
	} catch (error: any) {
		console.error("[updateProfile] Error:", error)

		// Handle unique constraint violation for display_name
		if (error.code === "23505" || error.message.includes("unique constraint")) {
			res.status(409).json({ error: "Display name is already taken" })
			return
		}

		res.status(500).json({ error: "Internal server error" })
	}
}
