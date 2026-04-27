import { type Response } from "express"
import { type AuthRequest } from "../middleware/auth.middleware"
import { socialService } from "../services/social.service"

export async function followScholar(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const { address: followingAddress } = req.params
	const followerAddress = req.user?.address

	if (!followerAddress) {
		res.status(401).json({ error: "Authentication required" })
		return
	}

	try {
		await socialService.follow(followerAddress, followingAddress)
		const status = await socialService.getFollowStatus(
			followerAddress,
			followingAddress,
		)
		res.status(200).json({ data: status })
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Failed to follow scholar"
		res.status(400).json({ error: message })
	}
}

export async function unfollowScholar(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const { address: followingAddress } = req.params
	const followerAddress = req.user?.address

	if (!followerAddress) {
		res.status(401).json({ error: "Authentication required" })
		return
	}

	try {
		await socialService.unfollow(followerAddress, followingAddress)
		const status = await socialService.getFollowStatus(
			followerAddress,
			followingAddress,
		)
		res.status(200).json({ data: status })
	} catch (err) {
		res.status(500).json({ error: "Failed to unfollow scholar" })
	}
}

export async function getFollowStatus(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const { address: followingAddress } = req.params
	const followerAddress = req.user?.address

	try {
		const status = await socialService.getFollowStatus(
			followerAddress || "none",
			followingAddress,
		)
		res.status(200).json({ data: status })
	} catch (err) {
		res.status(500).json({ error: "Failed to fetch follow status" })
	}
}
