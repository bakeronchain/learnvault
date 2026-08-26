import { createHash, createHmac, timingSafeEqual } from "node:crypto"

import { createTarGzip } from "./data-export-archive"
import { DATA_RELATIONS, type DataRelation } from "./data-rights-policy"
import { type DataRightsStore, type ExportJob } from "./data-rights-store"
import { type EmailService } from "./email.service"

const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000
const DOWNLOAD_TTL_MS = 15 * 60 * 1000

export interface DataRightsServiceOptions {
	signingSecret: string
	now?: () => Date
	emailService?: EmailService
}

export interface ExportView {
	id: string
	status: ExportJob["status"]
	createdAt: Date
	expiresAt: Date | null
	downloadToken?: string
}

function createReadme(relations: readonly DataRelation[]): string {
	const lines = [
		"LearnVault learner data export",
		"",
		"Each JSON file contains only rows associated with your Stellar address.",
		"An empty array means that LearnVault has no matching rows in that table.",
		"Public on-chain records are included for context but cannot be erased.",
		"",
		"Files:",
	]
	for (const relation of relations) {
		lines.push(
			`- ${relation.table}.json: ${relation.description} (deletion policy: ${relation.deletion})`,
		)
	}
	return `${lines.join("\n")}\n`
}

function safeErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Unknown export error"
}

/** Coordinates export, grace-period deletion, and irreversible erasure. */
export function createDataRightsService(
	store: DataRightsStore,
	options: DataRightsServiceOptions,
) {
	const now = options.now ?? (() => new Date())

	function signDownload(
		jobId: string,
		address: string,
		expiresAt: Date,
	): string {
		const expiry = Math.floor(expiresAt.getTime() / 1000)
		const payload = `${jobId}.${address}.${expiry}`
		const signature = createHmac("sha256", options.signingSecret)
			.update(payload)
			.digest("base64url")
		return `${expiry}.${signature}`
	}

	return {
		async requestExport(walletAddress: string): Promise<ExportView> {
			const job = await store.createExportJob(walletAddress)
			return {
				id: job.id,
				status: job.status,
				createdAt: job.createdAt,
				expiresAt: job.expiresAt,
			}
		},

		async getExport(id: string, walletAddress: string): Promise<ExportView> {
			const job = await store.getExportJob(id)
			if (!job || job.walletAddress !== walletAddress) {
				throw new Error("Export not found")
			}
			return {
				id: job.id,
				status: job.status,
				createdAt: job.createdAt,
				expiresAt: job.expiresAt,
				downloadToken:
					job.status === "ready" && job.expiresAt
						? signDownload(job.id, walletAddress, job.expiresAt)
						: undefined,
			}
		},

		verifyDownloadToken(
			jobId: string,
			walletAddress: string,
			token: string,
		): boolean {
			const [expiryText, signature] = token.split(".")
			const expiry = Number(expiryText)
			if (!signature || !Number.isSafeInteger(expiry)) return false
			if (expiry * 1000 <= now().getTime()) return false
			const expected = createHmac("sha256", options.signingSecret)
				.update(`${jobId}.${walletAddress}.${expiry}`)
				.digest("base64url")
			const actualBuffer = Buffer.from(signature)
			const expectedBuffer = Buffer.from(expected)
			return (
				actualBuffer.length === expectedBuffer.length &&
				timingSafeEqual(actualBuffer, expectedBuffer)
			)
		},

		async getDownload(
			id: string,
			token: string,
		): Promise<{ archive: Buffer; walletAddress: string }> {
			const job = await store.getExportJob(id)
			if (
				!job ||
				job.status !== "ready" ||
				!job.archive ||
				!job.expiresAt ||
				job.expiresAt <= now() ||
				!this.verifyDownloadToken(id, job.walletAddress, token)
			) {
				throw new Error("Download link is invalid or expired")
			}
			return { archive: job.archive, walletAddress: job.walletAddress }
		},

		async buildArchive(walletAddress: string): Promise<Buffer> {
			const files: Array<{ name: string; contents: string }> = [
				{ name: "README.txt", contents: createReadme(DATA_RELATIONS) },
			]
			for (const relation of DATA_RELATIONS) {
				const rows = await store.readRows(relation, walletAddress)
				files.push({
					name: `${relation.table}.json`,
					contents: `${JSON.stringify(rows, null, 2)}\n`,
				})
			}
			return createTarGzip(files, now())
		},

		async processNextExport(): Promise<boolean> {
			const job = await store.claimPendingExport()
			if (!job) return false
			try {
				const archive = await this.buildArchive(job.walletAddress)
				const expiresAt = new Date(now().getTime() + DOWNLOAD_TTL_MS)
				await store.completeExportJob(job.id, archive, expiresAt)
				const email = await store.findContactEmail(job.walletAddress)
				if (email && options.emailService) {
					await options.emailService.sendNotification({
						to: email,
						subject: "Your LearnVault data export is ready",
						template: "general-notification",
						data: {
							name: "Learner",
							body: "Sign in to LearnVault to download your export.",
							actionUrl: `${process.env.FRONTEND_URL ?? "https://learnvault.app"}/profile`,
							unsubscribeUrl: "#",
						},
					})
				}
				return true
			} catch (error) {
				await store.failExportJob(job.id, safeErrorMessage(error))
				throw error
			}
		},

		async scheduleDeletion(walletAddress: string): Promise<Date> {
			const eraseAfter = new Date(now().getTime() + GRACE_PERIOD_MS)
			await store.scheduleDeletion(walletAddress, eraseAfter)
			return eraseAfter
		},

		getPendingDeletion(walletAddress: string) {
			return store.getPendingDeletion(walletAddress)
		},

		async cancelDeletion(walletAddress: string): Promise<void> {
			await store.cancelDeletion(walletAddress)
		},

		async processNextDeletion(): Promise<boolean> {
			const deletion = await store.claimExpiredDeletion()
			if (!deletion) return false
			const hash = createHash("sha256")
				.update(deletion.walletAddress)
				.digest("hex")
			const anonymousAddress = `deleted-${hash.slice(0, 32)}`
			await store.hardDelete(
				DATA_RELATIONS,
				deletion.walletAddress,
				anonymousAddress,
				deletion.id,
				hash,
			)
			return true
		},
	}
}

export type DataRightsService = ReturnType<typeof createDataRightsService>
export type { DataRightsStore }
export { DATA_RELATIONS }
