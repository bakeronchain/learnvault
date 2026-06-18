/**
 * Governance Voting E2E
 *
 * Scenario:
 *  1. Connect governance token holder wallet
 *  2. Create a proposal
 *  3. Cast a yes vote
 *  4. Wait for voting period to end (mock time via API)
 *  5. Verify proposal state changes to PASSED
 *  6. Execute proposal
 *  7. Verify on-chain state changed (disbursement reflected in balance)
 */

import { expect, test, type Page, type Route } from "@playwright/test"

import { mockHorizonBalances } from "./fixtures/mock-horizon"
import {
	installMockFreighter,
	E2E_WALLET_ADDRESS,
} from "./fixtures/mock-wallet"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProposalStatus = "pending" | "approved" | "rejected" | "passed" | "executed"

type MockProposal = {
	id: number
	author_address: string
	title: string
	description: string
	amount: string
	votes_for: string
	votes_against: string
	status: ProposalStatus
	deadline: string | null
	created_at: string
	user_vote_support: boolean | null
	executed: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fulfillJson(route: Route, body: unknown, status = 200) {
	await route.fulfill({
		status,
		contentType: "application/json",
		body: JSON.stringify(body),
	})
}

/**
 * Installs API mocks that cover the full governance voting lifecycle.
 * Time is advanced by calling the returned `advancePastDeadline()` helper,
 * which flips the active proposal's status to "passed" to simulate the voting
 * period ending.
 */
async function installGovernanceMocks(page: Page) {
	let nextId = 2

	const proposals: MockProposal[] = [
		{
			id: 1,
			author_address: E2E_WALLET_ADDRESS,
			title: "Seed Scholarship Fund",
			description: "Initial governance proposal",
			amount: "500",
			votes_for: "20",
			votes_against: "5",
			status: "pending",
			deadline: "2099-01-01T00:00:00.000Z",
			created_at: "2026-01-01T00:00:00.000Z",
			user_vote_support: null,
			executed: false,
		},
	]

	// Track total USDC balance separately so we can reduce it on execution.
	let treasuryBalance = 10_000

	await page.route("**/api/**", async (route) => {
		const request = route.request()
		const url = new URL(request.url())
		const { pathname } = url
		const method = request.method()

		// --- List proposals ---
		if (pathname === "/api/proposals" && method === "GET") {
			const viewer = url.searchParams.get("viewer_address")
			return fulfillJson(route, {
				proposals: proposals.map((p) => ({
					...p,
					user_vote_support:
						viewer?.toLowerCase() === E2E_WALLET_ADDRESS.toLowerCase()
							? p.user_vote_support
							: null,
				})),
				total: proposals.length,
				page: 1,
			})
		}

		// --- Create proposal ---
		if (pathname === "/api/proposals" && method === "POST") {
			const body = request.postDataJSON() as {
				author_address: string
				title: string
				description: string
				requested_amount: string
			}
			const created: MockProposal = {
				id: nextId++,
				author_address: body.author_address,
				title: body.title,
				description: body.description,
				amount: body.requested_amount,
				votes_for: "0",
				votes_against: "0",
				status: "pending",
				deadline: "2099-01-01T00:00:00.000Z",
				created_at: new Date().toISOString(),
				user_vote_support: null,
				executed: false,
			}
			proposals.unshift(created)
			return fulfillJson(route, {
				proposal_id: created.id,
				tx_hash: `tx-create-${created.id}`,
			})
		}

		// --- Single proposal ---
		if (pathname.startsWith("/api/proposals/") && method === "GET") {
			const id = Number.parseInt(pathname.split("/")[3] ?? "", 10)
			const proposal = proposals.find((p) => p.id === id)
			if (!proposal) return fulfillJson(route, { error: "Not found" }, 404)
			return fulfillJson(route, proposal)
		}

		// --- Voting power ---
		if (pathname.startsWith("/api/governance/voting-power/")) {
			return fulfillJson(route, { gov_balance: "25" })
		}

		// --- Cast vote ---
		if (pathname === "/api/governance/vote" && method === "POST") {
			const body = request.postDataJSON() as {
				proposal_id: number
				support: boolean
			}
			const proposal = proposals.find((p) => p.id === body.proposal_id)
			if (!proposal) return fulfillJson(route, { error: "Not found" }, 404)

			if (body.support) {
				proposal.votes_for = String(Number(proposal.votes_for) + 25)
			} else {
				proposal.votes_against = String(Number(proposal.votes_against) + 25)
			}
			proposal.user_vote_support = body.support

			return fulfillJson(route, {
				tx_hash: `tx-vote-${proposal.id}`,
				votes_for: proposal.votes_for,
				votes_against: proposal.votes_against,
			})
		}

		// --- Finalize / advance past deadline ---
		if (pathname.startsWith("/api/proposals/") && pathname.endsWith("/finalize") && method === "POST") {
			const id = Number.parseInt(pathname.split("/")[3] ?? "", 10)
			const proposal = proposals.find((p) => p.id === id)
			if (!proposal) return fulfillJson(route, { error: "Not found" }, 404)

			// Simulate quorum met: yes_votes > no_votes → passed
			const yes = Number(proposal.votes_for)
			const no = Number(proposal.votes_against)
			proposal.status = yes > no ? "passed" : "rejected"
			proposal.deadline = new Date(Date.now() - 1000).toISOString()

			return fulfillJson(route, { status: proposal.status })
		}

		// --- Execute proposal ---
		if (pathname.startsWith("/api/proposals/") && pathname.endsWith("/execute") && method === "POST") {
			const id = Number.parseInt(pathname.split("/")[3] ?? "", 10)
			const proposal = proposals.find((p) => p.id === id)
			if (!proposal) return fulfillJson(route, { error: "Not found" }, 404)
			if (proposal.status !== "passed")
				return fulfillJson(route, { error: "Not passed" }, 400)

			proposal.status = "executed"
			proposal.executed = true
			treasuryBalance -= Number(proposal.amount)

			return fulfillJson(route, {
				tx_hash: `tx-exec-${proposal.id}`,
				disbursed: proposal.amount,
				treasury_balance: String(treasuryBalance),
			})
		}

		// --- Treasury balance ---
		if (pathname === "/api/treasury/balance") {
			return fulfillJson(route, { balance: String(treasuryBalance) })
		}

		return route.continue()
	})

	return {
		/** Flip the first pending proposal to "passed" without going through the UI. */
		advancePastDeadline() {
			const pending = proposals.find((p) => p.status === "pending")
			if (pending) {
				const yes = Number(pending.votes_for)
				const no = Number(pending.votes_against)
				pending.status = yes > no ? "passed" : "rejected"
				pending.deadline = new Date(Date.now() - 1000).toISOString()
			}
		},
		getProposals() {
			return proposals
		},
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Governance voting flow", () => {
	test.beforeEach(async ({ page }) => {
		await installMockFreighter(page)
		await mockHorizonBalances(page)
	})

	test("1. Wallet connects and governance token balance is shown", async ({ page }) => {
		await installGovernanceMocks(page)
		await page.goto("/dao")

		// Wallet address visible (shortened form)
		await expect(page.getByTestId("wallet-address")).toBeVisible()
		// Voting power is fetched and displayed
		await expect(page.getByText(/25 GOV/i).first()).toBeVisible()
	})

	test("2. Token holder can create a proposal", async ({ page }) => {
		await installGovernanceMocks(page)
		await page.goto("/dao/propose")

		await expect(page.getByRole("heading", { name: /Create Proposal/i })).toBeVisible()

		await page.locator('input[name="title"]').fill("Expand Scholar Cohort")
		await page.locator('textarea[name="description"]').fill("Fund five new scholars for Q3 2026")
		await page.locator('input[name="fundingAmount"]').fill("1000")
		await page.getByTestId("submit-proposal").click()

		await expect(page).toHaveURL(/\/dao\/proposals\?proposal=\d+/)
		await expect(page.getByTestId("proposal-detail-title")).toHaveText("Expand Scholar Cohort")
	})

	test("3. Token holder can cast a yes vote on an active proposal", async ({ page }) => {
		await installGovernanceMocks(page)
		await page.goto("/dao/proposals?proposal=1")

		// Initial vote counts visible
		await expect(page.getByTestId("vote-yes-count")).toContainText("20 GOV")
		await expect(page.getByTestId("vote-no-count")).toContainText("5 GOV")

		// Cast yes vote
		await page.getByTestId("vote-yes").click()

		// Count increases by voting power (25 GOV)
		await expect(page.getByTestId("vote-yes-count")).toContainText("45 GOV")
		await expect(page.getByText(/You voted Yes/i)).toBeVisible()

		// Voting buttons are disabled after voting
		await expect(page.getByTestId("vote-yes")).toBeDisabled()
		await expect(page.getByTestId("vote-no")).toBeDisabled()
	})

	test("4–5. After voting period ends proposal state changes to PASSED", async ({ page }) => {
		const mocks = await installGovernanceMocks(page)

		// Seed a proposal and cast a winning vote first
		await page.goto("/dao/proposals?proposal=1")
		await page.getByTestId("vote-yes").click()
		await expect(page.getByTestId("vote-yes-count")).toContainText("45 GOV")

		// Advance past the deadline (simulates time passing on-chain)
		mocks.advancePastDeadline()

		// Reload / navigate back so UI re-fetches proposal state
		await page.reload()

		await expect(page.getByTestId("proposal-status")).toContainText(/passed/i)
		// Execute button should now be available
		await expect(page.getByTestId("execute-proposal")).toBeVisible()
		await expect(page.getByTestId("vote-yes")).not.toBeVisible()
	})

	test("6–7. Executing a passed proposal updates treasury balance", async ({ page }) => {
		const mocks = await installGovernanceMocks(page)

		// Set up: vote and advance to passed state
		await page.goto("/dao/proposals?proposal=1")
		await page.getByTestId("vote-yes").click()
		mocks.advancePastDeadline()
		await page.reload()

		// Confirm status is PASSED
		await expect(page.getByTestId("proposal-status")).toContainText(/passed/i)

		// Execute
		await page.getByTestId("execute-proposal").click()

		// Status transitions to EXECUTED
		await expect(page.getByTestId("proposal-status")).toContainText(/executed/i)

		// Treasury balance decreases by the proposal amount (500 USDC)
		await page.goto("/dao")
		await expect(page.getByTestId("treasury-balance")).toContainText("9500")
	})
})
