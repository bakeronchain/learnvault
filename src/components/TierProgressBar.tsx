import { motion } from "framer-motion"
import {
	REPUTATION_TIERS,
	getCurrentTierIndex,
	getLrnToNextRank,
	getNextTier,
	getTierProgress,
} from "../constants/reputation"
import { formatLrnBalance } from "../util/tokenFormat"
import styles from "./TierProgressBar.module.css"

export interface TierProgressBarProps {
	/** Current LRN balance */
	currentLrn: number
	/** Optional className override */
	className?: string
	/** Hide the LRN amount display */
	hideAmount?: boolean
}

/**
 * Tier progress bar showing current LRN, next tier info, and progress percentage.
 */
export function TierProgressBar({
	currentLrn,
	className = "",
	hideAmount = false,
}: TierProgressBarProps) {
	const safeLrn = Number.isFinite(currentLrn) ? Math.max(0, currentLrn) : 0
	const currentTierIndex = getCurrentTierIndex(safeLrn)
	const nextTier = getNextTier(safeLrn)
	const progressPercent = getTierProgress(safeLrn)
	const lrnToNext = getLrnToNextRank(safeLrn)

	const currentTier = REPUTATION_TIERS[currentTierIndex]

	if (!currentTier) return null

	return (
		<div className={`${styles.tierProgress} ${className}`}>
			<div className={styles.tierProgressHeader}>
				<div className={styles.tierInfo}>
					<span
						className={styles.tierIndicator}
						style={{ backgroundColor: currentTier.color }}
					/>
					<span className={styles.currentTierName}>{currentTier.name}</span>
				</div>

				{!hideAmount && (
					<span className={styles.currentLrn}>{formatLrnBalance(safeLrn)} LRN</span>
				)}
			</div>

			<div className={styles.progressBarContainer}>
				<motion.div
					className={styles.progressBarFill}
					style={{ backgroundColor: currentTier.color }}
					initial={{ width: 0 }}
					animate={{ width: `${progressPercent}%` }}
					transition={{ duration: 0.8, ease: "easeOut" }}
				/>
			</div>

			<div className={styles.tierProgressFooter}>
				{nextTier ? (
					<>
						<span className={styles.progressPercent}>{progressPercent}%</span>
						<span className={styles.nextTierInfo}>
							Next: <span style={{ color: nextTier.color }}>{nextTier.name}</span>
							{lrnToNext > 0 && (
								<span className={styles.lrnToNext}>
									(+{formatLrnBalance(lrnToNext)} LRN)
								</span>
							)}
						</span>
					</>
				) : (
					<span className={styles.maxTier}>Maximum tier reached!</span>
				)}
			</div>
		</div>
	)
}

export default TierProgressBar
