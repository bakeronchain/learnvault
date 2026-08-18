import { describe, expect, it } from "vitest"
import {
	derToRawEcdsaSignature,
	fromBase64Url,
	isUncompressedP256Point,
	toBase64Url,
} from "./webauthn"

describe("toBase64Url / fromBase64Url", () => {
	it("round-trips arbitrary bytes without padding or +//", () => {
		const original = new Uint8Array(64)
		for (let i = 0; i < original.length; i++) original[i] = (i * 37) % 256

		const encoded = toBase64Url(original)
		expect(encoded).not.toMatch(/[+/=]/)
		expect(fromBase64Url(encoded)).toEqual(original)
	})

	it("matches the WebAuthn base64url encoding of a known challenge", () => {
		const bytes = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe])
		expect(toBase64Url(bytes)).toBe("AAEC__4")
	})
})

describe("derToRawEcdsaSignature", () => {
	it("converts a real Node-generated DER P-256 signature into a raw r‖s that verifies", async () => {
		const { generateKeyPairSync, sign, verify } = await import("node:crypto")
		const { publicKey, privateKey } = generateKeyPairSync("ec", {
			namedCurve: "P-256",
		})

		// ECDSA signing is randomized (fresh nonce per call), so this must be a
		// single signature converted, not two independent signings compared —
		// the latter would fail even for a correct implementation.
		const message = Buffer.from("challenge-payload")
		const der = sign("sha256", message, privateKey)

		const converted = derToRawEcdsaSignature(new Uint8Array(der))
		expect(converted).toHaveLength(64)

		const verified = verify(
			"sha256",
			message,
			{ key: publicKey, dsaEncoding: "ieee-p1363" },
			Buffer.from(converted),
		)
		expect(verified).toBe(true)
	})

	it("handles a signature whose r/s components need leading zero-stripping", () => {
		// r starts with 0x00 0x8x... (DER pads it so the high bit isn't read as
		// a sign) — the raw encoding must drop that pad byte, not keep 33 bytes.
		const r = new Uint8Array(33)
		r[0] = 0x00
		r[1] = 0x80
		const s = new Uint8Array(32).fill(0x01)

		const der = new Uint8Array([
			0x30,
			2 + r.length + 2 + s.length,
			0x02,
			r.length,
			...r,
			0x02,
			s.length,
			...s,
		])

		const raw = derToRawEcdsaSignature(der)
		expect(raw).toHaveLength(64)
		expect(raw.slice(0, 32)).toEqual(
			new Uint8Array([0x80, ...new Array(31).fill(0)]),
		)
		expect(raw.slice(32)).toEqual(new Uint8Array(32).fill(0x01))
	})

	it("throws on malformed input", () => {
		expect(() => derToRawEcdsaSignature(new Uint8Array([0x00]))).toThrow()
	})
})

describe("isUncompressedP256Point", () => {
	it("accepts a 65-byte 0x04-prefixed point", () => {
		const point = new Uint8Array(65)
		point[0] = 0x04
		expect(isUncompressedP256Point(point)).toBe(true)
	})

	it("rejects wrong length or prefix", () => {
		expect(isUncompressedP256Point(new Uint8Array(64))).toBe(false)
		const wrongPrefix = new Uint8Array(65)
		wrongPrefix[0] = 0x03
		expect(isUncompressedP256Point(wrongPrefix)).toBe(false)
	})
})
