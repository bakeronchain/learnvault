/**
 * Sponsored-reserves onboarding for zero-XLM learners (#1054).
 *
 * Stellar requires a minimum XLM reserve to open an account. A learner with
 * no crypto and no card can't pay it. This service builds a transaction that
 * wraps account creation in begin_sponsoring_future_reserves /
 * end_sponsoring_future_reserves so the SPONSOR's reserve covers it instead
 * of the learner's balance — the account is created with startingBalance
 * "0" and is still fully usable.
 *
 * Both the sponsor and the learner must sign: the sponsor because it's the
 * transaction source (and sources begin_sponsoring_future_reserves /
 * create_account), the learner because end_sponsoring_future_reserves must
 * be sourced by the sponsored account itself (Stellar requires the sponsored
 * party to explicitly close the sponsorship window). This service signs only
 * as the sponsor and returns the XDR for the learner to countersign in their
 * own wallet — it never sees or holds a learner secret key.
 */

import { logger } from "../lib/logger"
import { sponsorshipStore } from "../db/sponsorship-store"

const log = logger.child({ module: "sponsorship" })

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet"
const SPONSOR_SECRET = process.env.SPONSOR_SECRET ?? ""

// USDC on this codebase is a Soroban token (USDC_CONTRACT_ID, a Stellar
// Asset Contract address) — not a classic issuer/code pair. A classic
// change_trust operation needs an Asset(code, issuer), which is a different
// primitive. These are separate, optional env vars specifically for a
// classic USDC trustline; if unset (the default), the sponsor-account
// transaction skips change_trust entirely rather than guessing wrong.
const USDC_ASSET_CODE = process.env.USDC_ASSET_CODE ?? ""
const USDC_ASSET_ISSUER = process.env.USDC_ASSET_ISSUER ?? ""

// Stellar's reserve formula: minBalance = (2 + numSubentries) * baseReserve,
// baseReserve = 0.5 XLM. A fresh account with 0 subentries needs 1 XLM
// (2 * 0.5); each subentry (e.g. a trustline) adds 1 more baseReserve.
// These are protocol constants, not LearnVault config.
const BASE_RESERVE_STROOPS = 5_000_000n // 0.5 XLM
const ACCOUNT_RESERVE_STROOPS = 2n * BASE_RESERVE_STROOPS // 1 XLM

function networkPassphrase(): string {
	return STELLAR_NETWORK === "mainnet"
		? "Public Global Stellar Network ; September 2015"
		: "Test SDF Network ; September 2015"
}

function rpcUrlFor(): string {
	return STELLAR_NETWORK === "mainnet"
		? "https://soroban-rpc.stellar.org"
		: "https://soroban-testnet.stellar.org"
}

function usdcTrustlineConfigured(): boolean {
	return Boolean(USDC_ASSET_CODE && USDC_ASSET_ISSUER)
}

export interface BuildSponsorAccountOptions {
	/** Include a sponsored USDC trustline. Ignored (with a warning) if no classic USDC asset is configured. */
	withUsdcTrustline?: boolean
}

export interface BuildSponsorAccountResult {
	/** Sponsor-signed XDR — the learner must countersign this before it can be submitted. */
	xdr: string
	networkPassphrase: string
	reservesLockedStroops: string
	includesUsdcTrustline: boolean
}

