import { useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"
import styles from "./TierUpCelebration.module.css"

export interface TierUpCelebrationProps {
	/** Whether to trigger the celebration */
	isOpen: boolean
	/** Previous tier name */
	previousTier: string
	/** New tier name */
	newTier: string
	/** Callback when animation completes */
	onComplete?: () => void
}

/**
 * Tier up celebration component with confetti animation.
 * Respects prefers-reduced-motion and only triggers once per tier change.
 */
export function TierUpCelebration({
	isOpen,
	previousTier,
	newTier,
	onComplete,
}: TierUpCelebrationProps) {
	const hasTriggered = useRef(false)
	const animationComplete = useRef(false)

	useEffect(() => {
		if (!isOpen || hasTriggered.current) return

		hasTriggered.current = true

		// Check for reduced motion preference
		const prefersReducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches

		if (!prefersReducedMotion) {
			// Trigger confetti burst
			void confetti({
				particleCount: 150,
				spread: 80,
				origin: { y: 0.6 },
				disableForReducedMotion: true,
				colors: ["#7c3aed", "#ec4899", "#eab308", "#22c55e", "#3b82f6"],
			})

			// Second burst after delay
			setTimeout(() => {
				void confetti({
					particleCount: 100,
					spread: 60,
					origin: { y: 0.7 },
					disableForReducedMotion: true,
					colors: ["#7c3aed", "#ec4899", "#eab308"],
				})
			}, 300)
		}

		// Call onComplete after animation duration
		const timer = setTimeout(() => {
			animationComplete.current = true
			onComplete?.()
		}, 3000)

		return () => clearTimeout(timer)
	}, [isOpen, onComplete])

	// Reset trigger flag when closed
	useEffect(() => {
		if (!isOpen) {
			hasTriggered.current = false
			animationComplete.current = false
		}
	}, [isOpen])

	if (!isOpen) return null

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					className={styles.overlay}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
				>
					<motion.div
						className={styles.celebrationCard}
						initial={{ scale: 0.5, opacity: 0, y: 50 }}
						animate={{ scale: 1, opacity: 1, y: 0 }}
						exit={{ scale: 0.5, opacity: 0, y: 50 }}
						transition={{ type: "spring", damping: 15, stiffness: 300 }}
					>
						<div className={styles.tierUpIcon}>🎉</div>

						<motion.h2
							className={styles.tierUpTitle}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2 }}
						>
							Tier Up!
						</motion.h2>

						<motion.div
							className={styles.tierTransition}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.4 }}
						>
							<span className={styles.oldTier}>{previousTier}</span>
							<span className={styles.arrow}>→</span>
							<span className={styles.newTier}>{newTier}</span>
						</motion.div>

						<motion.p
							className={styles.congratsMessage}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.6 }}
						>
							Congratulations on reaching {newTier}!
						</motion.p>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

export default TierUpCelebration
