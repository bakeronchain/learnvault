jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn(),
	},
}))

jest.mock("../services/admin-audit.service", () => ({
	getRequestIp: jest.fn(() => "127.0.0.1"),
	recordAdminAuditEvent: jest.fn().mockResolvedValue(undefined),
}))

import { pool } from "../db/index"
import {
	getAdminKeyRotationStatus,
	rotateAdminApiKey,
	validateAdminApiKey,
} from "../services/admin-key.service"

const mockedQuery = pool.query as jest.Mock

describe("admin API key rotation", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		process.env.ADMIN_API_KEY = "bootstrap-admin-key"
		process.env.ADMIN_API_KEY_LAST_ROTATED_AT = "2026-01-01T00:00:00.000Z"
	})

	afterEach(() => {
		delete process.env.ADMIN_API_KEY
		delete process.env.ADMIN_API_KEY_LAST_ROTATED_AT
	})

	it("validates the bootstrap key when no rotated key exists yet", async () => {
		mockedQuery.mockResolvedValue({ rows: [] })

		await expect(validateAdminApiKey("bootstrap-admin-key")).resolves.toBe(true)
		await expect(validateAdminApiKey("wrong-key")).resolves.toBe(false)
	})

	it("rotates the key and keeps the previous one valid during the transition window", async () => {
		mockedQuery
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({})

		const result = await rotateAdminApiKey({
			currentKey: "bootstrap-admin-key",
			rotatedBy: "GADMIN123",
		})

		expect(result.newKey).toMatch(/^lv_admin_[a-f0-9]+$/)
		expect(new Date(result.transitionExpiresAt).getTime()).toBeGreaterThan(
			new Date(result.rotatedAt).getTime(),
		)

		mockedQuery.mockReset()
		mockedQuery.mockResolvedValue({
			rows: [
				{
					current_key_hash: require("crypto")
						.createHash("sha256")
						.update(result.newKey)
						.digest("hex"),
					previous_key_hash: require("crypto")
						.createHash("sha256")
						.update("bootstrap-admin-key")
						.digest("hex"),
					previous_key_expires_at: result.transitionExpiresAt,
					rotated_at: result.rotatedAt,
					rotated_by: "GADMIN123",
				},
			],
		})

		await expect(validateAdminApiKey(result.newKey)).resolves.toBe(true)
		await expect(validateAdminApiKey("bootstrap-admin-key")).resolves.toBe(true)
	})

	it("marks stale bootstrap keys when rotation age exceeds 90 days", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [] })

		const status = await getAdminKeyRotationStatus()
		expect(status.source).toBe("env")
		expect(status.stale).toBe(true)
		expect(status.rotatedAt).toBe("2026-01-01T00:00:00.000Z")
	})

	it("rejects rotation when the supplied current key is wrong", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [] })

		await expect(
			rotateAdminApiKey({
				currentKey: "wrong-key",
				rotatedBy: "GADMIN123",
			}),
		).rejects.toThrow("Current admin API key is invalid")
	})
})
