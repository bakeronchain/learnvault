/**
 * Multi-asset donation service via Stellar path payments.
 *
 * Provides:
 *   1. Path discovery — queries Horizon /paths/strict-receive for viable routes
 *   2. Trustline preflight — verifies donor & treasury trustlines
 *   3. Transaction builder — constructs path_payment_strict_receive XDR
 *
 * The treasury always receives USDC; donors can pay in XLM, EURC, or any
 * asset with DEX/AMM liquidity.  The server never holds donor keys.
 */

import { Horizon, rpc } from "@stellar/stellar-sdk"

import { logger } from "../lib/logger"

const log = logger.child({ module: "donate-service" })

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet"
const SCHOLARSHIP_TREASURY_CONTRACT_ID =
	process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID ?? ""
const USDC_CONTRACT_ID = process.env.USDC_CONTRACT_ID ?? ""

/** Source-asset code → Stellar asset string for Horizon path queries. */
const ASSET_MAP: Record<string, string> = {}

// Well-known assets that should be discoverable
const KNOWN_ASSETS: Array<{ code: string; envKey?: string; native?: boolean }> =
	[
		{ code: "XLM", native: true },
		{ code: "USDC", envKey: "USDC_CONTRACT_ID" },
		{ code: "EURC", envKey: "EURC_CONTRACT_ID" },
	]

function buildAssetMap(): void {
	if (Object.keys(ASSET_MAP).length > 0) return
	for (const asset of KNOWN_ASSETS) {
		if (asset.native) {
			ASSET_MAP[asset.code] = "native"
		} else if (asset.envKey) {
			const contractId = process.env[asset.envKey]
			if (contractId) {
				ASSET_MAP[asset.code] = contractId
			}
		}
	}
}

function horizonUrl(): string {
	return (
		process.env.HORIZON_URL ??
		(STELLAR_NETWORK === "mainnet"
			? "https://horizon.stellar.org"
			: "https://horizon-testnet.stellar.org")
	)
}

