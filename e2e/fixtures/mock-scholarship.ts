import { type Page, type Route } from "@playwright/test"

/**
 * Wallet addresses for different roles in the scholarship lifecycle.
 * These are deterministic addresses used for E2E testing.
 */
export const SCHOLAR_WALLET_ADDRESS =
	"GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
export const DONOR_WALLET_ADDRESS =
	"GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
export const ADMIN_WALLET_ADDRESS =
	"GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"

/**
 * Proposal state that persists across the test lifecycle.
 */
export interface ScholarshipProposalState {
	id: number
	title: string
	description: string
	amountUsdc: string
	authorAddress: string
	status: "pending" | "funded" | "approved" | "rejected" | "completed"
	votesFor: string
	votesAgainst: string
	deadline: string
	createdAt: string
	fundedAmount: string
	donorAddress?: string
}

/**
 * Milestone state for tracking scholar progress.
 */
export interface ScholarshipMilestoneState {
	id: number
	proposalId: number
	scholarAddress: string
	courseId: string
	milestoneNumber: number
	description: string
	evidenceUrl: string
	status: "pending" | "approved" | "rejected"
	submittedAt: string
	approvedAt?: string
	trancheAmount: string
}

/**
 * Creates a comprehensive mock for the scholarship lifecycle API.
 * This handles proposals, contributions, voting, milestones, and admin actions.
 */
