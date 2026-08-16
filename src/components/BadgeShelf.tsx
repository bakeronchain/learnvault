import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Trophy, Lock, Award } from "lucide-react"

interface BadgeMetadata {
	name: string
	description: string
	image: string
	attributes: Array<{
		trait_type: string
		value: string
	}>
}

interface BadgeCatalogItem {
	badge_type: string
	metadata: BadgeMetadata
	earned: boolean
	token_id: string | null
	awarded_at: string | null
}

interface BadgeShelfResponse {
	address: string
	earned_badges: Array<{
		id: number
		learner_addr: string
		badge_type: string
		token_id: string | null
		tx_hash: string | null
		awarded_at: string
	}>
	badge_catalog: BadgeCatalogItem[]
}

const BADGE_DESCRIPTIONS: Record<string, string> = {
	first_completion: "Complete your first course to earn this badge",
	streak_30: "Maintain a 30-day learning streak to earn this badge",
	first_scholarship_funded: "Fund your first scholarship to earn this badge",
	top_10_leaderboard: "Reach the top 10 on the leaderboard to earn this badge",
}

export function BadgeShelf({ address }: { address: string }) {
	const { t } = useTranslation()
	const { data: badgeData, isLoading } = useQuery({
		queryKey: ["badges", address],
		queryFn: async () => {
			const response = await fetch(`/api/badges/${address}`)
			if (!response.ok) {
				throw new Error("Failed to fetch badges")
			}
			return response.json() as Promise<BadgeShelfResponse>
		},
		enabled: !!address,
	})

	if (isLoading) {
		return (
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				{[1, 2, 3, 4].map((i) => (
					<div
						key={i}
						className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 animate-pulse"
					>
						<div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-2" />
						<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto" />
					</div>
				))}
			</div>
		)
	}

	if (!badgeData) {
		return <div className="text-gray-500">No badges available</div>
	}

	const { badge_catalog } = badgeData

	return (
		<div className="space-y-4">
			<h3 className="text-lg font-semibold flex items-center gap-2">
				<Trophy className="w-5 h-5" />
				{t("badges.title", "Achievement Badges")}
			</h3>
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				{badge_catalog.map((badge) => (
					<BadgeCard key={badge.badge_type} badge={badge} />
				))}
			</div>
		</div>
	)
}

function BadgeCard({ badge }: { badge: BadgeCatalogItem }) {
	const { metadata, earned, badge_type } = badge
	const description = BADGE_DESCRIPTIONS[badge_type] || metadata.description

	return (
		<div
			className={`relative rounded-lg p-4 border-2 transition-all ${
				earned
					? "border-yellow-500 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20"
					: "border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 opacity-60"
			}`}
			title={earned ? metadata.name : description}
		>
			<div className="flex flex-col items-center text-center">
				<div className="relative">
					{earned ? (
						<Award className="w-12 h-12 text-yellow-600 dark:text-yellow-400" />
					) : (
						<Lock className="w-12 h-12 text-gray-400" />
					)}
				</div>
				<h4 className="mt-2 font-medium text-sm">{metadata.name}</h4>
				{earned && (
					<span className="text-xs text-green-600 dark:text-green-400 font-semibold">
						{t("badges.earned", "Earned")}
					</span>
				)}
				{!earned && (
					<span className="text-xs text-gray-500">{description}</span>
				)}
			</div>
		</div>
	)
}
