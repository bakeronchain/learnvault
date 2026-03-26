/**
 * src/util/mockLeaderboardData.ts
 *
 * Issue #31 — Build Community Leaderboard page
 * Generates deterministic mock learner data for the leaderboard demo.
 */

export interface LeaderboardEntry {
	id: string
	address: string
	lrnBalance: number
	coursesCompleted: number
	joinedDate: Date
	lastActive: Date
}

const SEED_ADDRESSES = [
	"GAQK3HKTQZUNX3PBFLBC5HTPVCLXB4WZVBGK4NU",
	"GBVNZ6FCYJQHGKQFMXALQ3YSRJ4EZPGTAAGQ3SL",
	"GD5C53LNBPNJMNXLSZSCMMDPZQCPSLAQ4XRFWRT",
	"GDPBF4WNX5RBFFQVWUKBPHQCV4AYDVD7RFRLHFR",
	"GCOWL4MPZIMHKSRLNAQXUXGUWJUDOZDTIVXZMQRT",
	"GCYQSF3X6KLQJVQPXDVXKYYZJFBNWMJT4GPTAMG",
	"GCFSTBBPHSDFMACIVVH7JDNBWFZQ5HTKTJKZS4U",
	"GAXD4BD4JKFG3WJBIZB4NFQZF6TJZPWX5HZJZXB",
	"GBZXN7PIRZGNMHGA7K3SBNRN2HDWBKUGJXGFXJB",
	"GCT5XVLS2GKUMK5DW5ZIQJAJBYH4FZLPBHCXMRU",
]

function hashCode(str: string): number {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash |= 0
	}
	return Math.abs(hash)
}

function deterministicRandom(seed: number, min: number, max: number): number {
	const x = Math.sin(seed) * 10000
	return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min
}

const NOW = new Date("2026-03-24T00:00:00Z").getTime()
const ONE_DAY = 86400000

export function generateLeaderboard(
	connectedAddress?: string,
): LeaderboardEntry[] {
	const entries: LeaderboardEntry[] = SEED_ADDRESSES.map((addr, idx) => {
		const seed = hashCode(addr)
		const lrnBalance = deterministicRandom(seed, 1000, 99000) * 10000000
		const coursesCompleted = deterministicRandom(seed + 1, 1, 20)
		const daysAgo = deterministicRandom(seed + 2, 30, 730)
		const joinedDate = new Date(NOW - daysAgo * ONE_DAY)
		const lastActiveDaysAgo = deterministicRandom(seed + 3, 0, 60)
		const lastActive = new Date(NOW - lastActiveDaysAgo * ONE_DAY)

		return {
			id: `user-${idx}`,
			address: addr,
			lrnBalance,
			coursesCompleted,
			joinedDate,
			lastActive,
		}
	})

	// Inject more entries to reach 100
	for (let i = 10; i < 100; i++) {
		const fakeSuffix = String(i).padStart(8, "0")
		const addr = `G${fakeSuffix}LEARNVAULTMOCK${String(i).padStart(12, "0")}`
		const seed = i * 7919
		const lrnBalance = deterministicRandom(seed, 100, 50000) * 10000000
		const coursesCompleted = deterministicRandom(seed + 1, 0, 15)
		const daysAgo = deterministicRandom(seed + 2, 30, 730)
		const joinedDate = new Date(NOW - daysAgo * ONE_DAY)
		const lastActiveDaysAgo = deterministicRandom(seed + 3, 0, 60)
		const lastActive = new Date(NOW - lastActiveDaysAgo * ONE_DAY)
		entries.push({
			id: `user-${i}`,
			address: addr,
			lrnBalance,
			coursesCompleted,
			joinedDate,
			lastActive,
		})
	}

	// Inject connected wallet so the sticky row always shows a real match
	if (connectedAddress) {
		const existing = entries.find((e) => e.address === connectedAddress)
		if (!existing) {
			const seed = hashCode(connectedAddress)
			entries.push({
				id: "connected-user",
				address: connectedAddress,
				lrnBalance: deterministicRandom(seed, 200, 30000) * 10000000,
				coursesCompleted: deterministicRandom(seed + 1, 1, 10),
				joinedDate: new Date(NOW - 90 * ONE_DAY),
				lastActive: new Date(NOW),
			})
		}
	}

	// Sort descending by LRN balance
	return entries
		.sort((a, b) => b.lrnBalance - a.lrnBalance)
		.map(
			(entry, index) =>
				({ ...entry, rank: index + 1 }) as LeaderboardEntry & { rank: number },
		)
}

export function filterByTime(
	entries: LeaderboardEntry[],
	filter: "all" | "month" | "week",
): LeaderboardEntry[] {
	if (filter === "all") return entries
	const cutoff = filter === "week" ? NOW - 7 * ONE_DAY : NOW - 30 * ONE_DAY
	return entries.filter((e) => e.lastActive.getTime() >= cutoff)
}

export function shortenAddr(address: string): string {
	if (address.length <= 12) return address
	return `${address.slice(0, 6)}...${address.slice(-6)}`
}
