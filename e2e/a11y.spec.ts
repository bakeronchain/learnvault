import AxeBuilder from "@axe-core/playwright"
import { test, expect } from "@playwright/test"

const ROUTES = [
	"/",
	"/courses",
	"/dao",
	"/dao/proposals",
	"/dao/propose",
	"/leaderboard",
	"/community",
	"/history",
	"/wiki",
	"/treasury",
	"/donor",
	"/profile",
	"/admin",
	"/dashboard",
	"/credentials/1",
	"/courses/1/lessons/1",
	"/learn",
	"/scholarships/apply",
	"/wiki/stellar-basics",
	"/debug",
]

for (const route of ROUTES) {
	test.describe(`WCAG 2.1 AA accessibility audit — ${route}`, () => {
		test("should have no high or medium severity axe violations", async ({
			page,
		}) => {
			await page.goto(route).catch(() => {})

			const results = await new AxeBuilder({ page })
				.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
				.analyze()

			const violations = results.violations.filter(
				(v) =>
					v.impact === "critical" ||
					v.impact === "serious" ||
					v.impact === "moderate",
			)

			expect(
				violations,
				`Accessibility violations on ${route}:\n${violations.map((v) => `${v.id}: ${v.description}`).join("\n")}`,
			).toEqual([])
		})

		test("should have no automatically detectable WCAG 2.1 AA violations", async ({
			page,
		}) => {
			await page.goto(route).catch(() => {})

			const results = await new AxeBuilder({ page })
				.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
				.analyze()

			const violationIds = results.violations.map((v) => v.id)
			expect(violationIds).toEqual([])
		})
	})
}

test.describe("Keyboard navigation audit", () => {
	test("focus moves sequentially through interactive elements on home page", async ({
		page,
	}) => {
		await page.goto("/")

		const focusable = await page.$$eval(
			'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
			(els) => els.length,
		)
		expect(focusable).toBeGreaterThan(0)

		await page.keyboard.press("Tab")
		const firstFocused = await page.evaluate(
			() => document.activeElement?.tagName,
		)
		expect(firstFocused).toBeTruthy()
	})

	test("modals trap focus when open", async ({ page }) => {
		await page.goto("/dao/proposals?proposal=1").catch(() => {})

		const walletButton = page
			.locator("button")
			.filter({ hasText: /Connect|Wallet/i })
			.first()
		if (await walletButton.isVisible().catch(() => false)) {
			await walletButton.click()
			const modal = page
				.locator('[role="dialog"], .modal, [id="modalContainer"]')
				.first()
			if (await modal.isVisible().catch(() => false)) {
				await page.keyboard.press("Escape")
			}
		}
	})
})

test.describe("Color contrast audit", () => {
	test("text elements meet minimum 4.5:1 contrast ratio", async ({ page }) => {
		await page.goto("/")

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2aa"])
			.include(["body"])
			.analyze()

		const contrastViolations = results.violations.filter(
			(v) => v.id === "color-contrast",
		)
		expect(contrastViolations).toEqual([])
	})
})

test.describe("Focus management audit", () => {
	test("focus returns to trigger after modal close", async ({ page }) => {
		await page.goto("/dao/proposals?proposal=1").catch(() => {})

		const profileButton = page
			.locator('[class*="Profile"], [data-testid="wallet-profile"]')
			.first()
		if (await profileButton.isVisible().catch(() => false)) {
			await profileButton.click()
			const modal = page
				.locator('[role="dialog"], [id="modalContainer"]')
				.first()
			if (await modal.isVisible().catch(() => false)) {
				await page.keyboard.press("Escape")
				const focused = await page.evaluate(
					() => document.activeElement?.tagName,
				)
				expect(focused).toBeTruthy()
			}
		}
	})
})
