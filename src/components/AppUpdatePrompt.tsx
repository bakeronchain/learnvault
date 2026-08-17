import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function AppUpdatePrompt() {
	const [deferredPrompt, setDeferredPrompt] =
		useState<BeforeInstallPromptEvent | null>(null)
	const [showInstall, setShowInstall] = useState(false)
	const [showUpdate, setShowUpdate] = useState(false)

	useEffect(() => {
		const handleBeforeInstall = (e: Event) => {
			e.preventDefault()
			setDeferredPrompt(e as BeforeInstallPromptEvent)
			setShowInstall(true)
		}

		window.addEventListener("beforeinstallprompt", handleBeforeInstall)

		// Listen for SW update
		if ("serviceWorker" in navigator) {
			void navigator.serviceWorker.getRegistration().then((reg) => {
				if (!reg) return
				reg.addEventListener("updatefound", () => {
					setShowUpdate(true)
				})
			})
		}

		return () => {
			window.removeEventListener("beforeinstallprompt", handleBeforeInstall)
		}
	}, [])

	const handleInstall = async () => {
		if (!deferredPrompt) return
		await deferredPrompt.prompt()
		const { outcome } = await deferredPrompt.userChoice
		if (outcome === "accepted") setShowInstall(false)
		setDeferredPrompt(null)
	}

	const handleUpdate = () => {
		if ("serviceWorker" in navigator) {
			void navigator.serviceWorker.getRegistration().then((reg) => {
				reg?.waiting?.postMessage({ type: "SKIP_WAITING" })
			})
		}
		setShowUpdate(false)
		window.location.reload()
	}

	if (showUpdate) {
		return (
			<div className="fixed bottom-4 right-4 z-50 glass-card p-4 rounded-2xl border border-brand-cyan/20 shadow-lg max-w-xs animate-in slide-in-from-bottom-4 fade-in duration-300">
				<p className="text-xs font-bold text-white mb-2">Update available</p>
				<div className="flex gap-2">
					<button
						onClick={handleUpdate}
						className="text-[9px] font-black uppercase tracking-widest bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan px-3 py-1.5 rounded-xl hover:bg-brand-cyan/30 transition-colors"
					>
						Update
					</button>
					<button
						onClick={() => setShowUpdate(false)}
						className="text-[9px] font-black uppercase tracking-widest text-white/40 px-3 py-1.5 rounded-xl hover:text-white/60 transition-colors"
					>
						Later
					</button>
				</div>
			</div>
		)
	}

	if (showInstall) {
		return (
			<div className="fixed bottom-4 right-4 z-50 glass-card p-4 rounded-2xl border border-brand-cyan/20 shadow-lg max-w-xs animate-in slide-in-from-bottom-4 fade-in duration-300">
				<p className="text-xs font-bold text-white mb-2">
					Install LearnVault
				</p>
				<p className="text-[10px] text-white/40 mb-3">
					Add to your home screen for faster access
				</p>
				<div className="flex gap-2">
					<button
						onClick={() => void handleInstall()}
						className="text-[9px] font-black uppercase tracking-widest bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan px-3 py-1.5 rounded-xl hover:bg-brand-cyan/30 transition-colors"
					>
						Install
					</button>
					<button
						onClick={() => setShowInstall(false)}
						className="text-[9px] font-black uppercase tracking-widest text-white/40 px-3 py-1.5 rounded-xl hover:text-white/60 transition-colors"
					>
						No thanks
					</button>
				</div>
			</div>
		)
	}

	return null
}
