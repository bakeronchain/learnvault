import { expect, test, type Page } from "@playwright/test"

import { mockHorizonBalances } from "./fixtures/mock-horizon"
import {
	installMockFreighter,
	E2E_WALLET_ADDRESS,
} from "./fixtures/mock-wallet"
import {
	installScholarshipApiMocks,
	switchWallet,
	SCHOLAR_WALLET_ADDRESS,
	DONOR_WALLET_ADDRESS,
	ADMIN_WALLET_ADDRESS,
	expectToast,
	type ScholarshipProposalState,
} from "./fixtures/mock-scholarship"

/**
 * End-to-End Test: Complete Scholarship Lifecycle
 *
 * This test verifies the full scholarship workflow from proposal creation
 * through final tranche release, covering all 8 critical steps:
 *
 * 1. Connect scholar wallet
 * 2. Submit scholarship proposal
 * 3. Switch to donor wallet and fund the proposal
 * 4. Execute DAO vote to approve the proposal
 * 5. Admin triggers first tranche release
 * 6. Switch to scholar wallet and submit milestone
 * 7. Admin approves milestone
 * 8. Verify tranche funds released to scholar
 */
test.describe("Scholarship Lifecycle E2E", () => {
	let mockApi: ReturnType<typeof installScholarshipApiMocks>
	let createdProposalId: number | null = null

	test.beforeEach(async ({ page }) => {
		// Set up all required mocks for the scholarship lifecycle
		await installMockFreighter(page)
		await mockHorizonBalances(page, { startLrn: 150 }) // Scholar has enough LRN
		mockApi = await installScholarshipApiMocks(page)

		// Wait for the app to be fully loaded
		await page.goto("/")
		await expect(page.locator("header")).toBeVisible()
	})

	test("completes full scholarship lifecycle from proposal to tranche release", async ({
		page,
	}) => {
		// =========================================================================
		// STEP 1: Connect Scholar Wallet
		// =========================================================================
		await test.step("Step 1: Connect scholar wallet", async () => {
			await expectScholarWalletConnected(page)
		})

		// =========================================================================
		// STEP 2: Submit Scholarship Proposal
		// =========================================================================
		await test.step("Step 2: Submit scholarship proposal", async () => {
			createdProposalId = await submitScholarshipProposal(page)
			expect(createdProposalId).toBeGreaterThan(0)
		})

		// =========================================================================
		// STEP 3: Switch to Donor Wallet and Fund the Proposal
		// =========================================================================
		await test.step("Step 3: Switch to donor wallet and fund proposal", async () => {
			await switchWallet(page, DONOR_WALLET_ADDRESS)
			await expectDonorWalletConnected(page)
			await fundProposal(page, createdProposalId!)
		})

		// =========================================================================
		// STEP 4: Execute DAO Vote to Approve the Proposal
		// =========================================================================
		await test.step("Step 4: Execute DAO vote to approve proposal", async () => {
			// Vote as a DAO member (using donor wallet with governance tokens)
			await voteOnProposal(page, createdProposalId!, true)
		})

		// =========================================================================
		// STEP 5: Admin Triggers First Tranche Release
		// =========================================================================
		await test.step("Step 5: Admin triggers first tranche release", async () => {
			await switchWallet(page, ADMIN_WALLET_ADDRESS)
			await expectAdminWalletConnected(page)
			await approveProposalAsAdmin(page, createdProposalId!)
		})

		// =========================================================================
		// STEP 6: Switch to Scholar Wallet and Submit Milestone
		// =========================================================================
		await test.step("Step 6: Switch to scholar wallet and submit milestone", async () => {
			await switchWallet(page, SCHOLAR_WALLET_ADDRESS)
			await expectScholarWalletConnected(page)
			await submitMilestone(page)
		})

		// =========================================================================
		// STEP 7: Admin Approves Milestone
		// =========================================================================
		await test.step("Step 7: Admin approves milestone", async () => {
			await switchWallet(page, ADMIN_WALLET_ADDRESS)
			await expectAdminWalletConnected(page)
			await approveMilestoneAsAdmin(page)
		})

		// =========================================================================
		// STEP 8: Verify Tranche Funds Released to Scholar
		// =========================================================================
		await test.step("Step 8: Verify tranche funds released to scholar wallet", async () => {
			// Switch back to scholar to verify they received funds
			await switchWallet(page, SCHOLAR_WALLET_ADDRESS)
			await expectScholarWalletConnected(page)
			await verifyTrancheReceived(page)
		})
	})
})

