import confetti from "canvas-confetti"
import { AnimatePresence, motion } from "framer-motion"
import React, { useEffect, useState } from "react"

interface CelebrationProps {
	isOpen: boolean
	onClose: () => void
	rewardAmount: number
	newBalance: number
	lessonName: string
	isFinalMilestone?: boolean
}

const MilestoneCelebration: React.FC<CelebrationProps> = ({
	isOpen,
	onClose,
	rewardAmount,
	newBalance,
	lessonName,
	isFinalMilestone,
}) => {
	const [count, setCount] = useState(newBalance - rewardAmount)

	useEffect(() => {
		if (isOpen) {
			// 1. Fire Confetti
			void confetti({
				particleCount: 150,
				spread: 70,
				origin: { y: 0.6 },
				disableForReducedMotion: true, // Accessibility requirement
			})

			// 2. Animate Balance Count-up
			const timer = setTimeout(() => {
				setCount(newBalance)
			}, 500)
			return () => clearTimeout(timer)
		}
	}, [isOpen, newBalance])

	const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
		`Just earned ${rewardAmount} LRN completing ${lessonName} on @LearnVaultDAO! 🎓`,
	)}`

	return (
		<AnimatePresence>
			{isOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<motion.div
						initial={{ scale: 0.8, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={{ scale: 0.8, opacity: 0 }}
						className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-md w-full relative"
					>
						<h2 className="text-3xl font-bold text-slate-900 mb-2">
							{isFinalMilestone
								? "🏆 Track Complete!"
								: "🎉 Milestone Complete!"}
						</h2>
						<p className="text-slate-600 mb-6">
							You earned{" "}
							<span className="font-bold text-green-600">
								+{rewardAmount} LRN
							</span>
						</p>

						<div className="bg-slate-50 rounded-lg p-4 mb-6">
							<p className="text-xs uppercase tracking-widest text-slate-400 mb-1">
								Total Reputation
							</p>
							<p className="text-4xl font-mono font-bold text-slate-800">
								{count} LRN
							</p>
						</div>

						<div className="flex flex-col gap-3">
							<a
								href={twitterShareUrl}
								target="_blank"
								rel="noreferrer"
								className="bg-[#1DA1F2] text-white py-3 rounded-xl font-semibold hover:bg-[#1a8cd8] transition"
							>
								Share on Twitter
							</a>
							<button
								onClick={onClose}
								className="text-slate-500 hover:text-slate-800 transition py-2"
							>
								Continue Learning
							</button>
						</div>
					</motion.div>
				</div>
			)}
		</AnimatePresence>
	)
}

export default MilestoneCelebration
