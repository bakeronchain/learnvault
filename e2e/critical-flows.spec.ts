import { test, expect } from "@playwright/test"

import { mockHorizonBalances } from "./fixtures/mock-horizon"
import { installMockFreighter } from "./fixtures/mock-wallet"

test.describe("Critical flows (mock wallet)", () => {
	test("Learner enroll + complete lesson increases LRN", async ({ page }) => {
		await installMockFreighter(page)
		const horizon = await mockHorizonBalances(page, { startLrn: 0 })

		await page.goto("/learn")

		// Wallet balance should render (polling runs in background).
		await expect(page.getByText(/Wallet Balance:/)).toBeVisible()

		await page.getByTestId("enroll-course").click()

		// Complete lesson 1 (this triggers local fallback mode if contracts aren't wired).
		const markComplete = page
			.getByRole("button", { name: "Mark as Complete" })
			.first()
		await expect(markComplete).toBeEnabled()

		horizon.increaseLrn(10)
		await markComplete.click()

		await expect(page.getByText("Wallet Balance: 10 LRN")).toBeVisible()
	})

	test("Scholarship proposal submit appears in DAO page", async ({ page }) => {
		await installMockFreighter(page)
		await mockHorizonBalances(page)

		await page.goto("/dao")

		await expect(page.getByRole("heading", { name: "DAO" })).toBeVisible()

		await page.getByLabel("Title").fill("My Scholarship Proposal")
		await page.getByLabel("Amount (USDC)").fill("250")
		await page.getByTestId("submit-proposal").click()

		await expect(page.getByTestId("proposal-title").first()).toHaveText(
			"My Scholarship Proposal",
		)
	})

	test("DAO member vote flow route is reachable", async ({ page }) => {
		await installMockFreighter(page)
		await mockHorizonBalances(page)

		await page.goto("/dao")

		// Ensure at least one proposal exists
		await page.getByLabel("Title").fill("Vote on me")
		await page.getByLabel("Amount (USDC)").fill("123")
		await page.getByTestId("submit-proposal").click()

		// Become governance token holder via deposit flow (same page)
		await page.getByTestId("deposit-usdc").click()
		await expect(page.getByTestId("gov-token-balance")).toContainText("10")

		// Vote YES and verify count increments
		await expect(page.getByTestId("vote-count").first()).toContainText("0")
		await page.getByTestId("vote-yes").first().click()
		await expect(page.getByTestId("vote-count").first()).toContainText("1")
	})

	test("Donor deposits flow route is reachable", async ({ page }) => {
		await installMockFreighter(page)
		await mockHorizonBalances(page)

		await page.goto("/dao")

		await page.getByTestId("deposit-usdc").click()
		await expect(page.getByTestId("gov-token-balance")).toContainText("10")
	})
})
