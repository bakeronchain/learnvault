import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import { BADGE_DEFINITIONS } from "../../constants/reputation"
import { getBadgeDisplayData, sortBadges } from "../../util/badges"
import type { BadgeType, UserBadge, BadgeDisplayData } from "../../types/gamification"
import styles from "./BadgeWall.module.css"

const CONTAINER_VARIANTS = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.05,
		},
	},
}

const BADGE_VARIANTS = {
	hidden: { opacity: 0, scale: 0.8 },
	visible: { opacity: 1, scale: 1 },
	hover: { scale: 1.05 },
}

export interface BadgeWallProps {
	/** User's earned badges with timestamps */
	earnedBadges: UserBadge[]
	/** Current stats for calculating badge eligibility */
	stats: {
		milestonesCompleted: number
		leaderboardRank: number | null
		votesCast: number
	}
	className?: string
}

/**
 * Badge Wall component displaying earned and locked badges.
 * Earned badges are shown in full color, locked badges are grayed out
 * with a tooltip explaining how to unlock them.
 */
export function BadgeWall({ earnedBadges, stats, className = "" }: BadgeWallProps) {
	const [hoveredBadge, setHoveredBadge] = useState<BadgeType | null>(null)

	// Get all badge types and their display data
	const allBadges = Object.keys(BADGE_DEFINITIONS) as BadgeType[]
	const badgeData: BadgeDisplayData[] = allBadges.map((type) =>
		getBadgeDisplayData(type, earnedBadges),
	)

	// Sort badges by earned status and rarity
	const sortedBadges = sortBadges(badgeData)

	return (
		<div className={`${styles.badgeWall} ${className}`}>
			<h2 className={styles.badgeWallTitle}>Achievement Badges</h2>
			<p className={styles.badgeWallSubtitle}>
				{sortedBadges.filter((b) => b.isEarned).length} of {sortedBadges.length} badges earned
			</p>

			<motion.div
				className={styles.badgeGrid}
				variants={CONTAINER_VARIANTS}
				initial="hidden"
				animate="visible"
			>
				{sortedBadges.map((badge) => (
					<motion.div
						key={badge.type}
						className={styles.badgeItem}
						variants={BADGE_VARIANTS}
						whileHover={!badge.isEarned ? undefined : BADGE_VARIANTS.hover}
						onMouseEnter={() => setHoveredBadge(badge.type)}
						onMouseLeave={() => setHoveredBadge(null)}
						role="img"
						aria-label={badge.isEarned ? badge.name : `Locked: ${badge.unlockHint}`}
					>
						<div
							className={`${styles.badgeIcon} ${!badge.isEarned ? styles.badgeIconLocked : ""}`}
							style={{
								backgroundColor: badge.isEarned ? badge.color : "#4b5563",
								borderColor: badge.isEarned ? badge.color : "#6b7280",
							}}
						>
							<span className={styles.badgeEmoji}>{badge.icon}</span>
							{badge.isEarned && (
								<div className={styles.badgeGlow} style={{ backgroundColor: badge.color }} />
							)}
						</div>

						{/* Tooltip for locked badges */}
						{!badge.isEarned && hoveredBadge === badge.type && (
							<motion.div
								className={styles.badgeTooltip}
								initial={{ opacity: 0, y: 5 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: 5 }}
							>
								<p className={styles.tooltipHint}>{badge.unlockHint}</p>
								<p className={styles.tooltipDesc}>{badge.description}</p>
							</motion.div>
						)}

						{/* Tooltip for earned badges */}
						{badge.isEarned && hoveredBadge === badge.type && (
							<motion.div
								className={styles.badgeTooltip}
								initial={{ opacity: 0, y: 5 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: 5 }}
							>
								<p className={styles.tooltipName}>{badge.name}</p>
								<p className={styles.tooltipDesc}>{badge.description}</p>
								{badge.earnedAt && (
									<p className={styles.tooltipDate}>
										Earned {badge.earnedAt.toLocaleDateString()}
									</p>
								)}
								<span
									className={styles.rarityBadge}
									style={{ backgroundColor: badge.color }}
								>
									{badge.rarity}
								</span>
							</motion.div>
						)}
					</motion.div>
				))}
			</motion.div>
		</div>
	)
}

export default BadgeWall
