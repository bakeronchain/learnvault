import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { WalletContext } from "../providers/WalletProvider"
import storage from "../util/storage"
import { fromBase64Url } from "../util/webauthn"
import { usePasskeyWallet } from "./usePasskeyWallet"

function wrapper(address?: string) {
	return function Wrapper({ children }: { children: React.ReactNode }) {
		return (
			<WalletContext.Provider
				value={{
					address,
					balances: {},
					isPending: false,
					isReconnecting: false,
					signTransaction: vi.fn(),
					updateBalances: vi.fn(),
				}}
			>
				{children}
			</WalletContext.Provider>
		)
	}
}

/** Real ECDSA P-256 keypair + SPKI export, so the SEC1-extraction path in
 * `register()` is exercised against genuine WebCrypto output rather than a
 * hand-rolled fixture. */
async function generateSpkiPublicKey(): Promise<{
	spki: ArrayBuffer
	privateKey: CryptoKey
}> {
	const keyPair = await crypto.subtle.generateKey(
		{ name: "ECDSA", namedCurve: "P-256" },
		true,
		["sign", "verify"],
	)
	const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey)
	return { spki, privateKey: keyPair.privateKey }
}

async function derSign(
	privateKey: CryptoKey,
	message: Uint8Array<ArrayBuffer>,
): Promise<ArrayBuffer> {
	// WebCrypto's ECDSA sign() produces raw r‖s (IEEE P1363), but real
	// AuthenticatorAssertionResponse.signature is DER — wrap it to match.
	const raw = new Uint8Array(
		await crypto.subtle.sign(
			{ name: "ECDSA", hash: "SHA-256" },
			privateKey,
			message,
		),
	)
	const r = raw.slice(0, 32)
	const s = raw.slice(32, 64)
	const toMinimalInt = (component: Uint8Array): Uint8Array => {
		let i = 0
		while (
			i < component.length - 1 &&
			component[i] === 0 &&
			component[i + 1] < 0x80
		)
			i++
		const trimmed = component.slice(i)
		return trimmed[0] & 0x80 ? new Uint8Array([0, ...trimmed]) : trimmed
	}
	const rInt = toMinimalInt(r)
	const sInt = toMinimalInt(s)
	const der = new Uint8Array([
		0x30,
		2 + rInt.length + 2 + sInt.length,
		0x02,
		rInt.length,
		...rInt,
		0x02,
		sInt.length,
		...sInt,
	])
	return der.buffer
}

let credentialsCreate: ReturnType<typeof vi.fn>
let credentialsGet: ReturnType<typeof vi.fn>

beforeEach(() => {
	global.fetch = vi.fn()
	;(window as unknown as { PublicKeyCredential: unknown }).PublicKeyCredential =
		class {}
	credentialsCreate = vi.fn()
	credentialsGet = vi.fn()
	Object.defineProperty(global.navigator, "credentials", {
		value: { create: credentialsCreate, get: credentialsGet },
		configurable: true,
	})
	localStorage.clear()
})

describe("usePasskeyWallet.register", () => {
	it("creates a passkey, deploys a sponsored wallet, and starts a session", async () => {
		const { spki } = await generateSpkiPublicKey()

		credentialsCreate.mockResolvedValue({
			rawId: new Uint8Array([1, 2, 3, 4]).buffer,
			response: { getPublicKey: () => spki },
		})
		;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: async () => ({
				walletAddress: "CNEWWALLET",
				token: "access-token",
				refreshToken: "refresh-token",
			}),
		})

		const { result } = renderHook(() => usePasskeyWallet(), {
			wrapper: wrapper(undefined),
		})

		let walletAddress = ""
		await act(async () => {
			walletAddress = await result.current.register("My Phone")
		})

		expect(walletAddress).toBe("CNEWWALLET")
		expect(credentialsCreate).toHaveBeenCalledTimes(1)

		const [deployUrl, requestInit] = (global.fetch as ReturnType<typeof vi.fn>)
			.mock.calls[0]
		expect(deployUrl).toBe("/api/wallet/deploy")
		const body = JSON.parse((requestInit as RequestInit).body as string) as {
			deviceLabel?: string
			credentialId: string
			publicKey: string
		}
		expect(body.deviceLabel).toBe("My Phone")
		expect(typeof body.credentialId).toBe("string")
		const publicKeyBytes = fromBase64Url(body.publicKey)
		expect(publicKeyBytes).toHaveLength(65)
		expect(publicKeyBytes[0]).toBe(0x04)

		expect(storage.getItem("walletType")).toBe("passkey")
		expect(storage.getItem("walletAddress")).toBe("CNEWWALLET")
	})

	it("surfaces a deploy error without starting a session", async () => {
		const { spki } = await generateSpkiPublicKey()
		credentialsCreate.mockResolvedValue({
			rawId: new Uint8Array([1, 2, 3, 4]).buffer,
			response: { getPublicKey: () => spki },
		})
		;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: false,
			json: async () => ({ error: "STELLAR_SECRET_KEY not configured" }),
		})

		const { result } = renderHook(() => usePasskeyWallet(), {
			wrapper: wrapper(undefined),
		})

		await act(async () => {
			await expect(result.current.register()).rejects.toThrow(
				/STELLAR_SECRET_KEY not configured/,
			)
		})

		expect(storage.getItem("walletAddress")).toBeNull()
	})

	it("rejects when the browser doesn't support passkeys", async () => {
		;(
			window as unknown as { PublicKeyCredential?: unknown }
		).PublicKeyCredential = undefined

		const { result } = renderHook(() => usePasskeyWallet(), {
			wrapper: wrapper(undefined),
		})

		await act(async () => {
			await expect(result.current.register()).rejects.toThrow(
				/aren't supported/,
			)
		})
		expect(credentialsCreate).not.toHaveBeenCalled()
	})
})

