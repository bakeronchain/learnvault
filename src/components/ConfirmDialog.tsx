import React, { useEffect, useState } from "react"

interface ConfirmDialogProps {
	title: string
	description: string
	confirmLabel?: string
	cancelLabel?: string
	onConfirm: () => void
	onCancel: () => void
	isDestructive?: boolean
	confirmationPhrase?: string
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
	confirmationPhrase,
}) => {
	const [confirmation, setConfirmation] = useState("")
	const isConfirmed = !confirmationPhrase || confirmation === confirmationPhrase
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
						isDestructive
							? "bg-red-500/20 text-red-400"
							: "bg-brand-cyan/20 text-brand-cyan"
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

				{confirmationPhrase && (
					<div className="mb-6">
						<label
							htmlFor="confirm-dialog-phrase"
							className="block text-sm text-white/80 mb-2"
						>
							Type {confirmationPhrase} to continue
						</label>
						<input
							id="confirm-dialog-phrase"
							type="text"
							value={confirmation}
							onChange={(event) => setConfirmation(event.target.value)}
							autoComplete="off"
							className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-white"
						/>
					</div>
				)}

				<div className="flex flex-row gap-3">
					<button
						type="button"
						onClick={onConfirm}
						disabled={!isConfirmed}
						className={`flex-1 px-6 py-3 font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all ${
							isDestructive
								? "text-red-400 border border-red-500/20 hover:bg-red-500/5"
								: "text-brand-cyan border border-brand-cyan/20 hover:bg-brand-cyan/5"
						} disabled:cursor-not-allowed disabled:opacity-40`}
					>
						{confirmLabel}
					</button>
					<button
						type="button"
						onClick={onCancel}
						autoFocus
						className="flex-1 px-6 py-3 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan font-black uppercase tracking-widest rounded-xl hover:bg-brand-cyan/20 hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,210,255,0.1)]"
					>
						{cancelLabel}
					</button>
				</div>
			</div>
		</div>
	)
}

export default ConfirmDialog
