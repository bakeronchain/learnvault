import crypto from "node:crypto"
import { type Database } from "pg"

const KEY_ROTATION_WINDOW_HOURS = 1
const KEY_ROTATION_ALERT_DAYS = 90

export type AdminApiKey = {
	id: number
	admin_address: string
	key_hash: string
	key_name: string
	is_active: boolean
	last_rotated_at: Date
	created_at: Date
	revoked_at?: Date
	rotation_reason?: string
}

export type AdminKeyRotationService = {
	generateApiKey(adminAddress: string, keyName: string): Promise<string>
	validateApiKey(apiKey: string, adminAddress: string): Promise<boolean>
	rotateKey(
		adminAddress: string,
		currentKeyHash: string,
		reason: string,
	): Promise<string>
	getActiveKeys(adminAddress: string): Promise<AdminApiKey[]>
	revokeKey(adminAddress: string, keyHash: string): Promise<void>
	checkRotationStatus(adminAddress: string): Promise<{
		lastRotated: Date
		daysSinceRotation: number
		needsRotation: boolean
	}>
}

export function createAdminKeyRotationService(
	db: Database,
): AdminKeyRotationService {
	function hashKey(key: string): string {
		return crypto.createHash("sha256").update(key).digest("hex")
	}

	function generateRandomKey(): string {
		return crypto.randomBytes(32).toString("hex")
	}

	return {
		async generateApiKey(
			adminAddress: string,
			keyName: string,
		): Promise<string> {
			const apiKey = generateRandomKey()
			const keyHash = hashKey(apiKey)

			await db.query(
				`INSERT INTO admin_api_keys 
        (admin_address, key_hash, key_name, last_rotated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT DO NOTHING`,
				[adminAddress, keyHash, keyName],
			)

			return apiKey
		},

		async validateApiKey(
			apiKey: string,
			adminAddress: string,
		): Promise<boolean> {
			const keyHash = hashKey(apiKey)

			const result = await db.query(
				`SELECT id FROM admin_api_keys 
        WHERE admin_address = $1 
        AND key_hash = $2 
        AND is_active = true 
        AND revoked_at IS NULL`,
				[adminAddress, keyHash],
			)

			return result.rows.length > 0
		},

		async rotateKey(
			adminAddress: string,
			currentKeyHash: string,
			reason: string,
		): Promise<string> {
			const client = await db.connect()
			try {
				await client.query("BEGIN")

				// Get the old key
				const oldKeyResult = await client.query(
					`SELECT id, key_hash FROM admin_api_keys 
          WHERE admin_address = $1 AND key_hash = $2 AND is_active = true`,
					[adminAddress, currentKeyHash],
				)

				if (oldKeyResult.rows.length === 0) {
					throw new Error("Current key not found or inactive")
				}

				const oldKeyId = oldKeyResult.rows[0]!.id

				// Generate new key
				const newApiKey = generateRandomKey()
				const newKeyHash = hashKey(newApiKey)

				// Insert new key with transition window
				await client.query(
					`INSERT INTO admin_api_keys 
          (admin_address, key_hash, key_name, is_active, last_rotated_at)
          VALUES ($1, $2, $3, true, NOW())`,
					[adminAddress, newKeyHash, `rotated_${Date.now()}`],
				)

				// Mark old key as deprecated (but still valid for transition window)
				await client.query(
					`UPDATE admin_api_keys 
          SET rotation_reason = $1
          WHERE id = $2`,
					[reason, oldKeyId],
				)

				// Record rotation in history
				await client.query(
					`INSERT INTO admin_key_rotation_history 
          (admin_address, old_key_hash, new_key_hash, rotation_reason, rotated_by)
          VALUES ($1, $2, $3, $4, $5)`,
					[adminAddress, currentKeyHash, newKeyHash, reason, adminAddress],
				)

				await client.query("COMMIT")

				return newApiKey
			} catch (error) {
				await client.query("ROLLBACK")
				throw error
			} finally {
				client.release()
			}
		},

		async getActiveKeys(adminAddress: string): Promise<AdminApiKey[]> {
			const result = await db.query(
				`SELECT * FROM admin_api_keys 
        WHERE admin_address = $1 AND is_active = true AND revoked_at IS NULL
        ORDER BY last_rotated_at DESC`,
				[adminAddress],
			)

			return result.rows
		},

		async revokeKey(adminAddress: string, keyHash: string): Promise<void> {
			await db.query(
				`UPDATE admin_api_keys 
        SET is_active = false, revoked_at = NOW()
        WHERE admin_address = $1 AND key_hash = $2`,
				[adminAddress, keyHash],
			)
		},

		async checkRotationStatus(
			adminAddress: string,
		): Promise<{ lastRotated: Date; daysSinceRotation: number; needsRotation: boolean }> {
			const result = await db.query(
				`SELECT last_rotated_at FROM admin_api_keys 
        WHERE admin_address = $1 
        ORDER BY last_rotated_at DESC LIMIT 1`,
				[adminAddress],
			)

			if (result.rows.length === 0) {
				return {
					lastRotated: new Date(),
					daysSinceRotation: 0,
					needsRotation: true,
				}
			}

			const lastRotated = new Date(result.rows[0]!.last_rotated_at)
			const daysSinceRotation = Math.floor(
				(Date.now() - lastRotated.getTime()) / (1000 * 60 * 60 * 24),
			)

			return {
				lastRotated,
				daysSinceRotation,
				needsRotation: daysSinceRotation > KEY_ROTATION_ALERT_DAYS,
			}
		},
	}
}
