import { useCallback, useState } from "react"
import { buildApiUrl, createAuthHeaders } from "../lib/api"
import { setAuthSession } from "../util/auth"
import storage from "../util/storage"
import {
	derToRawEcdsaSignature,
	fromBase64Url,
	isUncompressedP256Point,
	randomBytes,
	toBase64Url,
} from "../util/webauthn"
import { useWallet } from "./useWallet"

const RP_NAME = "LearnVault"

export interface PasskeyAssertionPayload {
	credentialId: string
	authenticatorData: string
	clientDataJSON: string
	/** Base64url-encoded raw 64-byte r‖s signature (DER-decoded already). */
	signature: string
}

export function isPasskeySupported(): boolean {
	return (
		typeof window !== "undefined" &&
		typeof window.PublicKeyCredential !== "undefined"
	)
}

async function extractSec1PublicKey(
	response: AuthenticatorResponse,
): Promise<Uint8Array> {
	const attestationResponse = response as AuthenticatorAttestationResponse
	if (typeof attestationResponse.getPublicKey !== "function") {
		throw new Error(
			"This browser did not return a public key from passkey creation",
		)
	}
	const spki = attestationResponse.getPublicKey()
	if (!spki) {
		throw new Error(
			"This browser did not return a public key from passkey creation",
		)
	}
	const key = await crypto.subtle.importKey(
		"spki",
		spki,
		{ name: "ECDSA", namedCurve: "P-256" },
		true,
		[],
	)
	const raw = await crypto.subtle.exportKey("raw", key)
	const bytes = new Uint8Array(raw)
	if (!isUncompressedP256Point(bytes)) {
		throw new Error("Unexpected public key format from passkey creation")
	}
	return bytes
}

function createPasskeyCredentialOptions(
	challenge: Uint8Array<ArrayBuffer>,
): CredentialCreationOptions {
	const userId = randomBytes(16)
	return {
		publicKey: {
			rp: { name: RP_NAME },
			user: {
				id: userId,
				name: "LearnVault learner",
				displayName: "LearnVault learner",
			},
			challenge,
			// ES256 (secp256r1/P-256) — the curve Soroban verifies natively.
			pubKeyCredParams: [{ type: "public-key", alg: -7 }],
			authenticatorSelection: {
				userVerification: "preferred",
				residentKey: "preferred",
			},
			timeout: 60_000,
			attestation: "none",
		},
	}
}

async function createPasskey(): Promise<{
	credentialId: string
	publicKey: string
}> {
	const challenge = randomBytes(32)
	const credential = (await navigator.credentials.create(
		createPasskeyCredentialOptions(challenge),
	)) as PublicKeyCredential | null

	if (!credential) throw new Error("Passkey creation was cancelled")

	const publicKeyBytes = await extractSec1PublicKey(credential.response)
	return {
		credentialId: toBase64Url(credential.rawId),
		publicKey: toBase64Url(publicKeyBytes),
	}
}

/**
 * Biometric passkey smart wallet (issue #1055): signup with no seed phrase,
 * backed by a per-learner secp256r1 Soroban custom-account contract
 * (contracts/passkey_wallet).
 */
