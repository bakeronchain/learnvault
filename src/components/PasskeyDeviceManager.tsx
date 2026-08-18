import React, { useState } from "react"
import { usePasskeyWallet } from "../hooks/usePasskeyWallet"
import storage from "../util/storage"

/**
 * Recovery path (issue #1055): lets a learner enroll a second device on
 * their passkey wallet, signed by whichever passkey they authenticate with
 * on *this* device. Only relevant for passkey-controlled wallets — wallets
 * connected via an external wallet app have no signer list to manage here.
 */
const PasskeyDeviceManager: React.FC = () => {
	const { addDevice, isAddingDevice, error } = usePasskeyWallet()
	const [justAdded, setJustAdded] = useState(false)

	if (storage.getItem("walletType") !== "passkey") {
		return null
	}

	const handleClick = async () => {
		setJustAdded(false)
		try {
			await addDevice()
			setJustAdded(true)
		} catch {
			// `error` from the hook already carries the message for display below.
		}
	}

	return (
		<div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
			<h3 className="text-sm font-bold text-white">Devices</h3>
			<p className="mt-1 text-xs text-white/50">
				Add another device's Face ID / fingerprint so you're never locked out if
				you lose this one.
			</p>
			<button
				type="button"
				onClick={() => void handleClick()}
				disabled={isAddingDevice}
				className="mt-3 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-2 text-xs font-bold text-brand-cyan transition-colors hover:bg-brand-cyan/20 disabled:cursor-not-allowed disabled:opacity-60"
			>
				{isAddingDevice
					? "Confirm on your other device…"
					: "Add another device"}
			</button>
			{justAdded && (
				<p className="mt-2 text-xs text-brand-emerald">Device added.</p>
			)}
			{error && (
				<p role="alert" className="mt-2 text-xs text-red-400">
					{error}
				</p>
			)}
		</div>
	)
}

export default PasskeyDeviceManager
