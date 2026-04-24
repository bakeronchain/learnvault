import { useState, useEffect, useCallback, useRef } from "react"
import {
	REPUTATION_TIERS,
	getCurrentTierIndex,
	getNextTier,
} from "../constants/reputation"
import type { TierUpEvent } from "../types/gamification"

export interface UseTierProgressResult {
	/** Current LRN balance */
	currentLrn: number
	/** Current tier index */
	currentTierIndex: number
	/** Current tier data */
	currentTier: (typeof REPUTATION_TIERS)[number] | null
	/** Next tier data (null if max tier) */
	nextTier: (typeof REPUTATION_TIERS)[number] | null
	/** Progress percentage to next tier (0-100) */
	progressPercent: number
	/** LRN needed for next tier */
	lrnToNext: number
	/** Whether at maximum tier */
	isMaxTier: boolean
	/** Updates the LRN balance (call when balance changes) */
	updateLrn: (newLrn: number) => void
	/** Tier up event if one occurred, null otherwise */
	tierUpEvent: TierUpEvent | null
	/** Dismiss the tier up event */
	dismissTierUp: () => void
}

/**
 * Hook for managing tier progression state and detecting tier ups.
 */
export function useTierProgress(initialLrn: number): UseTierProgressResult {
	const [currentLrn, setCurrentLrn] = useState(initialLrn)
	const [tierUpEvent, setTierUpEvent] = useState<TierUpEvent | null>(null)
	const previousTierIndexRef = useRef(getCurrentTierIndex(initialLrn))

	const currentTierIndex = getCurrentTierIndex(currentLrn)
	const currentTier = REPUTATION_TIERS[currentTierIndex] ?? null
	const nextTier = getNextTier(currentLrn)
	const isMaxTier = nextTier === null

	// Calculate progress percentage
	const progressPercent = isMaxTier
		? 100
		: currentTier
			? Math.round(
				((currentLrn - currentTier.minLrn) /
					((nextTier?.minLrn ?? currentTier.minLrn + 1) - currentTier.minLrn)) *
				100,
			)
			: 0

	// Calculate LRN to next tier
	const lrnToNext = isMaxTier
		? 0
		: (nextTier?.minLrn ?? currentLrn) - currentLrn

	// Check for tier up when LRN changes
	useEffect(() => {
		if (currentTierIndex > previousTierIndexRef.current && currentTier) {
			const previousTier = REPUTATION_TIERS[previousTierIndexRef.current]
			if (previousTier) {
				setTierUpEvent({
					previousTier,
					newTier: currentTier,
					previousLrn: previousTier.maxLrn === Infinity ? currentLrn : previousTier.maxLrn,
					newLrn: currentLrn,
				})
			}
		}
		previousTierIndexRef.current = currentTierIndex
	}, [currentTierIndex, currentLrn, currentTier])

	const updateLrn = useCallback((newLrn: number) => {
		setCurrentLrn(newLrn)
	}, [])

	const dismissTierUp = useCallback(() => {
		setTierUpEvent(null)
	}, [])

	return {
		currentLrn,
		currentTierIndex,
		currentTier,
		nextTier,
		progressPercent,
		lrnToNext,
		isMaxTier,
		updateLrn,
		tierUpEvent,
		dismissTierUp,
	}
}

export default useTierProgress
