/**
 * CSP + Freighter wallet integration test
 *
 * Verifies that:
 *  1. The app loads without any Content Security Policy violations in the
 *     browser console when the mock Freighter wallet is active.
 *  2. The wallet connects successfully (address appears in the NavBar).
 *  3. Pages that trigger Stellar/Soroban RPC calls do not produce CSP errors.
 *
 * CSP violations appear as browser console "error" messages with the text
 * "Content Security Policy" — this test asserts none of those appear.
 *
 * The mock Freighter fixture (installMockFreighter) injects window.freighterApi
 * exactly as the real extension would (via addInitScript / chrome content
 * script timing).  Because the mock runs in the page context, it exercises the
 * same CSP code-path that would block a real extension content-script injection.
 */

import { expect, test } from "@playwright/test"

import { mockHorizonBalances } from "./fixtures/mock-horizon"
import {
	installMockFreighter,
	E2E_WALLET_ADDRESS,
} from "./fixtures/mock-wallet"

/**
 * Collect CSP violation messages from page console.
 * Returns true if any "Content Security Policy" error was seen.
 */
function collectCspViolations(page: import("@playwright/test").Page): {
	violations: string[]
	listener: (msg: import("@playwright/test").ConsoleMessage) => void
} {
	const violations: string[] = []
	const listener = (msg: import("@playwright/test").ConsoleMessage) => {
		if (
			msg.type() === "error" &&
			msg.text().toLowerCase().includes("content security policy")
		) {
			violations.push(msg.text())
		}
	}
	page.on("console", listener)
	return { violations, listener }
}

test.describe("CSP — no violations with mock Freighter wallet", () => {
	test.beforeEach(async ({ page }) => {
		await installMockFreighter(page)
		await mockHorizonBalances(page)
	})

	test("home page loads with no CSP violations", async ({ page }) => {
		const { violations } = collectCspViolations(page)

		await page.goto("/")
		// Wait for the page to settle so any deferred scripts/fetches can fire
		await page.waitForTimeout(2_000)

		expect(
			violations,
			`CSP violations on home page:\n${violations.join("\n")}`,
		).toEqual([])
	})

	test("wallet address appears in NavBar without CSP violations", async ({
		page,
	}) => {
		const { violations } = collectCspViolations(page)

		await page.goto("/")

		await expect(
			page.locator("text=" + E2E_WALLET_ADDRESS.slice(0, 6)).first(),
		).toBeVisible({ timeout: 15_000 })

		expect(
			violations,
			`CSP violations during wallet connect:\n${violations.join("\n")}`,
		).toEqual([])
	})

	test("profile page loads with no CSP violations", async ({ page }) => {
		const { violations } = collectCspViolations(page)

		await page.goto("/profile")
		await page.waitForTimeout(2_000)

		expect(
			violations,
			`CSP violations on /profile:\n${violations.join("\n")}`,
		).toEqual([])
	})

	test("courses page loads with no CSP violations", async ({ page }) => {
		const { violations } = collectCspViolations(page)

		await page.goto("/courses")
		await page.waitForTimeout(2_000)

		expect(
			violations,
			`CSP violations on /courses:\n${violations.join("\n")}`,
		).toEqual([])
	})

	test("DAO proposals page loads with no CSP violations", async ({ page }) => {
		const { violations } = collectCspViolations(page)

		await page.goto("/dao/proposals")
		await page.waitForTimeout(2_000)

		expect(
			violations,
			`CSP violations on /dao/proposals:\n${violations.join("\n")}`,
		).toEqual([])
	})
})
