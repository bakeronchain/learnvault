import { pool } from "../db/index"
import { pinJsonToIPFS } from "./pinata.service"
import {
	stellarContractService,
	type ContractCallResult,
} from "./stellar-contract.service"

export interface BadgeMintResult {
	minted: boolean
	tokenId?: string
	tokenUri?: string
	mintTxHash?: string | null
	simulated?: boolean
}

export interface BadgeMetadata {
	name: string
	description: string
	image: string
	attributes: Array<{
		trait_type: string
		value: string
	}>
}

export interface BadgeRule {
	badgeType: string
	name: string
	description: string
	image: string
	checkCondition: (address: string) => Promise<boolean>
}

// Badge type definitions
export const BADGE_TYPES = {
	FIRST_COMPLETION: "first_completion",
	STREAK_30: "streak_30",
	FIRST_SCHOLARSHIP_FUNDED: "first_scholarship_funded",
	TOP_10_LEADERBOARD: "top_10_leaderboard",
} as const

// Badge metadata templates
const BADGE_METADATA_TEMPLATES: Record<string, BadgeMetadata> = {
	[BADGE_TYPES.FIRST_COMPLETION]: {
		name: "First Course Completed",
		description: "Awarded for completing your first course on LearnVault",
		image: "ipfs://bafkreihdwdcefgh4dqkjv67uzcmw7oj5ulnmrg2ibnong2tefnifowzjte",
		attributes: [
			{ trait_type: "Category", value: "Learning" },
			{ trait_type: "Rarity", value: "Common" },
		],
	},
	[BADGE_TYPES.STREAK_30]: {
		name: "30-Day Streak",
		description: "Awarded for maintaining a 30-day learning streak",
		image: "ipfs://bafkreihdwdcefgh4dqkjv67uzcmw7oj5ulnmrg2ibnong2tefnifowzjte",
		attributes: [
			{ trait_type: "Category", value: "Consistency" },
			{ trait_type: "Rarity", value: "Rare" },
		],
	},
	[BADGE_TYPES.FIRST_SCHOLARSHIP_FUNDED]: {
		name: "First Scholarship Funded",
		description: "Awarded for funding your first scholarship",
		image: "ipfs://bafkreihdwdcefgh4dqkjv67uzcmw7oj5ulnmrg2ibnong2tefnifowzjte",
		attributes: [
			{ trait_type: "Category", value: "Philanthropy" },
			{ trait_type: "Rarity", value: "Epic" },
		],
	},
	[BADGE_TYPES.TOP_10_LEADERBOARD]: {
		name: "Top 10 Leaderboard",
		description: "Awarded for reaching the top 10 on the leaderboard",
		image: "ipfs://bafkreihdwdcefgh4dqkjv67uzcmw7oj5ulnmrg2ibnong2tefnifowzjte",
		attributes: [
			{ trait_type: "Category", value: "Achievement" },
			{ trait_type: "Rarity", value: "Legendary" },
		],
	},
}

async function generateAndPinBadgeMetadata(
	learnerAddress: string,
	badgeType: string,
): Promise<string> {
	const template = BADGE_METADATA_TEMPLATES[badgeType]
	if (!template) {
		throw new Error(`Unknown badge type: ${badgeType}`)
	}

	const metadata = {
		...template,
		attributes: [
			...template.attributes,
			{ trait_type: "Learner", value: learnerAddress },
			{ trait_type: "Awarded At", value: new Date().toISOString() },
		],
	}

	const cid = await pinJsonToIPFS(metadata, `badge-${badgeType}-${learnerAddress}`)
	return `ipfs://${cid}`
}

async function hasBadge(
	learnerAddress: string,
	badgeType: string,
): Promise<boolean> {
	const result = await pool.query(
		"SELECT id FROM achievement_badges WHERE learner_addr = $1 AND badge_type = $2",
		[learnerAddress, badgeType],
	)
	return result.rows.length > 0
}

async function mintBadge(
	learnerAddress: string,
	badgeType: string,
): Promise<BadgeMintResult> {
	// Check if badge already exists (idempotency)
	const existing = await hasBadge(learnerAddress, badgeType)
	if (existing) {
		return { minted: false }
	}

	const tokenUri = await generateAndPinBadgeMetadata(learnerAddress, badgeType)

	const mintResult: ContractCallResult =
		await stellarContractService.callMintAchievementBadge(
			learnerAddress,
			badgeType,
			tokenUri,
		)

	// Store in database
	if (mintResult.tokenId) {
		await pool.query(
			`INSERT INTO achievement_badges (learner_addr, badge_type, token_id, tx_hash)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (learner_addr, badge_type) DO NOTHING`,
			[
				learnerAddress,
				badgeType,
				String(mintResult.tokenId),
				mintResult.txHash || null,
			],
		)
	}

	return {
		minted: true,
		tokenId: mintResult.tokenId ? String(mintResult.tokenId) : undefined,
		tokenUri,
		mintTxHash: mintResult.txHash,
		simulated: mintResult.simulated,
	}
}

async function getBadgesForAddress(
	learnerAddress: string,
): Promise<Array<{
	id: number
	learner_addr: string
	badge_type: string
	token_id: string | null
	tx_hash: string | null
	awarded_at: Date
}>> {
	const result = await pool.query(
		"SELECT * FROM achievement_badges WHERE learner_addr = $1 ORDER BY awarded_at DESC",
		[learnerAddress],
	)
	return result.rows
}

async function getAllBadgeTypes(): Promise<Array<{ badge_type: string; metadata: BadgeMetadata }>> {
	return Object.entries(BADGE_METADATA_TEMPLATES).map(([badgeType, metadata]) => ({
		badge_type: badgeType,
		metadata,
	}))
}

export const badgeService = {
	BADGE_TYPES,
	BADGE_METADATA_TEMPLATES,
	hasBadge,
	mintBadge,
	getBadgesForAddress,
	getAllBadgeTypes,
	generateAndPinBadgeMetadata,
}
