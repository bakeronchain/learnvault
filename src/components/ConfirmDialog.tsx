import React, { useEffect } from "react"

interface ConfirmDialogProps {
	title: string
	description: string
	confirmLabel?: string
	cancelLabel?: string
	onConfirm: () => void
	onCancel: () => void
	isDestructive?: boolean
}

/**
 * A reusable, keyboard-accessible confirmation dialog.
 * Features:
 * - Glassmorphic design to match LearnVault aesthetics
 * - Esc key to close (Cancel)
 * - Highlights safe action (Cancel) as primary
 * - Red styling for destructive actions
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
	title,
	description,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	onConfirm,
	onCancel,
	isDestructive = true,
}) => {
	// Handle Escape key
	useEffect(() => {
		const handleEsc = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onCancel()
			}
		}
		window.addEventListener("keydown", handleEsc)
		return () => window.removeEventListener("keydown", handleEsc)
	}, [onCancel])

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
			role="dialog"
			aria-modal="true"
			aria-labelledby="confirm-dialog-title"
			aria-describedby="confirm-dialog-description"
		>
			<div className="glass-card max-w-md w-full p-8 rounded-[2.5rem] border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300">
				<div
					className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${
						isDestructive ? "bg-red-500/20 text-red-400" : "bg-brand-cyan/20 text-brand-cyan"
					}`}
				>
					<span className="text-2xl" aria-hidden="true">
						{isDestructive ? "⚠" : "ℹ"}
					</span>
				</div>

				<h2
					id="confirm-dialog-title"
					className="text-2xl font-black mb-2 tracking-tight text-white"
				>
					{title}
				</h2>

				<p
					id="confirm-dialog-description"
					className="text-white/60 text-sm leading-relaxed mb-8"
				>
					{description}
				</p>

				<div className="flex flex-row-reverse gap-3">
					<button
						type="button"
						onClick={onConfirm}
						className={`flex-1 px-6 py-3 font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all ${
							isDestructive
								? "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
								: "bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/20"
						}`}
					>
						{confirmLabel}
					</button>
					<button
						type="button"
						onClick={onCancel}
						autoFocus
						className="flex-1 px-6 py-3 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all"
					>
						{cancelLabel}
					</button>
				</div>
			</div>
		</div>
	)
}

export default ConfirmDialog
