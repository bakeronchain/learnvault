import { bountyStore } from "../db/bounty-store"
import { logger } from "../lib/logger"

const log = logger.child({ module: "bounty-service" })

const VALID_TRANSITIONS: Record<string, string[]> = {
	open: ["claimed", "cancelled"],
	claimed: ["submitted", "open", "cancelled"],
	submitted: ["approved", "cancelled"],
	approved: ["paid"],
	paid: [],
	cancelled: [],
}

export function isValidTransition(
	from: string,
	to: string,
): boolean {
	return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export async function verifyEscrowDeposit(
	escrowTx: string,
	sponsorAddr: string,
	rewardUsdc: number,
): Promise<{ valid: boolean; reason?: string }> {
	if (!escrowTx || escrowTx.trim().length === 0) {
		return { valid: false, reason: "Escrow transaction hash is required" }
	}
	if (rewardUsdc <= 0) {
		return { valid: false, reason: "Reward must be positive" }
	}
	const alreadyFunded = await bountyStore.isEscrowTxFunded(escrowTx)
	if (alreadyFunded) {
		return {
			valid: false,
			reason: "This escrow transaction has already been used",
		}
	}

	// In a full implementation, we would verify on-chain:
	// 1. Transaction exists and succeeded
	// 2. Transaction belongs to the sponsor
	// 3. Correct escrow destination/contract was funded
	// 4. Correct USDC asset was used
	// 5. Deposited amount >= bounty reward
	//
	// For now we trust the escrow_tx reference and validate basic format.
	// The escrow contract verification would use stellarContractService.
	log.info(
		{ escrowTx, sponsorAddr, rewardUsdc },
		"Escrow deposit verification passed (basic validation)",
	)
	return { valid: true }
}

export async function releaseEscrow(
	bountyId: number,
	learnerAddr: string,
): Promise<{ success: boolean; txHash?: string; error?: string }> {
	const bounty = await bountyStore.getBountyById(bountyId)
	if (!bounty) {
		return { success: false, error: "Bounty not found" }
	}
	if (bounty.status !== "submitted") {
		return { success: false, error: "Bounty is not in submitted status" }
	}

	// In production, call the milestone_escrow contract to release funds:
	// const result = await stellarContractService.releaseEscrowTranche(...)
	//
	// For now, record the payout reference.
	log.info(
		{ bountyId, learnerAddr, rewardUsdc: bounty.reward_usdc },
		"Escrow release initiated for bounty",
	)
	return { success: true, txHash: `bounty-release-${bountyId}-${Date.now()}` }
}

export async function mintLrnReward(
	bountyId: number,
	learnerAddr: string,
): Promise<{ success: boolean; txHash?: string; error?: string }> {
	const bounty = await bountyStore.getBountyById(bountyId)
	if (!bounty) {
		return { success: false, error: "Bounty not found" }
	}

	const lrnAmount = Math.ceil(Number(bounty.reward_usdc) * 10)
	if (lrnAmount <= 0) {
		return { success: false, error: "Invalid LRN reward amount" }
	}

	// In production, call the learn_token contract to mint LRN:
	// const contract = new Contract(LEARN_TOKEN_CONTRACT_ID)
	// contract.call("mint", ...)
	//
	// For now, record the reward reference.
	log.info(
		{ bountyId, learnerAddr, lrnAmount },
		"LRN reward mint initiated for bounty",
	)
	return {
		success: true,
		txHash: `bounty-lrn-${bountyId}-${Date.now()}`,
	}
}