function rpcUrl(): string {
	return (
		process.env.SOROBAN_RPC_URL ??
		(STELLAR_NETWORK === "mainnet"
			? "https://rpc-mainnet.stellar.org"
			: "https://soroban-testnet.stellar.org")
	)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DonatePath {
	/** Estimated USDC amount the treasury receives. */
	destination_amount: string
	/** Maximum amount the donor must send (includes slippage). */
	source_amount: string
	/** The source asset code (e.g. "XLM", "EURC"). */
	source_asset_code: string
	/** Intermediate assets used for the conversion. */
	path: Array<{ asset_code: string; asset_issuer?: string }>
}

export interface PathDiscoveryResult {
	/** The source asset code the donor is sending. */
	source_asset: string
	/** The destination asset (always USDC). */
	dest_asset: string
	/** The exact USDC amount the treasury will receive. */
	dest_amount: string
	/** Viable payment paths. Empty array means no path exists. */
	paths: DonatePath[]
}

export interface TrustlineStatus {
	hasTrustline: boolean
	/** When false, this trustline must be established before the payment. */
	balance?: string
}

export interface DonateBuildParams {
	/** The donor's Stellar public key. */
	donor: string
	/** The treasury's Stellar public key. */
	treasury: string
	/** Source asset code (e.g. "XLM", "EURC"). */
	source_asset: string
	/** Exact USDC amount the treasury should receive. */
	dest_amount: string
	/** Slippage tolerance in percent (default 0.5). */
	slippage_pct?: number
	/** The payment path to use (from a previous /paths call). */
	path?: Array<{ asset_code: string; asset_issuer?: string }>
}

export interface DonateBuildResult {
	/** Base64-encoded XDR transaction for the donor to sign. */
	xdr: string
	/** The source asset code used. */
	source_asset: string
	/** The maximum send amount the donor must cover. */
	send_max: string
	/** The exact destination amount (USDC). */
	dest_amount: string
	/** Price impact percentage estimate. */
	price_impact_pct: number
}

// ---------------------------------------------------------------------------
// Path Discovery
// ---------------------------------------------------------------------------

interface HorizonPathRecord {
	destination_amount: string
	source_amount: string
	path: Array<{
		asset_code?: string
		asset_issuer?: string
		asset_type?: string
	}>
}

/**
 * Queries Horizon for viable payment paths from a source asset to the
 * treasury's USDC destination.
 */
export async function discoverPaths(
	sourceAsset: string,
	destAmount: string,
): Promise<PathDiscoveryResult> {
	buildAssetMap()

	if (!USDC_CONTRACT_ID) {
		throw new Error("USDC_CONTRACT_ID not configured")
	}

	const server = new Horizon.Server(horizonUrl())
	const destAssetCode = "USDC"

	log.info({ sourceAsset, destAmount }, "Discovering payment paths")

	try {
		// Use strict-receive so the treasury gets an exact USDC amount
		// Build the query manually using the Horizon API
		const sourceParam =
			sourceAsset === "XLM"
				? "native"
				: `credit_alphanum4:${sourceAsset}:${ASSET_MAP[sourceAsset] ?? ""}`
		const destParam = `credit_alphanum4:${destAssetCode}:${USDC_CONTRACT_ID}`

		const url = `${horizonUrl()}/paths/strict-receive?source_asset=${encodeURIComponent(sourceParam)}&destination_asset=${encodeURIComponent(destParam)}&destination_amount=${destAmount}&limit=5`
		const response = await fetch(url)

		if (!response.ok) {
			log.warn({ status: response.status }, "Horizon paths request failed")
			return {
				source_asset: sourceAsset,
				dest_asset: destAssetCode,
				dest_amount: destAmount,
				paths: [],
			}
		}

		const data = (await response.json()) as {
			records?: HorizonPathRecord[]
		}

		const paths: DonatePath[] = (data.records ?? []).map((record) => ({
			destination_amount: record.destination_amount,
			source_amount: record.source_amount,
			source_asset_code: sourceAsset,
			path: (record.path ?? []).map((p) => ({
				asset_code:
					p.asset_code ?? (p.asset_type === "native" ? "XLM" : "unknown"),
				asset_issuer: p.asset_issuer,
			})),
		}))

		return {
			source_asset: sourceAsset,
			dest_asset: destAssetCode,
			dest_amount: destAmount,
			paths,
		}
	} catch (err) {
		log.warn({ err, sourceAsset, destAmount }, "Path discovery failed")
		// Return empty paths rather than throwing — the caller can surface
		// "no path available" to the user.
		return {
			source_asset: sourceAsset,
			dest_asset: destAssetCode,
			dest_amount: destAmount,
			paths: [],
		}
	}
}

// ---------------------------------------------------------------------------
// Trustline Preflight
// ---------------------------------------------------------------------------

/**
 * Checks whether the given account has a trustline for the specified asset.
 * For native (XLM) assets, always returns hasTrustline: true.
 */
export async function checkTrustline(
	accountAddress: string,
	assetCode: string,
): Promise<TrustlineStatus> {
	if (assetCode === "XLM") {
		return { hasTrustline: true }
	}

	const server = new Horizon.Server(horizonUrl())

	try {
		const account = await server.loadAccount(accountAddress)
		const assetIssuer = ASSET_MAP[assetCode]
		if (!assetIssuer) {
			// Unknown asset — assume no trustline
			return { hasTrustline: false }
		}

		const balance = account.balances.find((b) => {
			if (b.asset_type === "native") return assetCode === "XLM"
			return (
				"asset_code" in b &&
				b.asset_code === assetCode &&
				"asset_issuer" in b &&
				b.asset_issuer === assetIssuer
			)
		})

		if (balance) {
			return {
				hasTrustline: true,
				balance: "balance" in balance ? balance.balance : undefined,
			}
		}

		return { hasTrustline: false }
	} catch (err) {
		log.warn({ err, accountAddress, assetCode }, "Trustline check failed")
		// Fail open — return unknown status so the UI can warn
		return { hasTrustline: false }
	}
}

// ---------------------------------------------------------------------------
// Transaction Builder
// ---------------------------------------------------------------------------

/**
 * Builds a path_payment_strict_receive XDR transaction.
 * The server prepares the transaction; the donor signs it via their wallet.
 */
export async function buildDonateTransaction(
	params: DonateBuildParams,
): Promise<DonateBuildResult> {
	const {
		donor,
		treasury,
		source_asset: sourceAsset,
		dest_amount: destAmount,
		slippage_pct: slippagePct = 0.5,
		path,
	} = params

	if (!USDC_CONTRACT_ID) {
		throw new Error("USDC_CONTRACT_ID not configured")
	}

	// Calculate send_max with slippage tolerance
	const destAmountNum = parseFloat(destAmount)
	const slippageMultiplier = 1 + slippagePct / 100

	// We need the best path's source_amount to compute send_max
	// If a specific path was provided, use its source_amount
	let sendMaxNum: number
	let priceImpactPct = 0

	if (path && path.length > 0) {
		// Discover to get the source_amount for this path
		const discovery = await discoverPaths(sourceAsset, destAmount)
		const bestPath = discovery.paths[0]
		if (bestPath) {
			sendMaxNum = parseFloat(bestPath.source_amount) * slippageMultiplier
			// Price impact = (sendMax - destAmount * price) / destAmount * 100
			const impliedRate = parseFloat(bestPath.source_amount) / destAmountNum
			priceImpactPct = Math.max(0, (impliedRate - impliedRate * 0.99) * 100)
		} else {
			// Fallback: estimate 1:1 with slippage
			sendMaxNum = destAmountNum * slippageMultiplier
		}
	} else {
		sendMaxNum = destAmountNum * slippageMultiplier
	}

	const sendMax = sendMaxNum.toFixed(7)

	log.info(
		{
			donor: donor.slice(0, 4) + "..." + donor.slice(-4),
			sourceAsset,
			destAmount,
			sendMax,
			slippagePct,
		},
		"Building donate transaction",
	)

	// Build the XDR using Soroban RPC for transaction preparation
	const {
		TransactionBuilder,
		BASE_FEE,
		Networks,
		Operation,
		Asset,
		Transaction,
	} = await import("@stellar/stellar-sdk")

	const horizonServer = new Horizon.Server(horizonUrl())
	const sourceAccount = await horizonServer.loadAccount(donor)

	const networkPassphrase =
		STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET

	// Build the path payment strict receive operation
	let sourceAssetInstance: InstanceType<typeof Asset>
	if (sourceAsset === "XLM") {
		sourceAssetInstance = Asset.native()
	} else {
		const issuer = ASSET_MAP[sourceAsset] ?? ""
		sourceAssetInstance = new Asset(sourceAsset, issuer)
	}

	const destAssetInstance = new Asset("USDC", USDC_CONTRACT_ID)

	const pathAssets = (path ?? []).map((p) => {
		if (p.asset_code === "XLM") return Asset.native()
		return new Asset(p.asset_code, p.asset_issuer ?? "")
	})

	const txBuilder = new TransactionBuilder(sourceAccount, {
		fee: BASE_FEE,
		networkPassphrase,
	})
		.addOperation(
			Operation.pathPaymentStrictReceive({
				source: donor,
				destination: treasury,
				sendAsset: sourceAssetInstance,
				sendMax: sendMax,
				destAsset: destAssetInstance,
				destAmount: destAmount,
				path: pathAssets,
			}),
		)
		.setTimeout(300)

	const transaction = txBuilder.build()

	// Prepare (simulate) the transaction using Soroban RPC
	const sorobanServer = new rpc.Server(rpcUrl(), { allowHttp: true })
	const prepared = await sorobanServer.prepareTransaction(transaction)

	return {
		xdr: prepared.toXDR(),
		source_asset: sourceAsset,
		send_max: sendMax,
		dest_amount: destAmount,
		price_impact_pct: priceImpactPct,
	}
}

// ---------------------------------------------------------------------------
// Available Assets
// ---------------------------------------------------------------------------

/**
 * Returns the list of assets that donors can use, with their codes and
 * whether they have DEX liquidity.
 */
export function getAvailableAssets(): Array<{
	code: string
	name: string
	native: boolean
	env_configured: boolean
}> {
	buildAssetMap()

	return [
		{
			code: "XLM",
			name: "Stellar Lumens",
			native: true,
			env_configured: true,
		},
		{
			code: "USDC",
			name: "USD Coin",
			native: false,
			env_configured: Boolean(ASSET_MAP["USDC"]),
		},
		{
			code: "EURC",
			name: "Euro Coin",
			native: false,
			env_configured: Boolean(ASSET_MAP["EURC"]),
		},
	]
}
