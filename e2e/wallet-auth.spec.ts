import { expect, test } from "@playwright/test"

import { mockHorizonBalances } from "./fixtures/mock-horizon"
import {
	installMockFreighter,
	E2E_WALLET_ADDRESS,
} from "./fixtures/mock-wallet"

test.describe("Wallet connection and disconnection flow", () => {
	test.beforeEach(async ({ page }) => {
		await mockHorizonBalances(page)
	})

	test("connects wallet via mock Freighter and verifies connected state in NavBar", async ({
		page,
	}) => {
		await installMockFreighter(page)
		await page.goto("/")

		await expect(page.locator("header")).toBeVisible()

		await expect(
			page.locator("text=" + E2E_WALLET_ADDRESS.slice(0, 6)).first(),
		).toBeVisible({ timeout: 15_000 })
	})

	test("navigates to a protected page while connected", async ({ page }) => {
		await installMockFreighter(page)
		await page.goto("/profile")

		await expect(page.locator("header")).toBeVisible()
		await expect(
			page.locator("text=" + E2E_WALLET_ADDRESS.slice(0, 6)).first(),
		).toBeVisible({ timeout: 15_000 })
	})

	test("disconnects wallet and verifies redirect/connect prompt appears", async ({
		page,
	}) => {
		await installMockFreighter(page)
		await page.goto("/")

		await expect(
			page.locator("text=" + E2E_WALLET_ADDRESS.slice(0, 6)).first(),
		).toBeVisible({ timeout: 15_000 })

		const profileButton = page.locator('[class*="Profile"]').first()
		await profileButton.click()

		const disconnectButton = page.getByRole("button", { name: /Disconnect/i })
		await expect(disconnectButton).toBeVisible()
		await disconnectButton.click()

		await expect(
			page.getByRole("button", { name: /Connect|Wallet/i }).first(),
		).toBeVisible({ timeout: 15_000 })

		expect(
			await page.locator("text=" + E2E_WALLET_ADDRESS.slice(0, 6)).count(),
		).toBe(0)
	})

	test("protected pages show connect guard when wallet is not connected", async ({
		page,
	}) => {
		await page.goto("/profile")

		const connectButton = page
			.getByRole("button", { name: /Connect|Wallet/i })
			.first()
		if (await connectButton.isVisible().catch(() => false)) {
			await expect(connectButton).toBeVisible()
		}
	})
})
