import crypto from "node:crypto"
import {
	Horizon,
	Keypair,
	Networks,
	StrKey,
	Transaction,
	WebAuth,
} from "@stellar/stellar-sdk"

import { type JwtService } from "./jwt.service"

const CHALLENGE_TIMEOUT_SECONDS = 300

function getNetworkPassphrase(): string {
	const network = (process.env.STELLAR_NETWORK ?? "testnet").toLowerCase()
	return network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
}

function getHorizonUrl(): string {
	const network = (process.env.STELLAR_NETWORK ?? "testnet").toLowerCase()
	if (network === "mainnet") return "https://horizon.stellar.org"
	return "https://horizon-testnet.stellar.org"
}

function getHomeDomain(): string {
	return (
		process.env.SEP10_HOME_DOMAIN ?? process.env.SERVER_URL ?? "learnvault.app"
	)
}

function getWebAuthDomain(): string {
	return process.env.SEP10_WEB_AUTH_DOMAIN ?? getHomeDomain()
}

function getSigningKeypair(): Keypair {
	const secret = process.env.SEP10_SIGNING_SECRET
	if (!secret) {
		throw new Error("SEP10_SIGNING_SECRET environment variable is required")
	}
	return Keypair.fromSecret(secret)
}

function isValidStellarPublicKey(address: string): boolean {
	try {
		return StrKey.isValidEd25519PublicKey(address)
	} catch {
		return false
	}
}

export type Sep10Service = {
	createChallenge(account: string): Promise<{
		transaction: string
		network_passphrase: string
	}>
	verifySignedChallenge(
		signedTransactionXdr: string,
	): Promise<{ accessToken: string; refreshToken: string }>
}

type NonceEntry = { nonce: string; expiresAt: number }

