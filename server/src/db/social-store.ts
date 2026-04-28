import { pool } from "./index"

export interface FollowCounts {
	followerCount: number
	followingCount: number
}

export const socialStore = {
	async follow(
		followerAddress: string,
		followingAddress: string,
	): Promise<void> {
		await pool.query(
			`INSERT INTO follows (follower_address, following_address)
			 VALUES ($1, $2)
			 ON CONFLICT (follower_address, following_address) DO NOTHING`,
			[followerAddress, followingAddress],
		)
	},

	async unfollow(
		followerAddress: string,
		followingAddress: string,
	): Promise<void> {
		await pool.query(
			`DELETE FROM follows
			 WHERE follower_address = $1 AND following_address = $2`,
			[followerAddress, followingAddress],
		)
	},

	async isFollowing(
		followerAddress: string,
		followingAddress: string,
	): Promise<boolean> {
		const result = await pool.query(
			`SELECT 1 FROM follows
			 WHERE follower_address = $1 AND following_address = $2`,
			[followerAddress, followingAddress],
		)
		return result.rows.length > 0
	},

	async getFollowCounts(address: string): Promise<FollowCounts> {
		const [followers, following] = await Promise.all([
			pool.query("SELECT COUNT(*) FROM follows WHERE following_address = $1", [
				address,
			]),
			pool.query("SELECT COUNT(*) FROM follows WHERE follower_address = $1", [
				address,
			]),
		])

		return {
			followerCount: Number(followers.rows[0]?.count ?? 0),
			followingCount: Number(following.rows[0]?.count ?? 0),
		}
	},

	async getFollowedAddresses(followerAddress: string): Promise<string[]> {
		const result = await pool.query(
			"SELECT following_address FROM follows WHERE follower_address = $1",
			[followerAddress],
		)
		return result.rows.map((r) => r.following_address)
	},
}
