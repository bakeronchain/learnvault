/**
 * Sponsored relay for adding a second passkey signer to an already-deployed
 * PasskeyWallet (contracts/passkey_wallet) — the "add another device"
 * recovery path from issue #1055.
 *
 * add_signer is guarded on-chain by `env.current_contract_address().require_auth()`,
 * so it must be authorized by a *currently registered* passkey, not the
 * platform's sponsor key. That requires the two-step handshake below,
 * because the exact bytes a passkey must sign (the Soroban auth entry's
 * challenge hash) depend on a nonce and expiration ledger that only exist
 * once the invocation has been built and simulated:
 *
 *   1. prepareAddSigner — builds and simulates the `add_signer` invocation,
 *      derives the challenge the existing device must sign (mirroring
 *      exactly what stellar-sdk's own `authorizeEntry` computes), and holds
 *      the unsigned transaction server-side under a short-lived requestId.
 *   2. confirmAddSigner — takes the resulting WebAuthn assertion, embeds it
 *      as the auth entry's signature (in the PasskeyAssertion shape the
 *      contract's __check_auth expects — not the default Vec<{public_key,
 *      signature}> shape stellar-sdk's authorizeEntry() produces, which is
 *      for classic accounts), signs the envelope with the sponsor key, and
 *      submits.
 */

import crypto from "crypto"
import { pool } from "../db/index"
import { logger } from "../lib/logger"

const log = logger.child({ module: "passkey-signer" })

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet"
const STELLAR_SECRET_KEY = process.env.STELLAR_SECRET_KEY ?? ""
const AUTH_VALID_LEDGER_WINDOW = 100
const PENDING_REQUEST_TTL_MS = 5 * 60 * 1000

export interface PrepareAddSignerResult {
	requestId: string
	/** Base64url-encoded 32-byte challenge for the existing device to sign. */
	challenge: string
}

export interface PasskeyAssertionInput {
	credentialId: string
	authenticatorData: string
	clientDataJSON: string
	/** Base64url-encoded raw 64-byte r‖s signature (already DER-decoded). */
	signature: string
}

export interface ConfirmAddSignerResult {
	txHash: string
}

interface PendingAddSigner {
	transactionXdr: string
	walletAddress: string
	newCredentialId: string
	newPublicKey: string
	deviceLabel?: string
	expiresAt: number
}

const pendingRequests = new Map<string, PendingAddSigner>()

function sweepExpired(): void {
	const now = Date.now()
	for (const [id, entry] of pendingRequests) {
		if (entry.expiresAt < now) pendingRequests.delete(id)
	}
}

function decodeBase64Url(value: string, field: string): Buffer {
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(`${field} is required`)
	}
	const buf = Buffer.from(value, "base64url")
	if (buf.length === 0) throw new Error(`${field} is not valid base64url`)
	return buf
}

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

export async function prepareAddSigner(
	walletAddress: string,
	newCredentialId: string,
	newPublicKey: string,
	deviceLabel?: string,
): Promise<PrepareAddSignerResult> {
	sweepExpired()

	const newCredentialIdBytes = decodeBase64Url(newCredentialId, "credentialId")
	const newPublicKeyBytes = decodeBase64Url(newPublicKey, "publicKey")
	if (newPublicKeyBytes.length !== 65 || newPublicKeyBytes[0] !== 0x04) {
		throw new Error(
			"publicKey must be a 65-byte uncompressed SEC1 P-256 point (0x04 prefix)",
		)
	}
	if (!STELLAR_SECRET_KEY) {
		throw new Error(
			"STELLAR_SECRET_KEY not configured — cannot sponsor this transaction",
		)
	}

	const {
		Keypair,
		Address,
		Operation,
		TransactionBuilder,
		BASE_FEE,
		rpc,
		xdr,
		hash,
	} = await import("@stellar/stellar-sdk")

	const server = new rpc.Server(rpcUrlFor())
	const sponsor = Keypair.fromSecret(STELLAR_SECRET_KEY)
	const account = await server.getAccount(sponsor.publicKey())

	const op = Operation.invokeContractFunction({
		contract: walletAddress,
		function: "add_signer",
		args: [
			xdr.ScVal.scvBytes(newCredentialIdBytes),
			xdr.ScVal.scvBytes(newPublicKeyBytes),
		],
	})

	const tx = new TransactionBuilder(account, {
		fee: BASE_FEE,
		networkPassphrase: networkPassphrase(),
	})
		.addOperation(op)
		.setTimeout(60)
		.build()

	const prepared = await server.prepareTransaction(tx)
	const invokeOp = prepared.operations[0] as unknown as {
		auth?: InstanceType<typeof xdr.SorobanAuthorizationEntry>[]
	}
	const entries = invokeOp.auth ?? []

	const entry = entries.find((candidate) => {
		try {
			const credentials = candidate.credentials()
			if (
				credentials.switch().value !==
				xdr.SorobanCredentialsType.sorobanCredentialsAddress().value
			) {
				return false
			}
			return (
				Address.fromScAddress(credentials.address().address()).toString() ===
				walletAddress
			)
		} catch {
			return false
		}
	})

	if (!entry) {
		throw new Error(
			"add_signer did not require the wallet's own authorization — cannot build a challenge",
		)
	}

	const addrAuth = entry.credentials().address()
	const latestLedger = await server.getLatestLedger()
	const validUntilLedgerSeq = latestLedger.sequence + AUTH_VALID_LEDGER_WINDOW
	addrAuth.signatureExpirationLedger(validUntilLedgerSeq)

	const networkId = hash(Buffer.from(networkPassphrase()))
	const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
		new xdr.HashIdPreimageSorobanAuthorization({
			networkId,
			nonce: addrAuth.nonce(),
			invocation: entry.rootInvocation(),
			signatureExpirationLedger: validUntilLedgerSeq,
		}),
	)
	const challenge = hash(preimage.toXDR())

	const requestId = crypto.randomUUID()
	pendingRequests.set(requestId, {
		transactionXdr: prepared.toXDR(),
		walletAddress,
		newCredentialId,
		newPublicKey,
		deviceLabel,
		expiresAt: Date.now() + PENDING_REQUEST_TTL_MS,
	})

	return { requestId, challenge: challenge.toString("base64url") }
}

