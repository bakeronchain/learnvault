import React from "react"
import {
	useLearnerProfile,
	type LinkedWalletInfo,
} from "../hooks/useLearnerProfile"
import {
	useLearnToken,
	useLrnTotalForLinkedWallets,
} from "../hooks/useLearnToken"
import { shortenAddress } from "../util/scholarshipApplications"

function LrnLine({ address }: { address: string }) {
	const { balance, isLoading } = useLearnToken(address)
	const label =
		balance === undefined || isLoading
			? "…"
			: balance.toLocaleString(undefined, { maximumFractionDigits: 0 })
	return <span className="text-white/50 text-sm tabular-nums">LRN {label}</span>
}

/**
 * Lists linked Stellar keys and per-wallet LRN; total is the sum across rows.
 */
export const ProfileLinkedWallets: React.FC = () => {
	const { profile, isLoading } = useLearnerProfile()
	const wallets: LinkedWalletInfo[] = profile?.wallets ?? []
	const addrs = wallets.map((w) => w.address)
	const { total, isLoading: lrnTotalLoading } = useLrnTotalForLinkedWallets(
		wallets.length > 0 ? addrs : [],
	)

	if (isLoading || wallets.length === 0) {
		return null
	}

	return (
		<section className="mb-12">
			<div className="flex items-center gap-4 mb-6">
				<h2 className="text-2xl font-black tracking-tight">Linked wallets</h2>
				<div className="h-px flex-1 bg-linear-to-r from-white/10 to-transparent" />
			</div>
			<div className="glass-card rounded-3xl p-6 border border-white/10">
				<div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
					<p className="text-sm text-white/50">
						Stellar keys tied to this profile. LRN is read on-chain per address.
					</p>
					<p className="text-sm font-mono text-brand-cyan/90">
						Total LRN:{" "}
						{lrnTotalLoading
							? "…"
							: total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
					</p>
				</div>
				<p className="text-xs text-white/40 mb-4">
					To add another Stellar key, sign a login nonce for that key, then call the
					link action from the same session as this wallet.
				</p>
				<ul className="space-y-3">
					{wallets.map((w) => (
						<li
							key={w.address}
							className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-white/5 last:border-0"
						>
							<div className="flex items-center gap-2 min-w-0">
								<code className="text-xs font-mono text-white/80 truncate">
									{shortenAddress(w.address)}
								</code>
								{w.isPrimary ? (
									<span className="text-[10px] uppercase font-black tracking-widest text-brand-cyan">
										Primary
									</span>
								) : null}
							</div>
							<LrnLine address={w.address} />
						</li>
					))}
				</ul>
			</div>
		</section>
	)
}