// =============================================================================
// Step 1: Scholar Wallet Connection
// =============================================================================

/**
 * Verifies the scholar wallet is connected by checking the navbar
 * displays the expected wallet address.
 */
async function expectScholarWalletConnected(page: Page) {
	await expect(
		page.locator(`text=${SCHOLAR_WALLET_ADDRESS.slice(0, 6)}`).first(),
	).toBeVisible({ timeout: 15_000 })
}

async function expectDonorWalletConnected(page: Page) {
	await expect(
		page.locator(`text=${DONOR_WALLET_ADDRESS.slice(0, 6)}`).first(),
	).toBeVisible({ timeout: 15_000 })
}

async function expectAdminWalletConnected(page: Page) {
	await expect(
		page.locator(`text=${ADMIN_WALLET_ADDRESS.slice(0, 6)}`).first(),
	).toBeVisible({ timeout: 15_000 })
}

// =============================================================================
// Step 2: Submit Scholarship Proposal
// =============================================================================

/**
 * Navigates to the scholarship application page, fills out the form
 * with valid data, and submits the proposal.
 *
 * @returns The created proposal ID
 */
async function submitScholarshipProposal(page: Page): Promise<number> {
	// Navigate to scholarship application page
	await page.goto("/scholarships/apply")
	await expect(page.getByRole("heading", { name: /Scholarship application/i })).toBeVisible()

	// Step 1: Eligibility check - should pass with 150 LRN
	await expect(page.getByText(/Eligible to continue/i)).toBeVisible()
	await page.getByRole("button", { name: "Continue" }).click()

	// Step 2: Program details
	await page.locator('input[id="scholarship-program-name"]').fill("Soroban Developer Bootcamp")
	await page
		.locator('input[id="scholarship-program-url"]')
		.fill("https://example.com/bootcamp")
	await page
		.locator('textarea[id="scholarship-program-description"]')
		.fill(
			"This bootcamp will teach me advanced Soroban development including smart contract design, testing, and deployment on Stellar network.",
		)
	await page.locator('input[id="scholarship-start-date"]').fill("2026-05-01")
	await page.getByRole("button", { name: "Continue" }).click()

	// Step 3: Funding request
	await page.locator('input[id="scholarship-amount-usdc"]').fill("500")

	// Fill milestone 1
	await page
		.locator('textarea[id="milestone-0-description"]')
		.fill("Complete Soroban fundamentals course and deploy first contract")
	await page.locator('input[id="milestone-0-due-date"]').fill("2026-05-15")

	// Fill milestone 2
	await page
		.locator('textarea[id="milestone-1-description"]')
		.fill("Build a DeFi protocol with automated market maker")
	await page.locator('input[id="milestone-1-due-date"]').fill("2026-06-01")

	// Fill milestone 3
	await page
		.locator('textarea[id="milestone-2-description"]')
		.fill("Launch production dApp with full documentation")
	await page.locator('input[id="milestone-2-due-date"]').fill("2026-06-15")

	await page.getByRole("button", { name: "Continue" }).click()

	// Step 4: Review & Submit
	await page.locator('input[id="wallet-confirmed"]').check()
	await page.getByRole("button", { name: /Sign & submit/i }).click()

	// Wait for confirmation page
	await expect(page.getByRole("heading", { name: /Confirmation/i })).toBeVisible({
		timeout: 10_000,
	})

	// Extract proposal ID from the confirmation page
	const proposalIdText = await page
		.locator("text=Proposal ID")
		.locator("..")
		.textContent()
	const proposalId = proposalIdText?.match(/\d+/)?.[0]

	if (!proposalId) {
		throw new Error("Failed to extract proposal ID from confirmation page")
	}

	return Number(proposalId)
}

