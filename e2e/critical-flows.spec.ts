import { expect, test } from "@playwright/test"

import { installDaoApiMocks } from "./fixtures/mock-dao-api"
import { mockHorizonBalances } from "./fixtures/mock-horizon"
import { installMockFreighter } from "./fixtures/mock-wallet"

test.describe("Critical flows (mock wallet)", () => {
	test.beforeEach(async ({ page }) => {
		await installMockFreighter(page)
		await mockHorizonBalances(page)
		await installDaoApiMocks(page)
	})

	test("Learner enroll flow is reachable", async ({ page }) => {
		await page.goto("/learn")

		await expect(page.getByRole("heading", { name: "Learn" })).toBeVisible()
		await page.getByTestId("enroll-course").click()
		await expect(
			page.getByRole("button", { name: /Mark as Complete/i }).first(),
		).toBeVisible()
	})

	test("Scholarship proposal submit appears in DAO proposals page", async ({
		page,
	}) => {
		await page.goto("/dao/propose")

		await expect(
			page.getByRole("heading", { name: "Create Proposal" }),
		).toBeVisible()
		await page.locator('input[name="title"]').fill("My Scholarship Proposal")
		await page
			.locator('textarea[name="description"]')
			.fill("Fund one more scholar")
		await page.locator('input[name="fundingAmount"]').fill("250")
		await page.getByTestId("submit-proposal").click()

		await expect(page).toHaveURL(/\/dao\/proposals\?proposal=\d+/)
		await expect(page.getByTestId("proposal-detail-title")).toHaveText(
			"My Scholarship Proposal",
		)
		await expect(page.getByTestId("proposal-title").first()).toHaveText(
			"My Scholarship Proposal",
		)
	})

	test("DAO member vote flow is reachable on the backend-backed proposals page", async ({
		page,
	}) => {
		await page.goto("/dao/proposals?proposal=1")

		await expect(page.getByText("10 GOV").first()).toBeVisible()
		await expect(page.getByTestId("vote-yes-count")).toContainText("0 GOV")
		await page.getByTestId("vote-yes").click()
		await expect(page.getByTestId("vote-yes-count")).toContainText("10 GOV")
		await expect(page.getByText(/You voted Yes/i)).toBeVisible()
	})

	test("Comments load from the proposal comments endpoint", async ({
		page,
	}) => {
		await page.goto("/dao/proposals?proposal=1")

		await expect(
			page.getByRole("heading", { name: /Discussion/i }),
		).toBeVisible()
		await expect(page.getByText("Peer discussion point")).toBeVisible()
	})
})
