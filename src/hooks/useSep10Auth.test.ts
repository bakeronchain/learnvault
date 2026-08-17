import { renderHook, act, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { setAuthSession } from "../util/auth"
import { useSep10Auth } from "./useSep10Auth"

vi.mock("../util/auth", () => ({
	setAuthSession: vi.fn(),
}))

vi.mock("../lib/auth", () => ({
	buildApiUrl: (path: string) => `http://localhost:4000${path}`,
}))

const mockSetAuthSession = vi.mocked(setAuthSession)

describe("useSep10Auth", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("starts with default state", () => {
		const { result } = renderHook(() => useSep10Auth())

		expect(result.current.isAuthenticating).toBe(false)
		expect(result.current.error).toBeNull()
		expect(typeof result.current.authenticate).toBe("function")
	})

	it("authenticates successfully with a valid challenge-response flow", async () => {
		const mockSignTransaction = vi.fn().mockResolvedValue({
			signedTxXdr: "signed_xdr_base64",
			signerAddress: "GTEST1234",
		})

		// Mock fetch for challenge
		global.fetch = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					transaction: "challenge_xdr",
					network_passphrase: "Test SDF Network ; September 2015",
				}),
			})
			// Mock fetch for verification
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					token: "jwt_access_token",
					refreshToken: "jwt_refresh_token",
					tokenType: "Bearer",
					expiresIn: "24h",
				}),
			})

		const { result } = renderHook(() => useSep10Auth())

		let success: boolean | undefined
		await act(async () => {
			success = await result.current.authenticate(
				"GTEST1234",
				mockSignTransaction,
				"Test SDF Network ; September 2015",
			)
		})

		expect(success).toBe(true)
		expect(result.current.isAuthenticating).toBe(false)
		expect(result.current.error).toBeNull()
		expect(mockSignTransaction).toHaveBeenCalledWith("challenge_xdr", {
			networkPassphrase: "Test SDF Network ; September 2015",
			address: "GTEST1234",
		})
		expect(mockSetAuthSession).toHaveBeenCalledWith(
			"jwt_access_token",
			"jwt_refresh_token",
		)
	})

	it("handles challenge fetch failure", async () => {
		const mockSignTransaction = vi.fn()

		global.fetch = vi.fn().mockResolvedValueOnce({
			ok: false,
			status: 400,
			json: async () => ({ error: "Invalid account" }),
		})

		const { result } = renderHook(() => useSep10Auth())

		let success: boolean | undefined
		await act(async () => {
			success = await result.current.authenticate(
				"INVALID",
				mockSignTransaction,
			)
		})

		expect(success).toBe(false)
		expect(result.current.error).toBe("Invalid account")
		expect(mockSignTransaction).not.toHaveBeenCalled()
	})

	it("handles signature failure", async () => {
		const mockSignTransaction = vi
			.fn()
			.mockRejectedValue(new Error("User rejected signing"))

		global.fetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				transaction: "challenge_xdr",
				network_passphrase: "Test SDF Network ; September 2015",
			}),
		})

		const { result } = renderHook(() => useSep10Auth())

		let success: boolean | undefined
		await act(async () => {
			success = await result.current.authenticate(
				"GTEST1234",
				mockSignTransaction,
			)
		})

		expect(success).toBe(false)
		expect(result.current.error).toBe("User rejected signing")
	})

	it("handles verification failure", async () => {
		const mockSignTransaction = vi.fn().mockResolvedValue({
			signedTxXdr: "signed_xdr",
		})

		global.fetch = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					transaction: "challenge_xdr",
					network_passphrase: "Test SDF Network ; September 2015",
				}),
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 401,
				json: async () => ({ error: "Invalid signature" }),
			})

		const { result } = renderHook(() => useSep10Auth())

		let success: boolean | undefined
		await act(async () => {
			success = await result.current.authenticate(
				"GTEST1234",
				mockSignTransaction,
			)
		})

		expect(success).toBe(false)
		expect(result.current.error).toBe("Invalid signature")
	})

	it("clears error on new authentication attempt", async () => {
		const mockSignTransaction = vi.fn().mockResolvedValue({
			signedTxXdr: "signed_xdr",
		})

		global.fetch = vi
			.fn()
			// First call: fails
			.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: async () => ({ error: "First error" }),
			})
			// Second call: succeeds
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					transaction: "challenge_xdr",
					network_passphrase: "Test SDF Network ; September 2015",
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					token: "jwt_token",
					refreshToken: "refresh_token",
				}),
			})

		const { result } = renderHook(() => useSep10Auth())

		// First attempt fails
		await act(async () => {
			await result.current.authenticate("INVALID", mockSignTransaction)
		})

		expect(result.current.error).toBe("First error")

		// Second attempt succeeds and clears error
		await act(async () => {
			await result.current.authenticate("GTEST1234", mockSignTransaction)
		})

		expect(result.current.error).toBeNull()
	})
})