export async function installScholarshipApiMocks(page: Page) {
	let nextProposalId = 100
	let nextMilestoneId = 1000
	const proposals = new Map<number, ScholarshipProposalState>()
	const milestones = new Map<number, ScholarshipMilestoneState>()
	const contributions = new Map<number, { donorAddress: string; amount: string; txHash: string }[]>()

	// Initialize with a test proposal that can be voted on
	const initialProposal: ScholarshipProposalState = {
		id: nextProposalId++,
		title: "Test Scholarship Proposal",
		description: "E2E test scholarship for complete lifecycle verification",
		amountUsdc: "500",
		authorAddress: SCHOLAR_WALLET_ADDRESS,
		status: "pending",
		votesFor: "0",
		votesAgainst: "0",
		deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
		createdAt: new Date().toISOString(),
		fundedAmount: "0",
	}
	proposals.set(initialProposal.id, initialProposal)

	await page.route("**/api/**", async (route: Route) => {
		const request = route.request()
		const url = new URL(request.url())
		const { pathname, searchParams } = url
		const method = request.method()

		// Helper to fulfill JSON responses
		const fulfillJson = async (body: unknown, status = 200) => {
			await route.fulfill({
				status,
				contentType: "application/json",
				body: JSON.stringify(body),
			})
		}

		// GET /api/proposals - List all proposals
		if (pathname === "/api/proposals" && method === "GET") {
			const proposalList = Array.from(proposals.values()).map((p) => ({
				id: p.id,
				title: p.title,
				description: p.description,
				amount: Number(p.amountUsdc),
				author_address: p.authorAddress,
				votes_for: p.votesFor,
				votes_against: p.votesAgainst,
				status: p.status,
				deadline: p.deadline,
				created_at: p.createdAt,
				funded_amount: p.fundedAmount,
				is_voting_open: p.status === "pending" || p.status === "funded",
				display_status:
					p.status === "pending"
						? "Voting Open"
						: p.status === "funded"
							? "Voting Open"
							: p.status === "approved"
								? "Passed"
								: "Rejected",
			}))
			return fulfillJson({
				proposals: proposalList,
				total: proposalList.length,
				page: 1,
			})
		}

		// POST /api/proposals - Create a new proposal
		if (pathname === "/api/proposals" && method === "POST") {
			const body = request.postDataJSON() as {
				author_address: string
				title: string
				description: string
				requested_amount: string
				evidence_url?: string
			}
			const proposal: ScholarshipProposalState = {
				id: nextProposalId++,
				title: body.title,
				description: body.description,
				amountUsdc: body.requested_amount,
				authorAddress: body.author_address,
				status: "pending",
				votesFor: "0",
				votesAgainst: "0",
				deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
				createdAt: new Date().toISOString(),
				fundedAmount: "0",
			}
			proposals.set(proposal.id, proposal)
			contributions.set(proposal.id, [])
			return fulfillJson({
				proposal_id: proposal.id,
				tx_hash: `tx-proposal-${proposal.id}`,
			})
		}

		// GET /api/proposals/:id - Get single proposal
		if (pathname.match(/^\/api\/proposals\/\d+$/) && method === "GET") {
			const proposalId = Number.parseInt(pathname.split("/").pop() ?? "0", 10)
			const proposal = proposals.get(proposalId)
			if (!proposal) {
				return fulfillJson({ error: "Proposal not found" }, 404)
			}
			return fulfillJson({
				id: proposal.id,
				title: proposal.title,
				description: proposal.description,
				amount: Number(proposal.amountUsdc),
				author_address: proposal.authorAddress,
				votes_for: proposal.votesFor,
				votes_against: proposal.votesAgainst,
				status: proposal.status,
				deadline: proposal.deadline,
				created_at: proposal.createdAt,
				funded_amount: proposal.fundedAmount,
				is_voting_open: proposal.status === "pending" || proposal.status === "funded",
			})
		}

		// POST /api/governance/vote - Cast a vote
		if (pathname === "/api/governance/vote" && method === "POST") {
			const body = request.postDataJSON() as {
				proposal_id: number
				support: boolean
				voter_address?: string
			}
			const proposal = proposals.get(body.proposal_id)
			if (!proposal) {
				return fulfillJson({ error: "Proposal not found" }, 404)
			}
			if (body.support) {
				proposal.votesFor = String(Number(proposal.votesFor) + 10)
			} else {
				proposal.votesAgainst = String(Number(proposal.votesAgainst) + 10)
			}
			proposals.set(body.proposal_id, proposal)
			return fulfillJson({
				tx_hash: `tx-vote-${body.proposal_id}-${body.support ? "yes" : "no"}`,
				votes_for: proposal.votesFor,
				votes_against: proposal.votesAgainst,
			})
		}

		// POST /api/scholarships/contribute - Donor funds a proposal
		if (pathname === "/api/scholarships/contribute" && method === "POST") {
			const body = request.postDataJSON() as {
				proposal_id: number
				donor_address: string
				amount: string
			}
			const proposal = proposals.get(body.proposal_id)
			if (!proposal) {
				return fulfillJson({ error: "Proposal not found" }, 404)
			}
			const newFunded = String(Number(proposal.fundedAmount) + Number(body.amount))
			proposal.fundedAmount = newFunded
			proposal.donorAddress = body.donor_address
			if (Number(newFunded) >= Number(proposal.amountUsdc)) {
				proposal.status = "funded"
			}
			proposals.set(body.proposal_id, proposal)

			const existingContribs = contributions.get(body.proposal_id) ?? []
			existingContribs.push({
				donorAddress: body.donor_address,
				amount: body.amount,
				txHash: `tx-contribute-${body.proposal_id}-${Date.now()}`,
			})
			contributions.set(body.proposal_id, existingContribs)

			return fulfillJson({
				tx_hash: `tx-contribute-${body.proposal_id}`,
				proposal_id: body.proposal_id,
				total_funded: newFunded,
			})
		}

		// GET /api/scholarships/contributions/:proposalId - Get contributions
		if (pathname.match(/^\/api\/scholarships\/contributions\/\d+$/) && method === "GET") {
			const proposalId = Number.parseInt(pathname.split("/").pop() ?? "0", 10)
			const contribs = contributions.get(proposalId) ?? []
			return fulfillJson({ contributions: contribs, total: contribs.length })
		}

		// POST /api/admin/proposals/:id/approve - Admin approves proposal (tranche 1)
		if (pathname.match(/^\/api\/admin\/proposals\/\d+\/approve$/) && method === "POST") {
			const proposalId = Number.parseInt(pathname.split("/")[4] ?? "0", 10)
			const proposal = proposals.get(proposalId)
			if (!proposal) {
				return fulfillJson({ error: "Proposal not found" }, 404)
			}
			proposal.status = "approved"
			proposals.set(proposalId, proposal)
			return fulfillJson({
				tx_hash: `tx-admin-approve-${proposalId}`,
				tranche_released: "1",
				message: "First tranche released to scholar",
			})
		}

		// POST /api/milestones/submit - Scholar submits milestone
		if (pathname === "/api/milestones/submit" && method === "POST") {
			const body = request.postDataJSON() as {
				scholarAddress: string
				courseId: string
				milestoneId: number
				evidenceGithub?: string
				evidenceIpfsCid?: string
				evidenceDescription?: string
			}
			const milestone: ScholarshipMilestoneState = {
				id: nextMilestoneId++,
				proposalId: 0,
				scholarAddress: body.scholarAddress,
				courseId: body.courseId,
				milestoneNumber: body.milestoneId,
				description: body.evidenceDescription ?? "Milestone submission",
				evidenceUrl: body.evidenceGithub ?? body.evidenceIpfsCid ?? "",
				status: "pending",
				submittedAt: new Date().toISOString(),
				trancheAmount: "100",
			}
			milestones.set(milestone.id, milestone)
			return fulfillJson({
				data: {
					id: milestone.id,
					course_id: milestone.courseId,
					milestone_id: milestone.milestoneNumber,
					status: milestone.status,
					scholar_address: milestone.scholarAddress,
				},
			})
		}

		// GET /api/scholar/milestones - Get scholar's milestones
		if (pathname === "/api/scholar/milestones" && method === "GET") {
			const scholarAddress = searchParams.get("address") ?? SCHOLAR_WALLET_ADDRESS
			const scholarMilestones = Array.from(milestones.values()).filter(
				(m) => m.scholarAddress.toLowerCase() === scholarAddress.toLowerCase(),
			)
			return fulfillJson({
				milestones: scholarMilestones.map((m) => ({
					id: m.id,
					course_id: m.courseId,
					milestone_id: m.milestoneNumber,
					status: m.status,
					evidence_github: m.evidenceUrl,
					evidence_description: m.description,
					submitted_at: m.submittedAt,
					resubmission_count: 0,
				})),
			})
		}

		// GET /api/admin/milestones - Admin gets pending milestones
		if (pathname === "/api/admin/milestones" && method === "GET") {
			const milestoneList = Array.from(milestones.values()).map((m) => ({
				id: m.id,
				scholar_address: m.scholarAddress,
				course: m.courseId,
				evidence_github: m.evidenceUrl,
				submitted_at: m.submittedAt,
				status: m.status,
			}))
			return fulfillJson({
				data: milestoneList,
				total: milestoneList.length,
				page: 1,
				pageSize: 10,
			})
		}

		// POST /api/admin/milestones/:id/approve - Admin approves milestone (releases tranche)
		if (pathname.match(/^\/api\/admin\/milestones\/\d+\/approve$/) && method === "POST") {
			const milestoneId = Number.parseInt(pathname.split("/")[4] ?? "0", 10)
			const milestone = milestones.get(milestoneId)
			if (!milestone) {
				return fulfillJson({ error: "Milestone not found" }, 404)
			}
			milestone.status = "approved"
			milestone.approvedAt = new Date().toISOString()
			milestones.set(milestoneId, milestone)
			return fulfillJson({
				tx_hash: `tx-milestone-approve-${milestoneId}`,
				tranche_released: milestone.trancheAmount,
				message: "Tranche funds released to scholar wallet",
			})
		}

		// GET /api/governance/voting-power/:address - Get voting power
		if (pathname.match(/^\/api\/governance\/voting-power\/.+$/) && method === "GET") {
			return fulfillJson({ gov_balance: "100" })
		}

		// GET /api/admin/stats - Admin dashboard stats
		if (pathname === "/api/admin/stats" && method === "GET") {
			const pendingCount = Array.from(milestones.values()).filter(
				(m) => m.status === "pending",
			).length
			return fulfillJson({
				pending_milestones: pendingCount,
				approved_milestones_today: 0,
				rejected_milestones_today: 0,
				total_scholars: 1,
				total_lrn_minted: "1000",
				open_proposals: Array.from(proposals.values()).filter(
					(p) => p.status === "pending" || p.status === "funded",
				).length,
				treasury_balance_usdc: "10000",
			})
		}

		// Default: continue to actual network
		return route.continue()
	})

	return {
		getProposal: (id: number) => proposals.get(id) ?? null,
		getMilestone: (id: number) => milestones.get(id) ?? null,
		getAllProposals: () => Array.from(proposals.values()),
		getAllMilestones: () => Array.from(milestones.values()),
	}
}

