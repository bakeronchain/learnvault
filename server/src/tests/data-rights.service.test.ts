import { gunzipSync } from "node:zlib"

import {
	DATA_RELATIONS,
	createDataRightsService,
	type DataRightsStore,
} from "../services/data-rights.service"
import { type EmailService } from "../services/email.service"

const USER_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
const USER_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"

function tarEntryNames(archive: Buffer): string[] {
	const tar = gunzipSync(archive)
	const names: string[] = []
	for (let offset = 0; offset + 512 <= tar.length;) {
		const name = tar
			.subarray(offset, offset + 100)
			.toString("utf8")
			.replace(/\0.*$/, "")
		if (!name) break
		names.push(name)
		const sizeText = tar
			.subarray(offset + 124, offset + 136)
			.toString("ascii")
			.replace(/\0.*$/, "")
			.trim()
		const size = Number.parseInt(sizeText || "0", 8)
		offset += 512 + Math.ceil(size / 512) * 512
	}
	return names
}

function buildStore(): jest.Mocked<DataRightsStore> {
	return {
		createExportJob: jest.fn(),
		getExportJob: jest.fn(),
		claimPendingExport: jest.fn(),
		completeExportJob: jest.fn(),
		failExportJob: jest.fn(),
		readRows: jest.fn().mockImplementation(async (relation, address) => {
			if (relation.table === "forum_threads") {
				return [{ id: 1, author_address: address, title: "Mine" }]
			}
			return []
		}),
		findContactEmail: jest.fn().mockResolvedValue(null),
		scheduleDeletion: jest.fn(),
		getPendingDeletion: jest.fn(),
		cancelDeletion: jest.fn(),
		claimExpiredDeletion: jest.fn(),
		hardDelete: jest.fn(),
	}
}

describe("learner data rights service", () => {
	it("builds a documented archive from every migration-derived relation", async () => {
		const store = buildStore()
		const service = createDataRightsService(store, {
			signingSecret: "test-secret",
			now: () => new Date("2026-08-25T12:00:00.000Z"),
		})

		const archive = await service.buildArchive(USER_A)
		const names = tarEntryNames(archive)

		expect(names).toContain("README.txt")
		for (const relation of DATA_RELATIONS) {
			expect(names).toContain(`${relation.table}.json`)
			expect(store.readRows).toHaveBeenCalledWith(relation, USER_A)
		}
		expect(JSON.stringify(gunzipSync(archive))).not.toContain(USER_B)
	})

	it("authorises export status and rejects expired download signatures", async () => {
		const store = buildStore()
		store.getExportJob.mockResolvedValue({
			id: "job-1",
			walletAddress: USER_A,
			status: "ready",
			archive: Buffer.from("archive"),
			expiresAt: new Date("2026-08-25T12:05:00.000Z"),
			createdAt: new Date("2026-08-25T11:59:00.000Z"),
		})
		let currentTime = new Date("2026-08-25T12:00:00.000Z")
		const service = createDataRightsService(store, {
			signingSecret: "test-secret",
			now: () => currentTime,
		})

		await expect(service.getExport("job-1", USER_B)).rejects.toThrow(
			"Export not found",
		)
		const status = await service.getExport("job-1", USER_A)
		expect(status.downloadToken).toBeDefined()
		expect(
			service.verifyDownloadToken("job-1", USER_A, status.downloadToken!),
		).toBe(true)

		currentTime = new Date("2026-08-25T12:06:00.000Z")
		expect(
			service.verifyDownloadToken("job-1", USER_A, status.downloadToken!),
		).toBe(false)
	})

	it("processes exports asynchronously and emails the learner when possible", async () => {
		const store = buildStore()
		store.claimPendingExport.mockResolvedValue({
			id: "job-1",
			walletAddress: USER_A,
			status: "processing",
			archive: null,
			expiresAt: null,
			createdAt: new Date("2026-08-25T11:59:00.000Z"),
		})
		store.findContactEmail.mockResolvedValue("learner@example.com")
		const emailService = {
			sendNotification: jest.fn().mockResolvedValue(true),
		} as unknown as EmailService
		const service = createDataRightsService(store, {
			signingSecret: "test-secret",
			now: () => new Date("2026-08-25T12:00:00.000Z"),
			emailService,
		})

		await expect(service.processNextExport()).resolves.toBe(true)

		expect(store.completeExportJob).toHaveBeenCalledWith(
			"job-1",
			expect.any(Buffer),
			new Date("2026-08-25T12:15:00.000Z"),
		)
		expect(emailService.sendNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "learner@example.com",
				template: "general-notification",
			}),
		)
	})

	it("soft deletes for 30 days and hard deletion handles every identifier", async () => {
		const store = buildStore()
		store.claimExpiredDeletion.mockResolvedValue({
			id: "deletion-1",
			walletAddress: USER_A,
		})
		const service = createDataRightsService(store, {
			signingSecret: "test-secret",
			now: () => new Date("2026-08-25T12:00:00.000Z"),
		})

		await service.scheduleDeletion(USER_A)
		expect(store.scheduleDeletion).toHaveBeenCalledWith(
			USER_A,
			new Date("2026-09-24T12:00:00.000Z"),
		)

		await service.processNextDeletion()
		expect(store.hardDelete).toHaveBeenCalledWith(
			DATA_RELATIONS,
			USER_A,
			expect.stringMatching(/^deleted-/),
			"deletion-1",
			expect.any(String),
		)
		expect(
			DATA_RELATIONS.find((relation) => relation.table === "forum_threads")
				?.deletion,
		).toBe("anonymise")
	})

	it("cancels a pending deletion during the grace period", async () => {
		const store = buildStore()
		const service = createDataRightsService(store, {
			signingSecret: "test-secret",
		})

		await service.cancelDeletion(USER_A)

		expect(store.cancelDeletion).toHaveBeenCalledWith(USER_A)
	})
})
