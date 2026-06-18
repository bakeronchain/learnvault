import { useEffect, useRef } from "react"

interface MobileSigningModalProps {
	isOpen: boolean
	onClose: () => void
	onOpenWallet: () => void
	onCopyXdr: () => void
}

export function MobileSigningModal({
	isOpen,
	onClose,
	onOpenWallet,
	onCopyXdr,
}: MobileSigningModalProps) {
	const dialogRef = useRef<HTMLDialogElement>(null)

	useEffect(() => {
		const el = dialogRef.current
		if (!el) return

		if (isOpen) {
			el.showModal()
		} else {
			el.close()
		}
	}, [isOpen])

	if (!isOpen) return null

	return (
		<dialog
			ref={dialogRef}
			onClose={onClose}
			className="fixed inset-0 z-[200] w-full h-full bg-transparent backdrop:bg-black/80 backdrop:backdrop-blur-sm"
		>
			<div className="flex min-h-full items-center justify-center p-4">
				<div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-slate-900 p-6 shadow-2xl backdrop-blur-xl">
					<div className="mb-6 text-center">
						<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-cyan/10">
							<span className="text-3xl">📱</span>
						</div>
						<h2 className="text-xl font-black text-white">
							Sign with your wallet
						</h2>
						<p className="mt-2 text-sm text-white/60">
							Open your wallet app on this device to approve the transaction.
						</p>
					</div>

					<div className="space-y-3">
						<button
							type="button"
							onClick={onOpenWallet}
							className="w-full min-h-[52px] rounded-2xl bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan font-black uppercase tracking-widest text-sm hover:bg-brand-cyan/20 transition-all"
						>
							Open Wallet
						</button>

						<button
							type="button"
							onClick={onCopyXdr}
							className="w-full min-h-[52px] rounded-2xl border border-white/10 text-white/70 font-black uppercase tracking-widest text-xs hover:border-white/20 hover:text-white transition-all"
						>
							Copy transaction data
						</button>

						<button
							type="button"
							onClick={onClose}
							className="w-full py-3 text-xs font-black uppercase tracking-widest text-white/40 hover:text-white/60 transition-all"
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		</dialog>
	)
}
