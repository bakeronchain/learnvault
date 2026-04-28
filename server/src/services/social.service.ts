import { pool } from "../db"
import { socialStore } from "../db/social-store"
import { createEmailService } from "./email.service"

const emailService = createEmailService(process.env.EMAIL_API_KEY || "")

export const socialService = {
	async follow(
		followerAddress: string,
		followingAddress: string,
	): Promise<void> {
		if (followerAddress === followingAddress) {
			throw new Error("You cannot follow yourself")
		}

		await socialStore.follow(followerAddress, followingAddress)

		// Best-effort email notification
		this.notifyNewFollower(followerAddress, followingAddress).catch((err) =>
			console.error("[SocialService] Follow notification failed:", err),
		)
	},

	async unfollow(
		followerAddress: string,
		followingAddress: string,
	): Promise<void> {
		await socialStore.unfollow(followerAddress, followingAddress)
	},

	async getFollowCounts(address: string) {
		return socialStore.getFollowCounts(address)
	},

	async getFollowStatus(followerAddress: string, followingAddress: string) {
		const isFollowing = await socialStore.isFollowing(
			followerAddress,
			followingAddress,
		)
		const counts = await socialStore.getFollowCounts(followingAddress)
		return { isFollowing, ...counts }
	},

	async notifyNewFollower(
		followerAddress: string,
		followingAddress: string,
	): Promise<void> {
		// Try to find email for followingAddress
		// Since we don't have a users table, we look in escrow_timeouts where email is stored
		const result = await pool.query(
			`SELECT scholar_email
			 FROM escrow_timeouts 
			 WHERE scholar_address = $1 
			 ORDER BY created_at DESC LIMIT 1`,
			[followingAddress],
		)

		const target = result.rows[0]
		if (!target || !target.scholar_email) return

		// Use address as name if we don't have a name field
		const targetName = "Scholar"
		const followerName = followerAddress

		await emailService.sendNotification({
			to: target.scholar_email,
			subject: "You have a new follower!",
			template: "new-follower",
			data: {
				name: targetName,
				followerName: followerName,
				profileUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/scholars/${followingAddress}`,
			},
		})
	},
}