export async function buildSponsorAccountTransaction(
	learnerAddress: string,
	options: BuildSponsorAccountOptions = {},
): Promise<BuildSponsorAccountResult> {
	if (!SPONSOR_SECRET) {
		throw new Error(
			"SPONSOR_SECRET not configured — cannot sponsor this transaction",
		)
	}

	const { StrKey } = await import("@stellar/stellar-sdk")
	if (!StrKey.isValidEd25519PublicKey(learnerAddress)) {
		throw new Error("learnerAddress must be a valid Stellar public key (G...)")
	}

	const includeTrustline = Boolean(options.withUsdcTrustline) && usdcTrustlineConfigured()
	if (options.withUsdcTrustline && !usdcTrustlineConfigured()) {
		log.warn(
			"withUsdcTrustline requested but USDC_ASSET_CODE/USDC_ASSET_ISSUER are not configured (this platform's USDC is a Soroban token, not a classic trustline) — skipping",
		)
	}

	const {
		Asset,
		Keypair,
		Operation,
		TransactionBuilder,
		BASE_FEE,
		rpc,
	} = await import("@stellar/stellar-sdk")

	const server = new rpc.Server(rpcUrlFor())
	const sponsor = Keypair.fromSecret(SPONSOR_SECRET)
	const sponsorAccount = await server.getAccount(sponsor.publicKey())

	const builder = new TransactionBuilder(sponsorAccount, {
		fee: BASE_FEE,
		networkPassphrase: networkPassphrase(),
	})
		.addOperation(
			Operation.beginSponsoringFutureReserves({ sponsoredId: learnerAddress }),
		)
		.addOperation(
			Operation.createAccount({
				destination: learnerAddress,
				startingBalance: "0",
			}),
		)

	if (includeTrustline) {
		builder.addOperation(
			Operation.changeTrust({
				asset: new Asset(USDC_ASSET_CODE, USDC_ASSET_ISSUER),
				source: learnerAddress,
			}),
		)
	}

	builder.addOperation(
		Operation.endSponsoringFutureReserves({ source: learnerAddress }),
	)

	const tx = builder.setTimeout(300).build()
	tx.sign(sponsor)

	const reservesLockedStroops = includeTrustline
		? ACCOUNT_RESERVE_STROOPS + BASE_RESERVE_STROOPS
		: ACCOUNT_RESERVE_STROOPS

	await sponsorshipStore.insertSponsoredAccount({
		learnerAddress,
		// No hash yet — the learner hasn't countersigned/submitted. Recorded
		// once at build time so the reserve lock and spend are visible to
		// admins even if the learner never completes the handshake; a status
		// of "pending" (default) reflects that.
		sponsorTxHash: tx.hash().toString("hex"),
		reservesLockedStroops,
	})
	await sponsorshipStore.recordSpend({
		amountStroops: reservesLockedStroops,
		kind: "create_account",
		learnerAddress,
		txHash: tx.hash().toString("hex"),
	})

	log.info(
		{ learnerAddress, includesUsdcTrustline: includeTrustline },
		"Built sponsor-account transaction",
	)

	return {
		xdr: tx.toXDR(),
		networkPassphrase: networkPassphrase(),
		reservesLockedStroops: reservesLockedStroops.toString(),
		includesUsdcTrustline: includeTrustline,
	}
}

export interface SponsorStatus {
	sponsorAddress: string | null
	sponsorBalanceStroops: string | null
	accountsSponsored: number
	reservesLockedStroops: string
	spendTodayStroops: string
	dailySpendCapStroops: string
	lowBalanceWarning: boolean
}

const SPONSOR_DAILY_SPEND_CAP_STROOPS = BigInt(
	process.env.SPONSOR_DAILY_SPEND_CAP_STROOPS ?? "500000000",
)
// Below this balance the sponsor can't reliably cover a handful more
// account creations — surfaced as a warning so a drained sponsor doesn't
// fail onboarding silently.
const LOW_BALANCE_WARNING_STROOPS = 10n * ACCOUNT_RESERVE_STROOPS // 10 XLM

function startOfTodayUtc(): Date {
	const now = new Date()
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export async function getSponsorStatus(): Promise<SponsorStatus> {
	const [accountsSponsored, reservesLockedStroops, spendTodayStroops] =
		await Promise.all([
			sponsorshipStore.countSponsoredAccounts(),
			sponsorshipStore.sumReservesLocked(),
			sponsorshipStore.sumSpendSince(startOfTodayUtc()),
		])

	let sponsorAddress: string | null = null
	let sponsorBalanceStroops: string | null = null
	let lowBalanceWarning = false

	if (SPONSOR_SECRET) {
		try {
			const { Keypair, rpc } = await import("@stellar/stellar-sdk")
			const sponsor = Keypair.fromSecret(SPONSOR_SECRET)
			sponsorAddress = sponsor.publicKey()

			const server = new rpc.Server(rpcUrlFor())
			// rpc.Server.getAccount() only returns the sequence number (it's meant
			// for building transactions); the native balance lives on the full
			// ledger entry, per the SDK's own getAccountEntry() doc example
			// ("account.balance().toString()").
			const entry = await server.getAccountEntry(sponsor.publicKey())
			const stroops = BigInt(entry.balance().toString())
			sponsorBalanceStroops = stroops.toString()
			lowBalanceWarning = stroops < LOW_BALANCE_WARNING_STROOPS
		} catch (err) {
			log.error({ err }, "Failed to fetch sponsor account balance")
		}
	}

	return {
		sponsorAddress,
		sponsorBalanceStroops,
		accountsSponsored,
		reservesLockedStroops: reservesLockedStroops.toString(),
		spendTodayStroops: spendTodayStroops.toString(),
		dailySpendCapStroops: SPONSOR_DAILY_SPEND_CAP_STROOPS.toString(),
		lowBalanceWarning,
	}
}
