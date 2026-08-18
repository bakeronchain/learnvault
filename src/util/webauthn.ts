/**
 * Byte-encoding helpers for the passkey smart wallet (issue #1055). Kept
 * dependency-free and DOM-API-free so they're trivially unit testable; all
 * `navigator.credentials` / WebAuthn ceremony orchestration lives in
 * `hooks/usePasskeyWallet.ts`.
 */

/**
 * `crypto.getRandomValues`/WebAuthn's DOM types want a `Uint8Array<ArrayBuffer>`
 * specifically (not the wider `ArrayBufferLike`, which also covers
 * `SharedArrayBuffer`) — plain `new Uint8Array(n)` infers the wider type in
 * TS 5.7+, so this pins it down in one place instead of casting at each call
 * site.
 */
export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
	const bytes = new Uint8Array(new ArrayBuffer(length))
	crypto.getRandomValues(bytes)
	return bytes
}

export function toBase64Url(data: ArrayBuffer | Uint8Array): string {
	const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
	let binary = ""
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
	const padded = normalized.padEnd(
		normalized.length + ((4 - (normalized.length % 4)) % 4),
		"=",
	)
	const binary = atob(padded)
	const bytes = new Uint8Array(new ArrayBuffer(binary.length))
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
	return bytes
}

/**
 * WebAuthn's `AuthenticatorAssertionResponse.signature` is DER-encoded
 * (ASN.1 `SEQUENCE { r INTEGER, s INTEGER }`), but Soroban's
 * `secp256r1_verify` — and the passkey_wallet contract's `BytesN<64>`
 * signature field — expect the fixed-width raw `r ‖ s` (32 bytes each, no
 * padding/sign bytes, no ASN.1 framing). Every assertion must be converted
 * through here before being sent on-chain, or verification silently expects
 * bytes that were never produced.
 */
export function derToRawEcdsaSignature(der: Uint8Array): Uint8Array {
	let offset = 0
	const readByte = (): number => {
		if (offset >= der.length) throw new Error("Malformed DER signature")
		return der[offset++]
	}
	const readLength = (): number => {
		const first = readByte()
		if ((first & 0x80) === 0) return first
		const numBytes = first & 0x7f
		let length = 0
		for (let i = 0; i < numBytes; i++) length = (length << 8) | readByte()
		return length
	}
	const readInteger = (): Uint8Array => {
		const tag = readByte()
		if (tag !== 0x02)
			throw new Error("Malformed DER signature: expected INTEGER")
		const len = readLength()
		const bytes = der.slice(offset, offset + len)
		offset += len
		return bytes
	}

	const sequenceTag = readByte()
	if (sequenceTag !== 0x30) {
		throw new Error("Malformed DER signature: expected SEQUENCE")
	}
	readLength()
	const r = readInteger()
	const s = readInteger()

	const toFixed32 = (component: Uint8Array): Uint8Array => {
		// DER INTEGERs are minimal, big-endian, two's-complement, so a
		// leading 0x00 pad byte appears whenever the high bit of the true
		// value would otherwise be mistaken for a sign bit — strip it back
		// off, then re-pad to exactly 32 bytes.
		let trimmed = component
		if (trimmed.length > 0 && trimmed[0] === 0x00) trimmed = trimmed.slice(1)
		if (trimmed.length > 32) {
			throw new Error("Malformed DER signature: component too large for P-256")
		}
		const out = new Uint8Array(32)
		out.set(trimmed, 32 - trimmed.length)
		return out
	}

	const raw = new Uint8Array(64)
	raw.set(toFixed32(r), 0)
	raw.set(toFixed32(s), 32)
	return raw
}

/** SEC1-uncompressed P-256 point: 0x04 ‖ X(32) ‖ Y(32) = 65 bytes. */
export function isUncompressedP256Point(bytes: Uint8Array): boolean {
	return bytes.length === 65 && bytes[0] === 0x04
}
