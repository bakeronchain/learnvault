jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn(),
		connect: jest.fn(),
	},
}))

jest.mock("../services/pinata.service", () => ({
	pinJsonToIPFS: jest.fn().mockResolvedValue("bafkreifakeipfscid123"),
	getGatewayUrl: jest.fn(
		(cid: string) => `https://gateway.pinata.cloud/ipfs/${cid}`,
	),
}))

jest.mock("../services/stellar-contract.service", () => ({
	stellarContractService: {
		callVerifyMilestone: jest.fn().mockResolvedValue({
			txHash: "sim_verify_123",
			simulated: true,
		}),
		emitRejectionEvent: jest.fn().mockResolvedValue({
			txHash: "sim_reject_123",
			simulated: true,
		}),
		callMintScholarNFT: jest.fn().mockResolvedValue({
			txHash: "sim_mint_123",
			simulated: true,
		}),
	},
}))

import { inMemoryMilestoneStore } from "../db/milestone-store"
import { credentialService } from "../services/credential.service"

beforeEach(() => {
	// @ts-ignore
	inMemoryMilestoneStore["reports"] = []
	// @ts-ignore
	inMemoryMilestoneStore["auditLog"] = []
	// @ts-ignore
	inMemoryMilestoneStore["reportSeq"] = 1
	// @ts-ignore
	inMemoryMilestoneStore["auditSeq"] = 1
})

describe("credentialService.isCourseComplete", () => {
	it("returns false when no milestones exist", async () => {
		const result = await credentialService.isCourseComplete(
			"GSCHOLAR1",
			"stellar-basics",
		)
		expect(result).toBe(false)
	})

	it("returns false when not all milestones are approved", async () => {
		await inMemoryMilestoneStore.createReport({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "Done",
		})
		await inMemoryMilestoneStore.updateReportStatus(1, "approved")

		await inMemoryMilestoneStore.createReport({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 2,
			evidence_description: "WIP",
		})

		const result = await credentialService.isCourseComplete(
			"GSCHOLAR1",
			"stellar-basics",
		)
		expect(result).toBe(false)
	})

	it("returns true when all milestones are approved", async () => {
		await inMemoryMilestoneStore.createReport({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "Done",
		})
		await inMemoryMilestoneStore.updateReportStatus(1, "approved")

		await inMemoryMilestoneStore.createReport({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 2,
			evidence_description: "Done",
		})
		await inMemoryMilestoneStore.updateReportStatus(2, "approved")

		const result = await credentialService.isCourseComplete(
			"GSCHOLAR1",
			"stellar-basics",
		)
		expect(result).toBe(true)
	})
})

describe("credentialService.mintCertificateIfComplete", () => {
	it("returns minted: false when course is incomplete", async () => {
		await inMemoryMilestoneStore.createReport({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "WIP",
		})

		const result = await credentialService.mintCertificateIfComplete(
			"GSCHOLAR1",
			"stellar-basics",
		)
		expect(result.minted).toBe(false)
		expect(result.tokenUri).toBeUndefined()
	})

	it("mints certificate when all milestones are approved", async () => {
		await inMemoryMilestoneStore.createReport({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "Done",
		})
		await inMemoryMilestoneStore.updateReportStatus(1, "approved")

		const result = await credentialService.mintCertificateIfComplete(
			"GSCHOLAR1",
			"stellar-basics",
		)
		expect(result.minted).toBe(true)
		expect(result.tokenUri).toBe("ipfs://bafkreifakeipfscid123")
		expect(result.mintTxHash).toBe("sim_mint_123")
		expect(result.simulated).toBe(true)
	})
})
