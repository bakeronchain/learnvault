import React, { useCallback, useEffect, useRef, useState } from "react"
import { useWallet } from "../../hooks/useWallet"
import { explorerTransactionUrl } from "../../util/scholarshipApplications"
import { useToast } from "../Toast/ToastProvider"

const API_BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:4000"

interface AssetOption {
	code: string
	name: string
	native: boolean
	env_configured: boolean
}

interface DonatePath {
	destination_amount: string
	source_amount: string
	source_asset_code: string
	path: Array<{ asset_code: string; asset_issuer?: string }>
}

interface PathDiscoveryResult {
	source_asset: string
	dest_asset: string
	dest_amount: string
	paths: DonatePath[]
}

interface DonateBuildResult {
	xdr: string
	source_asset: string
	send_max: string
	dest_amount: string
	price_impact_pct: number
}

interface TrustlineStatus {
	hasTrustline: boolean
	balance?: string
}

const SLIPPAGE_OPTIONS = [0.1, 0.5, 1.0, 2.0]
const QUOTE_REFRESH_MS = 15_000

interface DonateWithAssetProps {
	onDonateSuccess?: (txHash: string) => void
}

export const DonateWithAsset: React.FC<DonateWithAssetProps> = ({
	onDonateSuccess,
}) => {
	const { address, signTransaction } = useWallet()
	const { showSuccess, showError, showInfo } = useToast()

	// Form state
	const [amount, setAmount] = useState("")
	const [selectedAsset, setSelectedAsset] = useState<string>("XLM")
	const [slippage, setSlippage] = useState(0.5)
	const [isBuilding, setIsBuilding] = useState(false)
	const [lastTxHash, setLastTxHash] = useState<string | null>(null)

	// Path discovery state
	const [paths, setPaths] = useState<DonatePath[]>([])
	const [isDiscovering, setIsDiscovering] = useState(false)
	const [pathError, setPathError] = useState<string | null>(null)
	const [quoteRefreshing, setQuoteRefreshing] = useState(false)

	// Trustline state
	const [donorTrustline, setDonorTrustline] = useState<TrustlineStatus | null>(
		null,
	)

	// Available assets
	const [assets, setAssets] = useState<AssetOption[]>([])

	const quoteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const amountRef = useRef(amount)
	amountRef.current = amount

	// Fetch available assets on mount
	useEffect(() => {
		void fetchAssets()
	}, [])

	const fetchAssets = async () => {
		try {
			const res = await fetch(`${API_BASE}/api/donate/assets`)
			if (res.ok) {
				const data = (await res.json()) as { assets: AssetOption[] }
				setAssets(data.assets)
			}
		} catch {
			// Fallback to default assets
			setAssets([
				{
					code: "XLM",
					name: "Stellar Lumens",
					native: true,
					env_configured: true,
				},
				{ code: "USDC", name: "USD Coin", native: false, env_configured: true },
				{
					code: "EURC",
					name: "Euro Coin",
					native: false,
					env_configured: true,
				},
			])
		}
	}

	// Discover paths when amount or asset changes
	const discoverPaths = useCallback(
		async (assetCode: string, destAmount: string) => {
			if (!destAmount || parseFloat(destAmount) <= 0) {
				setPaths([])
				setPathError(null)
				return
			}

			setIsDiscovering(true)
			setPathError(null)

			try {
				const res = await fetch(
					`${API_BASE}/api/donate/paths?from=${encodeURIComponent(assetCode)}&amount=${encodeURIComponent(destAmount)}`,
				)
				if (!res.ok) {
					setPathError("Failed to fetch payment paths")
					setPaths([])
					return
				}

				const data = (await res.json()) as PathDiscoveryResult
				setPaths(data.paths)

				if (data.paths.length === 0) {
					setPathError(
						`No payment path found from ${assetCode} to USDC. The treasury may lack a trustline or there is insufficient DEX liquidity.`,
					)
				}
			} catch {
				setPathError("Network error while fetching paths")
				setPaths([])
			} finally {
				setIsDiscovering(false)
			}
		},
		[],
	)

	// Check trustline when asset changes
	useEffect(() => {
		if (!address || selectedAsset === "XLM") {
			setDonorTrustline(null)
			return
		}

		const checkTrustline = async () => {
			try {
				const res = await fetch(
					`${API_BASE}/api/donate/trustline?address=${encodeURIComponent(address)}&asset=${encodeURIComponent(selectedAsset)}`,
				)
				if (res.ok) {
					const data = (await res.json()) as {
						donor: TrustlineStatus
						treasury: TrustlineStatus
					}
					setDonorTrustline(data.donor)
				}
			} catch {
				// Silently fail — trustline check is advisory
			}
		}

		void checkTrustline()
	}, [address, selectedAsset])

	// Debounced path discovery
	useEffect(() => {
		if (quoteTimerRef.current) {
			clearInterval(quoteTimerRef.current)
		}

		if (amount && parseFloat(amount) > 0) {
			void discoverPaths(selectedAsset, amount)

			// Refresh quote on timer
			quoteTimerRef.current = setInterval(() => {
				setQuoteRefreshing(true)
				void discoverPaths(selectedAsset, amountRef.current).then(() =>
					setQuoteRefreshing(false),
				)
			}, QUOTE_REFRESH_MS)
		} else {
			setPaths([])
		}

		return () => {
			if (quoteTimerRef.current) {
				clearInterval(quoteTimerRef.current)
			}
		}
	}, [selectedAsset, amount, discoverPaths])

	const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value
		if (value === "" || /^\d+(\.\d{0,7})?$/.test(value)) {
			setAmount(value)
		}
	}

	const handleQuickAmount = (value: number) => {
		setAmount(value.toString())
	}

	const handleDonate = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!address) {
			showError("Please connect your wallet")
			return
		}

		if (!amount || parseFloat(amount) <= 0) {
			showError("Please enter a valid amount")
			return
		}

		if (!signTransaction) {
			showError("Wallet does not support signing")
			return
		}

		if (selectedAsset === "USDC") {
			showError(
				"USDC donations are handled directly. Use the standard deposit form instead.",
			)
			return
		}

		if (paths.length === 0) {
			showError(
				`No payment path found from ${selectedAsset} to USDC. Try a different asset or amount.`,
			)
			return
		}

		// Get treasury address — in a real implementation this comes from env/config
		const treasuryAddress =
			import.meta.env.VITE_SCHOLARSHIP_TREASURY_ADDRESS ?? ""

		if (!treasuryAddress) {
			showError("Treasury address not configured")
			return
		}

		setIsBuilding(true)
		setLastTxHash(null)

		try {
			showInfo("Building transaction...")

			const bestPath = paths[0]
			const res = await fetch(`${API_BASE}/api/donate/build`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					donor: address,
					treasury: treasuryAddress,
					source_asset: selectedAsset,
					dest_amount: bestPath.destination_amount,
					slippage_pct: slippage,
					path: bestPath.path,
				}),
			})

			if (!res.ok) {
				const err = (await res.json()) as { error?: string }
				showError(err.error ?? "Failed to build transaction")
				return
			}

			const buildResult = (await res.json()) as DonateBuildResult

			showInfo("Waiting for wallet approval...")

			// Sign and submit the transaction
			const { Networks } = await import("@stellar/stellar-sdk")
			const networkPassphrase =
				(import.meta.env.VITE_STELLAR_NETWORK ?? "TESTNET") === "PUBLIC"
					? Networks.PUBLIC
					: Networks.TESTNET

			const signed = await signTransaction(buildResult.xdr, {
				networkPassphrase,
			})

			const signedXdr =
				typeof signed === "string"
					? signed
					: (signed as { signedTxXdr: string }).signedTxXdr

			const submitRes = await fetch(`${API_BASE}/api/donate/submit`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					xdr: signedXdr,
					donor: address,
					source_asset: selectedAsset,
					dest_amount: buildResult.dest_amount,
					slippage_pct: slippage,
				}),
			})

			if (!submitRes.ok) {
				const submitErr = (await submitRes.json()) as { error?: string }
				showError(submitErr.error ?? "Transaction submission failed")
				return
			}

			const submitResult = (await submitRes.json()) as { tx_hash: string }
			setLastTxHash(submitResult.tx_hash)
			showSuccess(
				`Donation of ~${buildResult.dest_amount} USDC submitted via ${selectedAsset}!`,
			)
			setAmount("")
			onDonateSuccess?.(submitResult.tx_hash)
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: "Donation failed. Please try again."
			showError(message)
		} finally {
			setIsBuilding(false)
		}
	}

	const bestPath = paths[0]
	const estimatedSourceAmount = bestPath?.source_amount ?? "—"
	const estimatedDestAmount = bestPath?.destination_amount ?? "—"
	const priceImpact = bestPath
		? (
				(parseFloat(bestPath.source_amount) /
					parseFloat(bestPath.destination_amount || "1") -
					1) *
				100
			).toFixed(2)
		: "—"

	return (
		<section className="mb-20">
			<div className="mb-12 flex items-center gap-4">
				<h2 className="text-2xl font-black tracking-tight">Donate Any Asset</h2>
				<div className="h-px flex-1 bg-linear-to-r from-white/10 to-transparent" />
			</div>

			<form onSubmit={handleDonate}>
				<div className="glass-card max-w-2xl rounded-[3rem] border border-white/5 p-12">
					{/* Asset selector */}
					<div className="mb-8">
						<p className="mb-4 text-xs font-black uppercase tracking-widest text-white/40">
							Donation Currency
						</p>
						<div className="grid grid-cols-3 gap-3">
							{assets.map((a) => (
								<button
									key={a.code}
									type="button"
									onClick={() => setSelectedAsset(a.code)}
									disabled={a.code === "USDC"}
									className={`rounded-xl px-4 py-3 text-sm font-black uppercase tracking-widest transition-all ${
										selectedAsset === a.code
											? "bg-brand-cyan text-black shadow-[0_0_20px_rgba(0,210,255,0.3)]"
											: "border border-white/10 bg-white/5 text-white/40 hover:border-white/30 hover:text-white"
									} ${a.code === "USDC" ? "opacity-50 cursor-not-allowed" : ""}`}
								>
									<span className="block">{a.code}</span>
									<span className="block text-[10px] font-medium normal-case tracking-normal opacity-70">
										{a.name}
									</span>
								</button>
							))}
						</div>
						<p className="mt-3 text-xs text-white/30">
							All donations are converted to USDC for the treasury via Stellar
							DEX path payments.
						</p>
					</div>

					{/* Amount input */}
					<div className="mb-8">
						<label className="mb-4 block text-sm font-black uppercase tracking-widest text-white/40">
							Amount to Send
						</label>
						<div className="relative">
							<span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-brand-cyan">
								{selectedAsset === "XLM" ? "✦" : "$"}
							</span>
							<input
								type="text"
								value={amount}
								onChange={handleAmountChange}
								placeholder="0.00"
								className="w-full rounded-2xl border border-white/10 bg-white/5 px-12 py-4 text-2xl font-black text-white placeholder:text-white/20 transition-all focus:border-brand-cyan/50 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
							/>
							<span className="absolute right-6 top-1/2 -translate-y-1/2 text-sm font-black uppercase tracking-widest text-white/40">
								{selectedAsset}
							</span>
						</div>
					</div>

					{/* Quick amounts */}
					<div className="mb-8">
						<p className="mb-4 text-xs font-black uppercase tracking-widest text-white/40">
							Quick Select
						</p>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							{[100, 500, 1000, 5000].map((value) => (
								<button
									key={value}
									type="button"
									onClick={() => handleQuickAmount(value)}
									className={`rounded-xl px-4 py-3 text-sm font-black uppercase tracking-widest transition-all ${
										amount === value.toString()
											? "bg-brand-cyan text-black shadow-[0_0_20px_rgba(0,210,255,0.3)]"
											: "border border-white/10 bg-white/5 text-white/40 hover:border-white/30 hover:text-white"
									}`}
								>
									{selectedAsset === "XLM" ? value : `$${value}`}
								</button>
							))}
						</div>
					</div>

					{/* Slippage control */}
					<div className="mb-8">
						<p className="mb-4 text-xs font-black uppercase tracking-widest text-white/40">
							Slippage Tolerance
						</p>
						<div className="flex gap-3">
							{SLIPPAGE_OPTIONS.map((s) => (
								<button
									key={s}
									type="button"
									onClick={() => setSlippage(s)}
									className={`rounded-xl px-4 py-2 text-sm font-black transition-all ${
										slippage === s
											? "bg-brand-purple text-white shadow-[0_0_15px_rgba(142,45,226,0.3)]"
											: "border border-white/10 bg-white/5 text-white/40 hover:border-white/30 hover:text-white"
									}`}
								>
									{s}%
								</button>
							))}
						</div>
					</div>

					<div className="mb-8 h-px bg-white/5" />

					{/* Live quote */}
					{amount && parseFloat(amount) > 0 && (
						<div className="mb-8 space-y-3">
							<div className="flex items-center justify-between text-sm">
								<span className="text-white/40">
									You send
									{isDiscovering && (
										<span className="ml-2 text-brand-cyan animate-pulse">
											refreshing...
										</span>
									)}
									{quoteRefreshing && !isDiscovering && (
										<span className="ml-2 text-brand-cyan text-xs">↻</span>
									)}
								</span>
								<span className="font-black text-brand-cyan">
									~{estimatedSourceAmount} {selectedAsset}
								</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-white/40">Treasury receives</span>
								<span className="font-black text-brand-emerald">
									{estimatedDestAmount} USDC
								</span>
							</div>
							{priceImpact !== "—" && (
								<div className="flex items-center justify-between text-xs">
									<span className="text-white/30">Price impact</span>
									<span
										className={
											parseFloat(priceImpact) > 2
												? "text-red-400"
												: "text-white/40"
										}
									>
										{priceImpact}%
									</span>
								</div>
							)}
							<div className="flex items-center justify-between text-xs">
								<span className="text-white/30">Slippage tolerance</span>
								<span className="text-white/40">{slippage}%</span>
							</div>
						</div>
					)}

					{/* Trustline warning */}
					{donorTrustline && !donorTrustline.hasTrustline && (
						<div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
							<p className="font-black text-amber-300">⚠ Trustline Required</p>
							<p className="mt-2 text-amber-200">
								You need to establish a trustline for {selectedAsset} before
								donating. Please add the asset in your wallet first.
							</p>
						</div>
					)}

					{/* No path error */}
					{pathError && (
						<div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-100">
							<p className="font-black text-red-300">⚠ No Path Available</p>
							<p className="mt-2 text-red-200">{pathError}</p>
						</div>
					)}

					{/* Donate button */}
					<button
						type="submit"
						disabled={
							!address ||
							!amount ||
							isBuilding ||
							paths.length === 0 ||
							selectedAsset === "USDC"
						}
						className={`w-full rounded-2xl px-6 py-4 font-black uppercase tracking-widest transition-all ${
							!address || !amount || isBuilding || paths.length === 0
								? "cursor-not-allowed bg-white/5 text-white/40"
								: "bg-brand-cyan text-black hover:scale-105 hover:shadow-[0_0_30px_rgba(0,210,255,0.4)] active:scale-95"
						}`}
					>
						{isBuilding
							? "Building Transaction..."
							: !address
								? "Connect Wallet to Donate"
								: `Donate ~${amount ? `$${parseFloat(amount || "0").toLocaleString()}` : ""} ${selectedAsset} → USDC`}
					</button>

					{/* Success card */}
					{lastTxHash && (
						<div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-100">
							<p className="text-[11px] font-black uppercase tracking-widest text-emerald-300">
								Donation Submitted
							</p>
							<p className="mt-2 break-all font-mono text-xs text-emerald-50">
								Transaction: {lastTxHash}
							</p>
							<a
								href={explorerTransactionUrl(lastTxHash)}
								target="_blank"
								rel="noreferrer"
								className="mt-3 inline-flex text-xs font-black uppercase tracking-widest text-emerald-300 hover:text-emerald-200"
							>
								View on Stellar Explorer
							</a>
						</div>
					)}

					<p className="mt-6 text-center text-[10px] text-white/30">
						All donations are converted to USDC via Stellar path payments
						<br />
						The treasury receives the exact USDC amount — no slippage
						<br />
						You&apos;ll receive governance tokens for your contribution
					</p>
				</div>
			</form>
		</section>
	)
}
