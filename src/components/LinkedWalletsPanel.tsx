import { Button } from "@stellar/design-system"
import React, { useCallback, useContext, useState } from "react"
import { useTranslation } from "react-i18next"
import { networkPassphrase } from "../contracts/util"
import {
	type LearnerProfile,
	type LinkedWalletEntry,
	useLearnerProfile,
} from "../hooks/useLearnerProfile"
import { WalletContext } from "../providers/WalletProvider"
import { getAuthToken } from "../util/auth"
import AddressDisplay from "./AddressDisplay"

type Props = {
	profile: LearnerProfile | undefined
	refetchProfile: () => Promise<unknown>
}

/**
 * Link an additional Stellar wallet (user must connect it in the wallet extension,
 * fetch a nonce for that address, sign the message, then submit).
 */
export function LinkedWalletsPanel({ profile, refetchProfile }: Props) {
	const { t } = useTranslation()
	const { address: connected, networkPassphrase: walletPassphrase } =
		useContext(WalletContext)
	const [busy, setBusy] = useState(false)
	const [message, setMessage] = useState<string | null>(null)

	const linkCurrentWallet = useCallback(async () => {
		setMessage(null)
		const token = getAuthToken()
		if (!token || !connected) {
			setMessage(
				t("pages.profile.walletsNeedAuth", "Sign in to manage linked wallets."),
			)
			return
		}

		const decoded = (() => {
			try {
				const payload = token.split(".")[1]
				if (!payload) return null
				const json = JSON.parse(atob(payload)) as { sub?: string }
				return json.sub ?? null
			} catch {
				return null
			}
		})()

		if (!decoded) {
			setMessage(
				t("pages.profile.walletsBadToken", "Could not read session wallet."),
			)
			return
		}

		if (connected === decoded) {
			setMessage(
				t(
					"pages.profile.walletsSwitchHint",
					"Switch your extension to the wallet you want to link, then try again. Your session stays on the first wallet.",
				),
			)
			return
		}

		setBusy(true)
		try {
			const nonceRes = await fetch(
				`/api/auth/nonce?address=${encodeURIComponent(connected)}`,
			)
			if (!nonceRes.ok) {
				const err = await nonceRes.json().catch(() => ({}))
				throw new Error(err.error || "Failed to get nonce")
			}
			const { nonce } = (await nonceRes.json()) as { nonce: string }

			const { wallet } = await import("../util/wallet")
			const passphrase = walletPassphrase ?? networkPassphrase
			const signed = await wallet.signMessage(nonce, {
				address: connected,
				networkPassphrase: passphrase,
			})

			const linkRes = await fetch("/api/me/wallets/link", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					address: connected,
					signature: signed.signedMessage,
				}),
			})

			if (!linkRes.ok) {
				const err = await linkRes.json().catch(() => ({}))
				throw new Error(err.error || "Link failed")
			}

			setMessage(t("pages.profile.walletsLinked", "Wallet linked."))
			await refetchProfile()
		} catch (e) {
			setMessage(e instanceof Error ? e.message : "Error")
		} finally {
			setBusy(false)
		}
	}, [connected, refetchProfile, t, walletPassphrase])

	const setPrimary = useCallback(
		async (addr: string) => {
			setMessage(null)
			const token = getAuthToken()
			if (!token) return
			setBusy(true)
			try {
				const res = await fetch("/api/me/wallets/primary", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ address: addr }),
				})
				if (!res.ok) {
					const err = await res.json().catch(() => ({}))
					throw new Error(err.error || "Update failed")
				}
				setMessage(
					t("pages.profile.walletsPrimaryUpdated", "Primary wallet updated."),
				)
				await refetchProfile()
			} catch (e) {
				setMessage(e instanceof Error ? e.message : "Error")
			} finally {
				setBusy(false)
			}
		},
		[refetchProfile, t],
	)

	const list: LinkedWalletEntry[] = profile?.linkedWallets ?? []

	return (
		<section className="mt-16 glass-card rounded-[2.5rem] border border-white/10 p-10">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
				<h2 className="text-2xl font-black tracking-tight">
					{t("pages.profile.walletsTitle", "Linked wallets")}
				</h2>
				<Button
					size="sm"
					variant="secondary"
					onClick={() => void linkCurrentWallet()}
					disabled={busy || !getAuthToken()}
				>
					{t("pages.profile.walletsLinkCta", "Link current wallet")}
				</Button>
			</div>
			<p className="text-sm text-white/50 mb-6">
				{t(
					"pages.profile.walletsHelp",
					"Connect the wallet you want to add in your extension, then use “Link current wallet”. Your sign-in session remains on your original account.",
				)}
			</p>
			{message ? (
				<p className="text-sm text-brand-cyan mb-4" role="status">
					{message}
				</p>
			) : null}
			<ul className="space-y-4">
				{list.map((w) => (
					<li
						key={w.address}
						className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between"
					>
						<div className="min-w-0">
							<AddressDisplay
								address={w.address}
								addressClassName="text-white/80 text-sm"
								buttonClassName="h-6 w-6"
							/>
							{w.isPrimary ? (
								<span className="mt-1 inline-block text-[10px] font-black uppercase tracking-widest text-brand-emerald">
									{t("pages.profile.walletsPrimary", "Primary")}
								</span>
							) : null}
						</div>
						{!w.isPrimary ? (
							<Button
								size="xs"
								variant="tertiary"
								disabled={busy}
								onClick={() => void setPrimary(w.address)}
							>
								{t("pages.profile.walletsSetPrimary", "Set as primary")}
							</Button>
						) : null}
					</li>
				))}
			</ul>
		</section>
	)
}

/** Fetches profile when authenticated; renders panel only with data. */
export function LinkedWalletsSection() {
	const { profile, refetch, error } = useLearnerProfile()
	if (error && error !== "Not authenticated") {
		return null
	}
	if (!profile) {
		return null
	}
	return <LinkedWalletsPanel profile={profile} refetchProfile={refetch} />
}
