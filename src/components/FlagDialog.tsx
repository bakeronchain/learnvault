import React, { useEffect, useState } from "react"

interface FlagDialogProps {
	title: string
	description: string
	confirmLabel?: string
	cancelLabel?: string
	onConfirm: (reason: string) => void
	onCancel: () => void
}

/**
 * A beautiful, highly-premium glassmorphic dialog for flagging content.
 * Features:
 * - Quick-fill suggestion pills for standard flag reasons
 * - Live character counter and real-time backend validation feedback (min 10 characters)
 * - Keyboard accessible (Esc key to close)
 * - Harmonious HSL tailwind colors matching LearnVault design language
 */
const FlagDialog: React.FC<FlagDialogProps> = ({
	title,
	description,
	confirmLabel = "Flag Content",
	cancelLabel = "Cancel",
	onConfirm,
	onCancel,
}) => {
	const [reason, setReason] = useState("")
	const [touched, setTouched] = useState(false)

	// Close on Escape key
	useEffect(() => {
		const handleEsc = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onCancel()
			}
		}
		window.addEventListener("keydown", handleEsc)
		return () => window.removeEventListener("keydown", handleEsc)
	}, [onCancel])

	const prefillReasons = [
		"Spam or self-promotion",
		"Harassment or offensive language",
		"Misinformation or harmful advice",
		"Hate speech or personal attack",
	]

	const trimmedReason = reason.trim()
	const isValid = trimmedReason.length >= 10
	const charsLeft = Math.max(0, 10 - trimmedReason.length)

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (isValid) {
			onConfirm(trimmedReason)
		}
	}

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
			role="dialog"
			aria-modal="true"
			aria-labelledby="flag-dialog-title"
			aria-describedby="flag-dialog-description"
		>
			<div className="glass-card max-w-md w-full p-8 rounded-[2.5rem] border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300">
				<div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 bg-red-500/20 text-red-400">
					<span className="text-2xl" aria-hidden="true">
						🚩
					</span>
				</div>

				<h2
					id="flag-dialog-title"
					className="text-2xl font-black mb-2 tracking-tight text-white"
				>
					{title}
				</h2>

				<p
					id="flag-dialog-description"
					className="text-white/60 text-sm leading-relaxed mb-6"
				>
					{description}
				</p>

				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
						<label className="block text-xs font-black uppercase tracking-wider text-white/50 mb-3">
							Quick Select Reason
						</label>
						<div className="flex flex-wrap gap-2 mb-4">
							{prefillReasons.map((pref) => (
								<button
									key={pref}
									type="button"
									onClick={() => {
										setReason(pref)
										setTouched(true)
									}}
									className="px-3 py-1.5 text-[10px] font-bold text-white/70 bg-white/5 border border-white/5 rounded-full hover:bg-white/10 hover:text-white transition-all active:scale-95"
								>
									{pref}
								</button>
							))}
						</div>
					</div>

					<div>
						<label
							htmlFor="flag-reason"
							className="block text-xs font-black uppercase tracking-wider text-white/50 mb-3"
						>
							Provide Details
						</label>
						<textarea
							id="flag-reason"
							required
							rows={4}
							value={reason}
							onChange={(e) => {
								setReason(e.target.value)
								setTouched(true)
							}}
							placeholder="Explain clearly why this content is being flagged..."
							className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs text-white placeholder-white/30 focus:outline-none focus:border-red-500/40 transition-colors resize-none"
						/>
						<div className="flex justify-between items-center mt-2">
							{touched && !isValid ? (
								<p className="text-[10px] font-bold text-red-400/90 uppercase tracking-wider animate-pulse">
									Needs {charsLeft} more character{charsLeft > 1 ? "s" : ""}
								</p>
							) : (
								<p className="text-[10px] font-bold text-emerald-400/90 uppercase tracking-wider">
									Reason is valid
								</p>
							)}
							<span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
								{trimmedReason.length} chars
							</span>
						</div>
					</div>

					<div className="flex flex-row gap-3 pt-2">
						<button
							type="submit"
							disabled={!isValid}
							className={`flex-1 px-6 py-3 font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all ${
								isValid
									? "bg-red-500/20 text-red-400 border border-red-500/20 hover:bg-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
									: "bg-white/5 text-white/20 border border-white/5 cursor-not-allowed"
							}`}
						>
							{confirmLabel}
						</button>
						<button
							type="button"
							onClick={onCancel}
							className="flex-1 px-6 py-3 bg-white/5 border border-white/10 text-white/70 font-black uppercase tracking-widest rounded-xl hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 transition-all"
						>
							{cancelLabel}
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}

export default FlagDialog
