import { expect, test } from "@playwright/test"
import { mockHorizonBalances } from "./fixtures/mock-horizon"
import { installMockFreighter } from "./fixtures/mock-wallet"

test.describe("Mobile responsive navigation", () => {
	test.beforeEach(async ({ page }) => {
		// Prevent the OnboardingTour driver.js overlay from firing and blocking clicks
		await page.addInitScript(() => {
			localStorage.setItem("learnvault:tour-complete", "true")
		})
		await installMockFreighter(page)
		await mockHorizonBalances(page)
	})

	test.describe("at 375px mobile viewport", () => {
		test.use({ viewport: { width: 375, height: 812 } })

		test("desktop nav is hidden and hamburger button is visible", async ({
			page,
		}) => {
			await page.goto("/")

			await expect(page.locator('nav[aria-label="Primary"]')).toBeHidden()

			const hamburger = page.getByRole("button", {
				name: "Open navigation menu",
			})
			await expect(hamburger).toBeVisible()
			await expect(hamburger).toHaveAttribute("aria-expanded", "false")
		})

		test("hamburger button opens the mobile slide-out menu", async ({
			page,
		}) => {
			await page.goto("/")

			// Select by aria-expanded: only the hamburger button carries this attribute.
			// The label toggles between "Open/Close navigation menu" on click, so
			// an exact-name locator would stop resolving after the first click.
			const hamburger = page.locator("button[aria-expanded]")
			await expect(hamburger).toHaveAttribute("aria-expanded", "false")
			await hamburger.click()

			await expect(hamburger).toHaveAttribute("aria-expanded", "true")
			await expect(
				page.locator('nav[aria-label="Mobile primary"]'),
			).toBeInViewport()
		})

		test("clicking a mobile nav link navigates and closes the menu", async ({
			page,
		}) => {
			await page.goto("/")

			await page.getByRole("button", { name: "Open navigation menu" }).click()

			await page
				.locator('nav[aria-label="Mobile primary"]')
				.getByRole("link", { name: /leaderboard/i })
				.click()

			await expect(page).toHaveURL(/\/leaderboard/)
			await expect(
				page.getByRole("button", { name: "Open navigation menu" }),
			).toHaveAttribute("aria-expanded", "false")
		})

		test("mobile menu is not in viewport when closed", async ({ page }) => {
			await page.goto("/")

			const mobileNav = page.locator('nav[aria-label="Mobile primary"]')
			await expect(mobileNav).not.toBeInViewport()
		})
	})

	test.describe("at 768px tablet viewport", () => {
		test.use({ viewport: { width: 768, height: 1024 } })

		test("desktop nav is visible and hamburger is hidden", async ({ page }) => {
			await page.goto("/")

			await expect(page.locator('nav[aria-label="Primary"]')).toBeVisible()
			await expect(
				page.getByRole("button", { name: /navigation menu/i }),
			).toBeHidden()
		})
	})

	test.describe("at 1024px desktop viewport", () => {
		test.use({ viewport: { width: 1024, height: 768 } })

		test("desktop nav is visible and hamburger is hidden", async ({ page }) => {
			await page.goto("/")

			await expect(page.locator('nav[aria-label="Primary"]')).toBeVisible()
			await expect(
				page.getByRole("button", { name: /navigation menu/i }),
			).toBeHidden()
		})
	})
})