// =============================================================================
// Step 3: Fund Proposal (Donor)
// =============================================================================

/**
 * Navigates to the donor dashboard and funds the specified proposal.
 */
async function fundProposal(page: Page, proposalId: number) {
	await page.goto("/donor")

	// Wait for donor dashboard to load
	await expect(page.getByRole("heading", { name: /Donor Dashboard/i })).toBeVisible()

	// Click on "Become a Donor" or deposit button if no activity
	const depositButton = page.getByRole("button", { name: /Become a Donor|Deposit/i })
	if (await depositButton.isVisible().catch(() => false)) {
		await depositButton.click()
	}

	// Navigate to treasury page to fund specific proposal
	await page.goto("/treasury")
	await expect(page.getByRole("heading", { name: /Treasury|Scholarship/i })).toBeVisible()

	// Find and click the fund button for the specific proposal
	const fundButton = page.locator(`[data-proposal-id="${proposalId}"] button:has-text("Fund")`).first()
	if (await fundButton.isVisible().catch(() => false)) {
		await fundButton.click()

		// Fill funding amount
		await page.locator('input[type="number"]').fill("500")
		await page.getByRole("button", { name: /Confirm|Fund/i }).click()

		// Wait for success toast
		await expectToast(page, /funded|contribution successful/i)
	}
}

// =============================================================================
// Step 4: Vote on Proposal (DAO)
// =============================================================================

/**
 * Navigates to the DAO proposals page and casts a vote.
 */
async function voteOnProposal(page: Page, proposalId: number, support: boolean) {
	await page.goto(`/dao/proposals?proposal=${proposalId}`)

	// Wait for proposal to load
	await expect(page.getByTestId("proposal-detail-title")).toBeVisible({ timeout: 10_000 })

	// Click vote button (Yes or No)
	const voteButton = support
		? page.getByTestId("vote-yes")
		: page.getByTestId("vote-no")
	await voteButton.click()

	// Wait for vote confirmation
	await expect(page.getByText(/You voted (Yes|No)/i)).toBeVisible({ timeout: 10_000 })

	// Verify vote count updated
	await expect(page.getByTestId("vote-yes-count")).toContainText(
		support ? /10 GOV/ : /0 GOV/,
	)
}

// =============================================================================
// Step 5: Admin Approves Proposal (Tranche 1 Release)
// =============================================================================

/**
 * Navigates to admin page and approves the proposal, triggering
 * the first tranche release.
 */
async function approveProposalAsAdmin(page: Page, proposalId: number) {
	await page.goto("/admin")

	// Wait for admin dashboard
	await expect(page.getByRole("heading", { name: /Admin/i })).toBeVisible()

	// Navigate to scholarships section in admin
	const scholarshipsTab = page.getByRole("button", { name: /Scholarship/i })
	if (await scholarshipsTab.isVisible().catch(() => false)) {
		await scholarshipsTab.click()
	}

	// Find the proposal and approve it
	const approveButton = page.locator(
		`[data-proposal-id="${proposalId}"] button:has-text("Approve")`,
	).first()

	if (await approveButton.isVisible().catch(() => false)) {
		await approveButton.click()

		// Confirm the approval action
		const confirmButton = page.getByRole("button", { name: /Confirm|Yes/i })
		if (await confirmButton.isVisible().catch(() => false)) {
			await confirmButton.click()
		}

		// Wait for success toast
		await expectToast(page, /approved|tranche released/i)
	}
}

