import { type Pool } from "pg"

export interface SponsorLicenseGrant {
	id: number
	organization_id: number
	recipient_wallet_address: string
	license_type: string
	status: "pending" | "minted" | "failed"
	tx_hash: string | null
	amount_usdc: string
	granted_at: Date
	minted_at: Date | null
	metadata: Record<string, unknown>
}

export interface CreateLicenseGrantInput {
	organization_id: number
	recipient_wallet_address: string
	license_type?: string
	amount_usdc: number
	metadata?: Record<string, unknown>
}

export interface UpdateLicenseGrantStatusInput {
	id: number
	status: "pending" | "minted" | "failed"
	tx_hash?: string
	minted_at?: Date
}

export class SponsorLicenseStore {
	constructor(private pool: Pool) {}

	/**
	 * Create multiple license grants in a single transaction
	 */
	async createBulkGrants(
		grants: CreateLicenseGrantInput[],
	): Promise<SponsorLicenseGrant[]> {
		const client = await this.pool.connect()
		try {
			await client.query("BEGIN")

			const results: SponsorLicenseGrant[] = []

			for (const grant of grants) {
				const { rows } = await client.query<SponsorLicenseGrant>(
					`INSERT INTO sponsor_license_grants (
            organization_id,
            recipient_wallet_address,
            license_type,
            amount_usdc,
            metadata
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING *`,
					[
						grant.organization_id,
						grant.recipient_wallet_address.toLowerCase(),
						grant.license_type || "course_access",
						grant.amount_usdc,
						JSON.stringify(grant.metadata || {}),
					],
				)

				if (rows[0]) {
					results.push(rows[0])
				}
			}

			await client.query("COMMIT")
			return results
		} catch (error) {
			await client.query("ROLLBACK")
			throw error
		} finally {
			client.release()
		}
	}

	/**
	 * Get all grants for an organization
	 */
	async getGrantsByOrganization(
		organizationId: number,
	): Promise<SponsorLicenseGrant[]> {
		const { rows } = await this.pool.query<SponsorLicenseGrant>(
			`SELECT * FROM sponsor_license_grants
       WHERE organization_id = $1
       ORDER BY granted_at DESC`,
			[organizationId],
		)
		return rows
	}

	/**
	 * Get grants for a specific recipient wallet
	 */
	async getGrantsByRecipient(
		walletAddress: string,
	): Promise<SponsorLicenseGrant[]> {
		const { rows } = await this.pool.query<SponsorLicenseGrant>(
			`SELECT * FROM sponsor_license_grants
       WHERE LOWER(recipient_wallet_address) = LOWER($1)
       ORDER BY granted_at DESC`,
			[walletAddress],
		)
		return rows
	}

	/**
	 * Get pending grants that need to be minted
	 */
	async getPendingGrants(limit = 100): Promise<SponsorLicenseGrant[]> {
		const { rows } = await this.pool.query<SponsorLicenseGrant>(
			`SELECT * FROM sponsor_license_grants
       WHERE status = 'pending'
       ORDER BY granted_at ASC
       LIMIT $1`,
			[limit],
		)
		return rows
	}

	/**
	 * Update grant status (e.g., after minting on-chain)
	 */
	async updateGrantStatus(
		input: UpdateLicenseGrantStatusInput,
	): Promise<SponsorLicenseGrant | null> {
		const { rows } = await this.pool.query<SponsorLicenseGrant>(
			`UPDATE sponsor_license_grants
       SET status = $2,
           tx_hash = COALESCE($3, tx_hash),
           minted_at = COALESCE($4, minted_at)
       WHERE id = $1
       RETURNING *`,
			[input.id, input.status, input.tx_hash || null, input.minted_at || null],
		)
		return rows[0] || null
	}

	/**
	 * Get grant statistics for an organization
	 */
	async getOrganizationGrantStats(organizationId: number): Promise<{
		total_grants: number
		total_amount_usdc: string
		pending_count: number
		minted_count: number
		failed_count: number
	}> {
		const { rows } = await this.pool.query(
			`SELECT
         COUNT(*)::int AS total_grants,
         COALESCE(SUM(amount_usdc), 0)::text AS total_amount_usdc,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
         COUNT(*) FILTER (WHERE status = 'minted')::int AS minted_count,
         COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count
       FROM sponsor_license_grants
       WHERE organization_id = $1`,
			[organizationId],
		)
		return (
			rows[0] || {
				total_grants: 0,
				total_amount_usdc: "0",
				pending_count: 0,
				minted_count: 0,
				failed_count: 0,
			}
		)
	}
}