/**
 * Helper to switch wallet context by updating localStorage.
 * This simulates disconnecting one wallet and connecting another.
 */
export async function switchWallet(page: Page, address: string) {
	await page.evaluate(
		({ address, networkPassphrase }) => {
			localStorage.setItem("walletId", JSON.stringify("hot-wallet"))
			localStorage.setItem("walletType", JSON.stringify("hot-wallet"))
			localStorage.setItem("walletAddress", JSON.stringify(address))
			localStorage.setItem("walletNetwork", JSON.stringify("TESTNET"))
			localStorage.setItem("networkPassphrase", JSON.stringify(networkPassphrase))

			// Update the mock Freighter API with new address
			;(window as any).freighterApi = {
				isConnected: async () => true,
				isAllowed: async () => true,
				getPublicKey: async () => address,
				getNetwork: async () => "TESTNET",
				getNetworkDetails: async () => ({
					network: "TESTNET",
					networkPassphrase,
				}),
				signTransaction: async (xdr: string) => xdr,
				signMessage: async (message: string) => `signed:${message}`,
			}
		},
		{
			address,
			networkPassphrase: "Test SDF Network ; September 2015",
		},
	)
	// Reload page to trigger wallet reconnection
	await page.reload({ waitUntil: "networkidle" })
}

/**
 * Waits for and verifies a toast notification appears.
 */
export async function expectToast(page: Page, expectedText: string | RegExp) {
	const toastLocator = page.locator('[data-sonner-toast]')
	await expect(toastLocator).toContainText(expectedText)
}

import { expect } from "@playwright/test"