export function usePasskeyWallet() {
	const { address } = useWallet()
	const [isRegistering, setIsRegistering] = useState(false)
	const [isAddingDevice, setIsAddingDevice] = useState(false)
	const [error, setError] = useState<string | null>(null)

	/**
	 * Sign an arbitrary 32-byte challenge with an existing passkey. Used both
	 * as the general on-chain authorization primitive (attach the result as a
	 * Soroban auth entry signature) and, internally, to confirm device
	 * enrollment.
	 */
	const authenticate = useCallback(
		async (
			challenge: Uint8Array<ArrayBuffer>,
			allowedCredentialId?: string,
		): Promise<PasskeyAssertionPayload> => {
			if (!isPasskeySupported()) {
				throw new Error("Passkeys aren't supported in this browser")
			}

			const credential = (await navigator.credentials.get({
				publicKey: {
					challenge,
					allowCredentials: allowedCredentialId
						? [{ id: fromBase64Url(allowedCredentialId), type: "public-key" }]
						: undefined,
					userVerification: "preferred",
					timeout: 60_000,
				},
			})) as PublicKeyCredential | null

			if (!credential) throw new Error("Passkey confirmation was cancelled")

			const response = credential.response as AuthenticatorAssertionResponse
			const rawSignature = derToRawEcdsaSignature(
				new Uint8Array(response.signature),
			)

			return {
				credentialId: toBase64Url(credential.rawId),
				authenticatorData: toBase64Url(response.authenticatorData),
				clientDataJSON: toBase64Url(response.clientDataJSON),
				signature: toBase64Url(rawSignature),
			}
		},
		[],
	)

	/** Create a passkey and deploy a sponsored wallet controlled by it. */
	const register = useCallback(
		async (deviceLabel?: string): Promise<string> => {
			if (!isPasskeySupported()) {
				const message = "Passkeys aren't supported in this browser"
				setError(message)
				throw new Error(message)
			}

			setIsRegistering(true)
			setError(null)
			try {
				const { credentialId, publicKey } = await createPasskey()

				const res = await fetch(buildApiUrl("/api/wallet/deploy"), {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ credentialId, publicKey, deviceLabel }),
				})
				const body = await res.json().catch(() => ({}))
				if (!res.ok) {
					throw new Error(body.error || "Failed to deploy passkey wallet")
				}

				setAuthSession(body.token, body.refreshToken)
				storage.setItem("walletType", "passkey")
				storage.setItem("walletId", "passkey")
				storage.setItem("walletAddress", body.walletAddress)

				return body.walletAddress as string
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Passkey registration failed"
				setError(message)
				throw err
			} finally {
				setIsRegistering(false)
			}
		},
		[],
	)

	/**
	 * Enroll a second device (recovery path): create a new passkey, then have
	 * an *existing* device sign the resulting sponsored `add_signer` call.
	 * Server-relayed in two steps because the exact challenge to sign depends
	 * on a nonce/expiration only known once the transaction is built — see
	 * server/src/services/passkey-signer.service.ts.
	 */
	const addDevice = useCallback(
		async (deviceLabel?: string): Promise<void> => {
			if (!address) {
				throw new Error("No passkey wallet connected")
			}
			if (!isPasskeySupported()) {
				const message = "Passkeys aren't supported in this browser"
				setError(message)
				throw new Error(message)
			}

			setIsAddingDevice(true)
			setError(null)
			try {
				const { credentialId, publicKey } = await createPasskey()

				const prepareRes = await fetch(
					buildApiUrl(
						`/api/wallet/${encodeURIComponent(address)}/signers/prepare`,
					),
					{
						method: "POST",
						headers: createAuthHeaders({ "Content-Type": "application/json" }),
						body: JSON.stringify({ credentialId, publicKey, deviceLabel }),
					},
				)
				const prepareBody = await prepareRes.json().catch(() => ({}))
				if (!prepareRes.ok) {
					throw new Error(
						prepareBody.error || "Failed to prepare device enrollment",
					)
				}

				const assertion = await authenticate(
					fromBase64Url(prepareBody.challenge),
				)

				const confirmRes = await fetch(
					buildApiUrl(
						`/api/wallet/${encodeURIComponent(address)}/signers/confirm`,
					),
					{
						method: "POST",
						headers: createAuthHeaders({ "Content-Type": "application/json" }),
						body: JSON.stringify({
							requestId: prepareBody.requestId,
							assertion,
						}),
					},
				)
				const confirmBody = await confirmRes.json().catch(() => ({}))
				if (!confirmRes.ok) {
					throw new Error(confirmBody.error || "Failed to add device")
				}
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Failed to add device"
				setError(message)
				throw err
			} finally {
				setIsAddingDevice(false)
			}
		},
		[address, authenticate],
	)

	return {
		address,
		isPasskeySupported: isPasskeySupported(),
		register,
		authenticate,
		addDevice,
		isRegistering,
		isAddingDevice,
		error,
	}
}
