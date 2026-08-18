import React from "react"
import { usePasskeyWallet } from "../hooks/usePasskeyWallet"

interface PasskeySignupProps {
	onSuccess?: (walletAddress: string) => void
}

/**
 * Primary onboarding path (issue #1055): "Continue with Face ID" creates a
 * biometric-controlled Soroban smart wallet with no seed phrase shown, no
 * browser extension required. Existing wallet-connect stays available as a
 * secondary option, rendered by the caller alongside this component.
 */
const PasskeySignup: React.FC<PasskeySignupProps> = ({ onSuccess }) => {
	const { register, isRegistering, isPasskeySupported, error } =
		usePasskeyWallet()

	const handleClick = async () => {
		try {
			const walletAddress = await register()
			onSuccess?.(walletAddress)
		} catch {
			// `error` from the hook already carries the message for display below.
		}
	}

	if (!isPasskeySupported) {
		return null
	}

	return (
		<div className="flex flex-col items-center gap-2">
			<button
				type="button"
				onClick={() => void handleClick()}
				disabled={isRegistering}
				className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[2px] text-black transition-all hover:bg-brand-cyan hover:shadow-[0_0_20px_rgba(0,212,255,0.4)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
			>
				<span aria-hidden="true">🆔</span>
				{isRegistering ? "Creating your wallet…" : "Continue with Face ID"}
			</button>
			<p className="text-xs text-white/50">No seed phrase. No extension.</p>
			{error && (
				<p role="alert" className="text-xs text-red-400">
					{error}
				</p>
			)}
		</div>
	)
}

export default PasskeySignup
