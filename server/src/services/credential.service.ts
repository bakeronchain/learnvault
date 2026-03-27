import { milestoneStore } from "../db/milestone-store"
import { pinJsonToIPFS } from "./pinata.service"
import {
	stellarContractService,
	type ContractCallResult,
} from "./stellar-contract.service"

export interface CertificateMintResult {
	minted: boolean
	tokenUri?: string
	mintTxHash?: string | null
	simulated?: boolean
}

async function isCourseComplete(
	scholarAddress: string,
	courseId: string,
): Promise<boolean> {
	const { totalMilestones, approvedCount } =
		await milestoneStore.getMilestoneProgress(scholarAddress, courseId)
	return totalMilestones > 0 && approvedCount >= totalMilestones
}

async function generateAndPinMetadata(
	scholarAddress: string,
	courseId: string,
): Promise<string> {
	const metadata = {
		name: `LearnVault Certificate — ${courseId}`,
		description: `Soulbound certificate awarded to ${scholarAddress} for completing all milestones in course ${courseId} on LearnVault.`,
		image: "ipfs://bafkreihdwdcefgh4dqkjv67uzcmw7oj5ulnmrg2ibnong2tefnifowzjte",
		attributes: [
			{ trait_type: "Course", value: courseId },
			{ trait_type: "Scholar", value: scholarAddress },
			{ trait_type: "Completed At", value: new Date().toISOString() },
		],
	}

	const cid = await pinJsonToIPFS(
		metadata,
		`cert-${courseId}-${scholarAddress}`,
	)
	return `ipfs://${cid}`
}

async function mintCertificateIfComplete(
	scholarAddress: string,
	courseId: string,
): Promise<CertificateMintResult> {
	const complete = await isCourseComplete(scholarAddress, courseId)
	if (!complete) {
		return { minted: false }
	}

	const tokenUri = await generateAndPinMetadata(scholarAddress, courseId)

	const mintResult: ContractCallResult =
		await stellarContractService.callMintScholarNFT(scholarAddress, tokenUri)

	return {
		minted: true,
		tokenUri,
		mintTxHash: mintResult.txHash,
		simulated: mintResult.simulated,
	}
}

export const credentialService = {
	isCourseComplete,
	generateAndPinMetadata,
	mintCertificateIfComplete,
}
