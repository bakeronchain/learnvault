import { test, expect } from "@playwright/test"

const BREAKPOINTS = [
	{ name: "375", width: 375, height: 812 },
	{ name: "414", width: 414, height: 896 },
	{ name: "768", width: 768, height: 1024 },
	{ name: "1024", width: 1024, height: 768 },
	{ name: "1440", width: 1440, height: 900 },
] as const

const ROUTES = [
	{ name: "home", path: "/" },
	{ name: "courses", path: "/courses" },
	{ name: "lesson-player", path: "/courses/stellar-basics/lessons/1" },
	{ name: "dashboard", path: "/dashboard" },
	{ name: "scholarship-apply", path: "/scholarships/apply" },
	{ name: "dao", path: "/dao" },
	{ name: "leaderboard", path: "/leaderboard" },
	{ name: "profile", path: "/profile" },
	{ name: "donor", path: "/donor" },
] as const

test.describe("responsive layout audit", () => {
	for (const bp of BREAKPOINTS) {
		test.describe(`viewport ${bp.name}px`, () => {
			for (const route of ROUTES) {
				test(`${route.name} has no horizontal scroll`, async ({ page }) => {
					await page.setViewportSize({ width: bp.width, height: bp.height })
					await page.goto(route.path, { waitUntil: "networkidle" })

					// Some pages lazy load; give layout a beat to settle.
					await page.waitForTimeout(250)

					if (bp.name === "375") {
						await page.screenshot({
							path: `test-results/responsive/${route.name}-${bp.name}.png`,
							fullPage: true,
						})
					}

					const hasHorizontalScroll = await page.evaluate(() => {
						const doc = document.documentElement
						return doc.scrollWidth > doc.clientWidth + 1
					})
					expect(hasHorizontalScroll).toBeFalsy()
				})
			}
		})
	}
})
