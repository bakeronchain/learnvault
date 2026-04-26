import { Horizon } from "@stellar/stellar-sdk"
import { horizonUrl, rpcUrl, stellarNetwork } from "../contracts/util"

export interface SocialLinks {
	twitter?: string
	github?: string
	linkedin?: string
	website?: string
	discord?: string
}

export interface ProfileIdentity {
	displayName?: string
	bio: string
	avatarUrl?: string
	joinDateIso: string
	socialLinks?: SocialLinks
}

export interface SkillTrackCompletion {
	id: string
	title: string
	completedAt: string
}

export interface CredentialNft {
	id: string
	title: string
	imageUrl?: string
	earnedAt: string
}

export interface ScholarshipItem {
	id: string
	title: string
	status: "active" | "approved" | "rejected" | "completed"
	updatedAt: string
}

export interface ActivityItem {
	id: string
	description: string
	timestamp: string
}

export interface ProfileData {
	reputationScore: number
	lrnBalance: number
	percentile: number
	skillTracks: SkillTrackCompletion[]
	credentials: CredentialNft[]
	scholarships: ScholarshipItem[]
	activity: ActivityItem[]
}

const IDENTITY_KEY_PREFIX = "profileIdentity:"

const horizon = new Horizon.Server(horizonUrl, {
	allowHttp: stellarNetwork === "LOCAL",
})

const readEnv = (key: string): string | undefined => {
	const value = (import.meta.env as Record<string, unknown>)[key]
	return typeof value === "string" && value.length > 0 ? value : undefined
}

const contractIds = {
	learnToken: readEnv("PUBLIC_LEARN_TOKEN_CONTRACT"),
	courseMilestone: readEnv("PUBLIC_COURSE_MILESTONE_CONTRACT"),
	scholarNft: readEnv("PUBLIC_SCHOLAR_NFT_CONTRACT"),
	scholarshipGov: readEnv("PUBLIC_SCHOLARSHIP_GOVERNANCE_CONTRACT"),
}

const keyForIdentity = (walletAddress: string) =>
	`${IDENTITY_KEY_PREFIX}${walletAddress}`

export const getProfileIdentity = (walletAddress: string): ProfileIdentity => {
	const key = keyForIdentity(walletAddress)
	const raw = localStorage.getItem(key)
	if (!raw) {
		return {
			bio: "",
			joinDateIso: new Date().toISOString(),
		}
	}
	try {
		const parsed = JSON.parse(raw) as Partial<ProfileIdentity>
		return {
			displayName: parsed.displayName,
			bio: parsed.bio ?? "",
			avatarUrl: parsed.avatarUrl,
			joinDateIso: parsed.joinDateIso ?? new Date().toISOString(),
			socialLinks: parsed.socialLinks,
		}
	} catch {
		return {
			bio: "",
			joinDateIso: new Date().toISOString(),
		}
	}
}

export const updateProfileIdentity = (
	walletAddress: string,
	patch: Partial<
		Pick<ProfileIdentity, "displayName" | "bio" | "avatarUrl" | "socialLinks">
	>,
) => {
	const current = getProfileIdentity(walletAddress)
	const next: ProfileIdentity = {
		...current,
		...patch,
	}
	localStorage.setItem(keyForIdentity(walletAddress), JSON.stringify(next))
	return next
}

const parseFormattedNumber = (value: string | undefined): number => {
	if (!value) return 0
	return Number(value.replace(/,/g, "")) || 0
}

const simplePercentile = (
	walletAddress: string,
	lrnBalance: number,
): number => {
	const hash = walletAddress
		.split("")
		.reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
	const score = Math.min(99, Math.max(1, Math.floor((hash + lrnBalance) % 100)))
	return score
}

type RpcEvent = {
	id?: string
	ledger?: number
	ledgerCloseTime?: string
	topic?: unknown[]
	topics?: unknown[]
	value?: unknown
}

const fetchContractEvents = async (ids: string[]): Promise<RpcEvent[]> => {
	if (!ids.length) return []

	const response = await fetch(rpcUrl, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: "profile-events",
			method: "getEvents",
			params: {
				filters: [{ type: "contract", contractIds: ids }],
				pagination: { limit: 100 },
			},
		}),
	})

	if (!response.ok) return []
	const payload = (await response.json()) as {
		result?: { events?: RpcEvent[] }
	}
	return payload.result?.events ?? []
}

const stringifyEvent = (event: RpcEvent): string =>
	JSON.stringify({
		topic: event.topics ?? event.topic,
		value: event.value,
	})

const eventTimestamp = (event: RpcEvent): string =>
	event.ledgerCloseTime ?? new Date().toISOString()

export const loadProfileOnChainData = async (
	walletAddress: string,
): Promise<ProfileData> => {
	const account = await horizon.accounts().accountId(walletAddress).call()
	const lrnLine = account.balances.find(
		(b) => "asset_code" in b && b.asset_code?.toUpperCase() === "LRN",
	)
	const lrnBalance = parseFormattedNumber(lrnLine?.balance)
	const percentile = simplePercentile(walletAddress, lrnBalance)

	const events = await fetchContractEvents(
		[
			contractIds.learnToken,
			contractIds.courseMilestone,
			contractIds.scholarNft,
			contractIds.scholarshipGov,
		].filter((v): v is string => Boolean(v)),
	).catch(() => [])

	const relevant = events.filter((e) =>
		stringifyEvent(e).toLowerCase().includes(walletAddress.toLowerCase()),
	)

	const skillTracks = relevant
		.filter((e) => stringifyEvent(e).toLowerCase().includes("complete"))
		.slice(0, 6)
		.map((e, idx) => ({
			id: e.id ?? `skill-${idx}`,
			title: `Track completion #${idx + 1}`,
			completedAt: eventTimestamp(e),
		}))

	const credentials = relevant
		.filter((e) => stringifyEvent(e).toLowerCase().includes("mint"))
		.slice(0, 8)
		.map((e, idx) => ({
			id: e.id ?? `nft-${idx}`,
			title: `ScholarNFT #${idx + 1}`,
			earnedAt: eventTimestamp(e),
		}))

	const scholarships = relevant
		.filter((e) => {
			const text = stringifyEvent(e).toLowerCase()
			return (
				text.includes("proposal") ||
				text.includes("scholarship") ||
				text.includes("escrow")
			)
		})
		.slice(0, 6)
		.map((e, idx) => ({
			id: e.id ?? `proposal-${idx}`,
			title: `Proposal #${idx + 1}`,
			status: "active" as const,
			updatedAt: eventTimestamp(e),
		}))

	const activity = relevant.slice(0, 10).map((e, idx) => ({
		id: e.id ?? `activity-${idx}`,
		description: stringifyEvent(e),
		timestamp: eventTimestamp(e),
	}))

	return {
		reputationScore: Math.floor(lrnBalance),
		lrnBalance,
		percentile,
		skillTracks,
		credentials,
		scholarships,
		activity,
	}
}
