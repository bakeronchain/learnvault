import confetti from "canvas-confetti"
import { AnimatePresence, motion } from "framer-motion"
import React, { useEffect, useId, useRef, useState } from "react"

interface CelebrationProps {
	isOpen: boolean
	onClose: () => void
	rewardAmount: number
	newBalance: number
	lessonName: string
	isFinalMilestone?: boolean
}

const focusableSelectors = [
	"a[href]",
	"button:not([disabled])",
	"textarea:not([disabled])",
	"input:not([disabled])",
	"select:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(",")

const MilestoneCelebration: React.FC<CelebrationProps> = ({
	isOpen,
	onClose,
	rewardAmount,
	newBalance,
	lessonName,
	isFinalMilestone,
}) => {
	const [count, setCount] = useState(newBalance - rewardAmount)
	const titleId = useId()
	const descriptionId = useId()
	const dialogRef = useRef<HTMLDivElement>(null)
	const closeButtonRef = useRef<HTMLButtonElement>(null)
	const previousFocusRef = useRef<HTMLElement | null>(null)

	useEffect(() => {
		if (!isOpen) return

		setCount(newBalance - rewardAmount)
		void confetti({
			particleCount: 150,
			spread: 70,
			origin: { y: 0.6 },
			disableForReducedMotion: true,
		})

		const timer = window.setTimeout(() => {
			setCount(newBalance)
		}, 500)

		return () => window.clearTimeout(timer)
	}, [isOpen, newBalance, rewardAmount])

	useEffect(() => {
		if (!isOpen) return

		previousFocusRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null

		const frame = window.requestAnimationFrame(() => {
			closeButtonRef.current?.focus() ?? dialogRef.current?.focus()
		})

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault()
				onClose()
				return
			}

			if (event.key !== "Tab") return

			const dialog = dialogRef.current
			if (!dialog) return

			const focusable = Array.from(
				dialog.querySelectorAll<HTMLElement>(focusableSelectors),
			)

			if (focusable.length === 0) {
				event.preventDefault()
				dialog.focus()
				return
			}

			const first = focusable[0]!
			const last = focusable[focusable.length - 1]!

			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault()
				last.focus()
			}

			if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault()
				first.focus()
			}
		}

		document.addEventListener("keydown", handleKeyDown)

		return () => {
			window.cancelAnimationFrame(frame)
			document.removeEventListener("keydown", handleKeyDown)
			previousFocusRef.current?.focus()
		}
	}, [isOpen, onClose])

	const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
		`Just earned ${rewardAmount} LRN completing ${lessonName} on @LearnVaultDAO! 🎓`,
	)}`

	return (
		<AnimatePresence>
			{isOpen && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
					onMouseDown={(event) => {
						if (event.target === event.currentTarget) {
							onClose()
						}
					}}
				>
					<motion.div
						ref={dialogRef}
						initial={{ scale: 0.8, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={{ scale: 0.8, opacity: 0 }}
						className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-md w-full relative"
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						aria-describedby={descriptionId}
						tabIndex={-1}
					>
						<h2 id={titleId} className="text-3xl font-bold text-slate-900 mb-2">
							{isFinalMilestone
								? "🏆 Track Complete!"
								: "🎉 Milestone Complete!"}
						</h2>
						<p id={descriptionId} className="text-slate-700 mb-6">
							You earned{" "}
							<span className="font-bold text-green-700">
								+{rewardAmount} LRN
							</span>
							for completing {lessonName}.
						</p>

						<div className="bg-slate-50 rounded-lg p-4 mb-6">
							<p className="text-xs uppercase tracking-widest text-slate-600 mb-1">
								Total Reputation
							</p>
							<p className="text-4xl font-mono font-bold text-slate-900">
								{count} LRN
							</p>
						</div>

						<div className="flex flex-col gap-3">
							<a
								href={twitterShareUrl}
								target="_blank"
								rel="noreferrer"
								className="bg-[#1DA1F2] text-white py-3 rounded-xl font-semibold hover:bg-[#1a8cd8] transition"
								aria-label={`Share ${lessonName} milestone completion on Twitter`}
							>
								Share on Twitter
							</a>
							<button
								ref={closeButtonRef}
								type="button"
								onClick={onClose}
								className="text-slate-700 hover:text-slate-900 transition py-2"
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
