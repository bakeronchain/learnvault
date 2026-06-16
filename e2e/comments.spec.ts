import { expect, test } from "@playwright/test"

import { installDaoApiMocks } from "./fixtures/mock-dao-api"
import { mockHorizonBalances } from "./fixtures/mock-horizon"
import { installMockFreighter } from "./fixtures/mock-wallet"

test.describe("Governance proposal comments", () => {
	test.beforeEach(async ({ page }) => {
		await installMockFreighter(page)
		await page.addInitScript(() => {
			localStorage.setItem("authToken", "e2e-mock-token")
		})
		await mockHorizonBalances(page)
		await installDaoApiMocks(page)
	})

	test("post, edit, upvote peer comment, delete own comment", async ({
		page,
	}) => {
		await page.goto("/dao/proposals?proposal=1")

		await expect(
			page.getByRole("heading", { name: /Discussion/i }),
		).toBeVisible()
		await expect(page.getByText("Peer discussion point")).toBeVisible()

		const body = "Governance journey note"
		const edited = "Governance journey note (edited)"

		await page.getByLabel("Add a comment").fill(body)
		await page.getByRole("button", { name: "Post Comment" }).click()
		await expect(page.getByText(body)).toBeVisible()

		const ownCard = page.getByTestId("comment-card-1000")
		await ownCard.getByTestId("comment-edit").click()
		await ownCard.getByTestId("comment-edit-field").fill(edited)
		await ownCard.getByTestId("comment-save-edit").click()
		await expect(page.getByText(edited)).toBeVisible()

		const peerCard = page.getByTestId("comment-card-101")
		await expect(peerCard.getByText("2")).toBeVisible()
		await peerCard.getByRole("button", { name: "Upvote comment" }).click()
		await expect(peerCard.getByText("3")).toBeVisible()

		page.once("dialog", (dialog) => dialog.accept())
		await ownCard.getByTestId("comment-delete").click()
		await expect(page.getByText(edited)).toHaveCount(0)
		await expect(page.getByText("Peer discussion point")).toBeVisible()
	})
})