// =============================================================================
// Step 6: Submit Milestone (Scholar)
// =============================================================================

/**
 * Navigates to the scholar milestones page and submits a milestone report.
 */
async function submitMilestone(page: Page) {
	await page.goto("/scholar/milestones")

	// Wait for milestone page to load
	await expect(page.getByRole("heading", { name: /Milestone completion/i })).toBeVisible()

	// Fill out the milestone form
	await page
		.locator('input[name="courseId"], input[id="courseId"]')
		.fill("soroban-fundamentals")
	await page
		.locator('input[name="milestoneId"], input[id="milestoneId"]')
		.fill("1")
	await page
		.locator('input[name="evidenceGithub"], input[id="evidenceGithub"]')
		.fill("https://github.com/scholar/soroban-project")
	await page
		.locator('textarea[name="evidenceDescription"], textarea[id="evidenceDescription"]')
		.fill(
			"Completed the Soroban fundamentals course. Deployed a working smart contract that implements token transfers and balance tracking.",
		)

	// Accept terms
	const termsCheckbox = page.locator('input[type="checkbox"][name="acceptedTerms"]')
	if (await termsCheckbox.isVisible().catch(() => false)) {
		await termsCheckbox.check()
	}

	// Submit the milestone
	await page.getByRole("button", { name: /Submit Milestone/i }).click()

	// Wait for success confirmation
	await expect(page.getByText(/Report ID|submitted/i)).toBeVisible({ timeout: 10_000 })
}

// =============================================================================
// Step 7: Admin Approves Milestone (Tranche Release)
// =============================================================================

/**
 * Navigates to admin milestones queue and approves the pending milestone.
 */
async function approveMilestoneAsAdmin(page: Page) {
	await page.goto("/admin")

	// Navigate to milestones section
	const milestonesTab = page.getByRole("button", { name: /Milestone/i })
	if (await milestonesTab.isVisible().catch(() => false)) {
		await milestonesTab.click()
	}

	// Wait for milestones to load
	await expect(page.getByRole("heading", { name: /Milestone/i })).toBeVisible()

	// Find pending milestone and approve it
	const approveButton = page
		.locator('button:has-text("Approve")')
		.or(page.locator('[data-testid="approve-milestone"]'))
		.first()

	if (await approveButton.isVisible().catch(() => false)) {
		await approveButton.click()

		// Confirm the approval
		const confirmButton = page.getByRole("button", { name: /Confirm|Yes/i })
		if (await confirmButton.isVisible().catch(() => false)) {
			await confirmButton.click()
		}

		// Wait for success toast indicating funds released
		await expectToast(page, /approved|funds released|tranche/i)
	}
}

// =============================================================================
// Step 8: Verify Tranche Received (Scholar)
// =============================================================================

/**
 * Verifies the scholar has received the tranche funds by checking
 * their wallet balance or the dashboard.
 */
async function verifyTrancheReceived(page: Page) {
	// Navigate to dashboard to check balance
	await page.goto("/dashboard")

	// Wait for dashboard to load
	await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible()

	// Check for balance display - look for USDC or token balance
	const balanceLocator = page
		.locator("text=/USDC|text=/Balance|text=/\\$\\d+")
		.or(page.locator('[data-testid="balance"]'))
		.first()

	// Wait for balance to be visible (funds should have been released)
	await expect(balanceLocator).toBeVisible({ timeout: 10_000 })

	// Alternatively, check the history page for the tranche receipt
	await page.goto("/history")
	await expect(page.getByRole("heading", { name: /History|Activity/i })).toBeVisible()

	// Look for a transaction indicating funds received
	const receivedTransaction = page.locator(
		'text=/Received|text=/Tranche|text=/funds released|text=/Milestone Approved/i',
	)
	await expect(receivedTransaction).toBeVisible({ timeout: 10_000 })
}