export async function confirmAddSigner(
	requestId: string,
	assertion: PasskeyAssertionInput,
): Promise<ConfirmAddSignerResult> {
	sweepExpired()

	const pending = pendingRequests.get(requestId)
	if (!pending) {
		throw new Error("Request not found or expired — please try again")
	}
	pendingRequests.delete(requestId)

	if (!STELLAR_SECRET_KEY) {
		throw new Error(
			"STELLAR_SECRET_KEY not configured — cannot sponsor this transaction",
		)
	}

	const authenticatorData = decodeBase64Url(
		assertion.authenticatorData,
		"assertion.authenticatorData",
	)
	const clientDataJSON = decodeBase64Url(
		assertion.clientDataJSON,
		"assertion.clientDataJSON",
	)
	const signature = decodeBase64Url(assertion.signature, "assertion.signature")
	if (signature.length !== 64) {
		throw new Error("assertion.signature must be a raw 64-byte r‖s signature")
	}
	const credentialId = decodeBase64Url(
		assertion.credentialId,
		"assertion.credentialId",
	)

	const { Keypair, Address, TransactionBuilder, xdr, nativeToScVal, rpc } =
		await import("@stellar/stellar-sdk")

	try {
		const tx = TransactionBuilder.fromXDR(
			pending.transactionXdr,
			networkPassphrase(),
		)
		const invokeOp = tx.operations[0] as unknown as {
			auth?: InstanceType<typeof xdr.SorobanAuthorizationEntry>[]
		}
		const entries = invokeOp.auth ?? []
		const entry = entries.find((candidate) => {
			try {
				const credentials = candidate.credentials()
				if (
					credentials.switch().value !==
					xdr.SorobanCredentialsType.sorobanCredentialsAddress().value
				) {
					return false
				}
				return (
					Address.fromScAddress(credentials.address().address()).toString() ===
					pending.walletAddress
				)
			} catch {
				return false
			}
		})
		if (!entry) {
			throw new Error(
				"Prepared transaction is missing the wallet's own auth entry",
			)
		}

		const sigScVal = nativeToScVal(
			{
				authenticator_data: authenticatorData,
				client_data_json: clientDataJSON,
				credential_id: credentialId,
				signature,
			},
			{
				type: {
					authenticator_data: ["symbol", "bytes"],
					client_data_json: ["symbol", "bytes"],
					credential_id: ["symbol", "bytes"],
					signature: ["symbol", "bytes"],
				},
			},
		)
		entry.credentials().address().signature(sigScVal)

		const sponsor = Keypair.fromSecret(STELLAR_SECRET_KEY)
		tx.sign(sponsor)

		const server = new rpc.Server(rpcUrlFor())
		const submitted = await server.sendTransaction(tx)
		if (submitted.status === "ERROR") {
			throw new Error(
				"add_signer submission rejected: " +
					JSON.stringify(submitted.errorResult ?? submitted.status),
			)
		}

		const final = await server.pollTransaction(submitted.hash)
		if (final.status !== "SUCCESS") {
			throw new Error(`add_signer did not finalize: ${final.status}`)
		}

		await pool.query(
			`INSERT INTO passkey_credentials (contract_address, credential_id, public_key, device_label)
			 VALUES ($1, $2, $3, $4)`,
			[
				pending.walletAddress,
				pending.newCredentialId,
				pending.newPublicKey,
				pending.deviceLabel ?? null,
			],
		)

		return { txHash: submitted.hash }
	} catch (err) {
		log.error({ err, requestId }, "Failed to confirm add_signer")
		throw new Error(
			"Failed to add signer: " +
				(err instanceof Error ? err.message : String(err)),
		)
	}
}

// Exported for tests only.
export function _clearPendingAddSignerRequests(): void {
	pendingRequests.clear()
}