export function createSep10Service(jwtService: JwtService): Sep10Service {
	// Nonce store: key = `${account}:${nonce}`, value = expiry
	const nonceStore = new Map<string, NonceEntry>()

	function cleanExpiredNonces(): void {
		const now = Date.now()
		for (const [key, val] of nonceStore) {
			if (now >= val.expiresAt) {
				nonceStore.delete(key)
			}
		}
	}

	function storeNonce(account: string, nonce: string, ttlMs: number): void {
		const key = `${account}:${nonce}`
		nonceStore.set(key, { nonce, expiresAt: Date.now() + ttlMs })
	}

	function consumeNonce(account: string, nonce: string): boolean {
		const key = `${account}:${nonce}`
		const entry = nonceStore.get(key)
		if (!entry) return false
		if (Date.now() >= entry.expiresAt) {
			nonceStore.delete(key)
			return false
		}
		nonceStore.delete(key)
		return true
	}

	function extractNonceFromTx(tx: Transaction): string | null {
		for (const op of tx.operations) {
			if (
				op.type === "manageData" &&
				op.name.endsWith(" auth") &&
				op.name !== "web_auth_domain" &&
				op.value != null
			) {
				const val = op.value as Buffer | Uint8Array
				return Buffer.from(val).toString("base64")
			}
		}
		return null
	}

	return {
		async createChallenge(account: string): Promise<{
			transaction: string
			network_passphrase: string
		}> {
			if (!isValidStellarPublicKey(account)) {
				throw new Error("Invalid Stellar public key")
			}

			const serverKeypair = getSigningKeypair()
			const networkPassphrase = getNetworkPassphrase()
			const homeDomain = getHomeDomain()
			const webAuthDomain = getWebAuthDomain()

			const challengeTxXdr = WebAuth.buildChallengeTx(
				serverKeypair,
				account,
				homeDomain,
				CHALLENGE_TIMEOUT_SECONDS,
				networkPassphrase,
				webAuthDomain,
			)

			// Extract the nonce from the challenge tx for replay protection
			const tx = new Transaction(challengeTxXdr, networkPassphrase)
			const nonce = extractNonceFromTx(tx)
			if (nonce) {
				storeNonce(account, nonce, CHALLENGE_TIMEOUT_SECONDS * 1000)
			}

			cleanExpiredNonces()

			return {
				transaction: challengeTxXdr,
				network_passphrase: networkPassphrase,
			}
		},

		async verifySignedChallenge(
			signedTransactionXdr: string,
		): Promise<{ accessToken: string; refreshToken: string }> {
			const serverKeypair = getSigningKeypair()
			const serverAccountId = serverKeypair.publicKey()
			const networkPassphrase = getNetworkPassphrase()
			const homeDomain = getHomeDomain()
			const webAuthDomain = getWebAuthDomain()

			let result: {
				tx: Transaction
				clientAccountID: string
				matchedHomeDomain: string
				memo: string | null
			}
			try {
				result = WebAuth.readChallengeTx(
					signedTransactionXdr,
					serverAccountId,
					networkPassphrase,
					[homeDomain],
					webAuthDomain,
				)
			} catch (err) {
				const msg =
					err instanceof Error ? err.message : "Invalid challenge transaction"
				if (msg.includes("timeout")) {
					throw new Error("Challenge has expired")
				}
				throw new Error(`Invalid challenge transaction: ${msg}`)
			}

			const { tx, clientAccountID } = result

			// Verify sequence number is 0
			if (tx.sequence !== "0") {
				throw new Error("Challenge transaction sequence must be 0")
			}

			// Verify the server's signature is present and valid
			const serverSigned = tx.signatures.some((sig) => {
				try {
					serverKeypair.verify(tx.hash(), sig.signature())
					return true
				} catch {
					return false
				}
			})

			if (!serverSigned) {
				throw new Error("Missing or invalid server signature")
			}

			// Verify the client actually signed the transaction
			const clientKeypair = Keypair.fromPublicKey(clientAccountID)
			const clientSigned = tx.signatures.some((sig) => {
				try {
					return clientKeypair.verify(tx.hash(), sig.signature())
				} catch {
					return false
				}
			})

			if (!clientSigned) {
				throw new Error("Client account did not sign the challenge transaction")
			}

			// Check replay protection: extract nonce and consume it
			const nonce = extractNonceFromTx(tx)
			if (nonce) {
				if (!consumeNonce(clientAccountID, nonce)) {
					throw new Error("Challenge not found or already used")
				}
			}

			// Fetch account thresholds from Horizon and verify the client meets them
			try {
				const horizon = new Horizon.Server(getHorizonUrl())
				const accountData = await horizon
					.accounts()
					.accountId(clientAccountID)
					.call()

				const medThreshold = accountData.thresholds?.med_threshold ?? 1
				let totalWeight = 0

				for (const sig of tx.signatures) {
					const txHashBuf = tx.hash()
					for (const signer of accountData.signers ?? []) {
						try {
							const signerKeypair = Keypair.fromPublicKey(signer.key)
							if (signerKeypair.verify(txHashBuf, sig.signature())) {
								totalWeight += signer.weight
							}
						} catch {
							// Not a valid ed25519 key, skip
						}
					}
				}

				if (totalWeight < medThreshold) {
					throw new Error(
						"Client account signature does not meet medium threshold",
					)
				}
			} catch (err) {
				if (
					err instanceof Error &&
					err.message.includes("does not meet medium threshold")
				) {
					throw err
				}
				// Account not found on Horizon (not yet funded)
				// For unfunded accounts the master key signature is sufficient
				if (
					err instanceof Error &&
					(err.message.includes("Resource Missing") ||
						err.message.includes("Not Found"))
				) {
					// Unfunded account: accept the master key signature (weight = 1)
				} else if (
					err instanceof Error &&
					!err.message.includes("does not meet medium threshold")
				) {
					throw new Error("Failed to verify account thresholds")
				}
			}

			// Issue JWT
			return jwtService.issueTokenPair(clientAccountID)
		},
	}
}