describe("usePasskeyWallet.authenticate", () => {
	it("converts the DER-encoded browser signature into a raw 64-byte assertion signature", async () => {
		const { privateKey } = await generateSpkiPublicKey()
		const challenge = new Uint8Array(32).fill(7)
		// authenticatorData || sha256(clientDataJSON) is what's actually signed
		// in a real ceremony; the exact bytes don't matter for this test, only
		// that whatever signature the "authenticator" returns gets converted.
		const message = new Uint8Array([1, 2, 3])
		const derSignature = await derSign(privateKey, message)

		credentialsGet.mockResolvedValue({
			rawId: new Uint8Array([9, 9]).buffer,
			response: {
				authenticatorData: new Uint8Array(37).buffer,
				clientDataJSON: new TextEncoder().encode('{"type":"webauthn.get"}')
					.buffer,
				signature: derSignature,
			},
		})

		const { result } = renderHook(() => usePasskeyWallet(), {
			wrapper: wrapper("CEXISTING"),
		})

		let assertion: Awaited<
			ReturnType<typeof result.current.authenticate>
		> | null = null
		await act(async () => {
			assertion = await result.current.authenticate(challenge)
		})

		expect(assertion).not.toBeNull()
		const rawSignature = fromBase64Url(assertion!.signature)
		expect(rawSignature).toHaveLength(64)
	})
})

describe("usePasskeyWallet.addDevice", () => {
	it("orchestrates create → prepare → sign → confirm", async () => {
		const { spki, privateKey } = await generateSpkiPublicKey()

		// New device's passkey creation.
		credentialsCreate.mockResolvedValue({
			rawId: new Uint8Array([5, 5, 5]).buffer,
			response: { getPublicKey: () => spki },
		})

		const challengeBytes = new Uint8Array(32).fill(3)
		const fetchMock = global.fetch as ReturnType<typeof vi.fn>
		fetchMock.mockImplementation((url: string) => {
			if (url.endsWith("/signers/prepare")) {
				return Promise.resolve({
					ok: true,
					json: async () => ({
						requestId: "req-42",
						challenge: Buffer.from(challengeBytes).toString("base64url"),
					}),
				})
			}
			if (url.endsWith("/signers/confirm")) {
				return Promise.resolve({
					ok: true,
					json: async () => ({ txHash: "tx-hash-123" }),
				})
			}
			return Promise.reject(new Error(`Unexpected fetch to ${url}`))
		})

		// Existing device signs the prepared challenge.
		const derSignature = await derSign(privateKey, new Uint8Array([9]))
		credentialsGet.mockResolvedValue({
			rawId: new Uint8Array([1]).buffer,
			response: {
				authenticatorData: new Uint8Array(37).buffer,
				clientDataJSON: new TextEncoder().encode('{"type":"webauthn.get"}')
					.buffer,
				signature: derSignature,
			},
		})

		const { result } = renderHook(() => usePasskeyWallet(), {
			wrapper: wrapper("CEXISTINGWALLET"),
		})

		await act(async () => {
			await result.current.addDevice("Second phone")
		})

		expect(credentialsCreate).toHaveBeenCalledTimes(1)
		expect(credentialsGet).toHaveBeenCalledTimes(1)
		expect(fetchMock).toHaveBeenCalledTimes(2)

		const prepareCall = fetchMock.mock.calls.find(([url]) =>
			(url as string).endsWith("/signers/prepare"),
		)
		expect(prepareCall?.[0]).toBe("/api/wallet/CEXISTINGWALLET/signers/prepare")
		const confirmCall = fetchMock.mock.calls.find(([url]) =>
			(url as string).endsWith("/signers/confirm"),
		)
		const confirmBody = JSON.parse(
			(confirmCall?.[1] as RequestInit).body as string,
		) as { requestId: string; assertion: { signature: string } }
		expect(confirmBody.requestId).toBe("req-42")
		expect(fromBase64Url(confirmBody.assertion.signature)).toHaveLength(64)
	})

	it("throws without attempting anything if no wallet is connected", async () => {
		const { result } = renderHook(() => usePasskeyWallet(), {
			wrapper: wrapper(undefined),
		})

		await expect(result.current.addDevice()).rejects.toThrow(
			/No passkey wallet connected/,
		)
		expect(credentialsCreate).not.toHaveBeenCalled()
	})
})

describe("usePasskeyWallet - state flags", () => {
	it("reports isRegistering while a registration is in flight", async () => {
		const { spki } = await generateSpkiPublicKey()
		credentialsCreate.mockResolvedValue({
			rawId: new Uint8Array([1]).buffer,
			response: { getPublicKey: () => spki },
		})

		let resolveFetch: (value: unknown) => void = () => {}
		;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
			new Promise((resolve) => {
				resolveFetch = resolve
			}),
		)

		const { result } = renderHook(() => usePasskeyWallet(), {
			wrapper: wrapper(undefined),
		})

		expect(result.current.isRegistering).toBe(false)

		let registerPromise: Promise<string>
		act(() => {
			registerPromise = result.current.register()
		})

		await waitFor(() => expect(result.current.isRegistering).toBe(true))

		await act(async () => {
			resolveFetch({
				ok: true,
				json: async () => ({
					walletAddress: "CNEWWALLET",
					token: "t",
					refreshToken: "r",
				}),
			})
			await registerPromise
		})

		expect(result.current.isRegistering).toBe(false)
	})
})
