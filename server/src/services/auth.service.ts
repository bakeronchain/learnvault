import crypto from "node:crypto"
import {
	Account,
	Keypair,
	Memo,
	Networks,
	StrKey,
	Transaction,
	TransactionBuilder,
} from "@stellar/stellar-sdk"

import { type NonceStore } from "../db/nonce-store"
import { type JwtService } from "./jwt.service"

const NONCE_MESSAGE_PREFIX = "LearnVault sign-in: "
const CHALLENGE_TTL_SECONDS = 300

function getNetworkPassphrase(): string {
	const network = (process.env.STELLAR_NETWORK ?? "testnet").toLowerCase()
	return network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
}

export function isValidStellarPublicKey(address: string): boolean {
	try {
		return StrKey.isValidEd25519PublicKey(address)
	} catch {
		return false
	}
}

function randomNoncePayload(): string {
	const bytes = crypto.randomBytes(24)
	return `${NONCE_MESSAGE_PREFIX}${bytes.toString("hex")}`
}

export type AuthService = {
	getOrCreateNonce(address: string): Promise<{ nonce: string }>
	verifyAndIssueToken(address: string, signatureBase64: string): Promise<string>
	/** Verifies a wallet signature and consumes the nonce (e.g. linking a second Stellar key). */
	verifyLinkSignature(address: string, signatureBase64: string): Promise<void>
	createChallenge(address: string): Promise<{
		transaction: string
		networkPassphrase: string
	}>
	verifySignedTransaction(signedTransactionXdr: string): Promise<string>
	logout(token: string): Promise<void>
}

export function createAuthService(
	nonceStore: NonceStore,
	jwtService: JwtService,
): AuthService {
	return {
		async logout(token: string): Promise<void> {
			await jwtService.revokeToken(token)
		},

		async createChallenge(address: string): Promise<{
			transaction: string
			networkPassphrase: string
		}> {
			if (!isValidStellarPublicKey(address)) {
				throw new Error("Invalid Stellar public key")
			}

			const nonce = crypto.randomBytes(12).toString("hex")
			await nonceStore.getOrSetNonce(address, nonce, CHALLENGE_TTL_SECONDS)

			const networkPassphrase = getNetworkPassphrase()
			const account = new Account(address, "0")
			const challengeTx = new TransactionBuilder(account, {
				fee: "100",
				networkPassphrase,
			})
				.addMemo(Memo.text(nonce))
				.setTimeout(CHALLENGE_TTL_SECONDS)
				.build()

			return {
				transaction: challengeTx.toXDR(),
				networkPassphrase,
			}
		},

		async verifySignedTransaction(
			signedTransactionXdr: string,
		): Promise<string> {
			const networkPassphrase = getNetworkPassphrase()
			let tx: Transaction

			try {
				tx = new Transaction(signedTransactionXdr, networkPassphrase)
			} catch {
				throw new Error("Invalid signed transaction")
			}

			const address = tx.source
			if (!isValidStellarPublicKey(address)) {
				throw new Error("Invalid Stellar public key")
			}

			if (tx.sequence !== "0") {
				throw new Error("Invalid challenge sequence")
			}

			if (tx.memo.type !== "text" || typeof tx.memo.value !== "string") {
				throw new Error("Invalid challenge memo")
			}

			const nonce = tx.memo.value.trim()
			if (!nonce) {
				throw new Error("Invalid challenge memo")
			}

			const stored = await nonceStore.getNonce(address)
			if (!stored || stored !== nonce) {
				throw new Error("Challenge expired or invalid")
			}

			const txHash = tx.hash()
			const keypair = Keypair.fromPublicKey(address)
			const hasValidSignature = tx.signatures.some((signature) =>
				keypair.verify(txHash, signature.signature()),
			)

			if (!hasValidSignature) {
				throw new Error("Invalid transaction signature")
			}

			await nonceStore.deleteNonce(address)
			return jwtService.signWalletToken(address)
		},

		async getOrCreateNonce(address: string): Promise<{ nonce: string }> {
			if (!isValidStellarPublicKey(address)) {
				throw new Error("Invalid Stellar public key")
			}

			const fresh = randomNoncePayload()
			const nonce = await nonceStore.getOrSetNonce(address, fresh, 300)
			return { nonce }
		},

		async verifyAndIssueToken(
			address: string,
			signatureBase64: string,
		): Promise<string> {
			if (!isValidStellarPublicKey(address)) {
				throw new Error("Invalid Stellar public key")
			}

			const stored = await nonceStore.getNonce(address)
			if (stored === null) {
				throw new Error("Nonce expired or missing; request a new nonce")
			}

			const keypair = Keypair.fromPublicKey(address)
			const messageBytes = Buffer.from(stored, "utf8")
			let signatureBytes: Buffer
			try {
				signatureBytes = Buffer.from(signatureBase64, "base64")
			} catch {
				throw new Error("Invalid signature encoding")
			}

			if (!keypair.verify(messageBytes, signatureBytes)) {
				throw new Error("Invalid signature")
			}

			await nonceStore.deleteNonce(address)
			return jwtService.signWalletToken(address)
		},

		async verifyLinkSignature(
			address: string,
			signatureBase64: string,
		): Promise<void> {
			if (!isValidStellarPublicKey(address)) {
				throw new Error("Invalid Stellar public key")
			}

			const stored = await nonceStore.getNonce(address)
			if (stored === null) {
				throw new Error("Nonce expired or missing; request a new nonce")
			}

			const keypair = Keypair.fromPublicKey(address)
			const messageBytes = Buffer.from(stored, "utf8")
			let signatureBytes: Buffer
			try {
				signatureBytes = Buffer.from(signatureBase64, "base64")
			} catch {
				throw new Error("Invalid signature encoding")
			}

			if (!keypair.verify(messageBytes, signatureBytes)) {
				throw new Error("Invalid signature")
			}

			await nonceStore.deleteNonce(address)
		},
	}
}
