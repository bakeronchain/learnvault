import { expect, test } from "@playwright/test"
import { installMockFreighter } from "./fixtures/mock-wallet"
import { mockHorizonBalances } from "./fixtures/mock-horizon"

test.describe("Offline mode", () => {
	test("App shell loads with network fully disabled", async ({ page }) => {
		// First load online to let the SW register and precache
		await installMockFreighter(page)
		await mockHorizonBalances(page)

		// Intercept API calls that the homepage might make
		await page.route("**/api/**", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ data: [] }),
		}))

		await page.goto("/")
		await page.waitForLoadState("networkidle")

		// Wait for the service worker to be active
		await page.waitForFunction(() => {
			return navigator.serviceWorker?.controller !== null
		}, { timeout: 15000 })

		// Go fully offline
		await page.context().setOffline(true)

		// Reload — the SW should serve the app shell from cache
		await page.reload({ waitUntil: "domcontentloaded" })

		// The page should load (app shell from SW cache)
		await expect(page.locator("body")).toBeVisible()

		// Restore online state for cleanup
		await page.context().setOffline(false)
	})

	test("Tracks page renders with download controls", async ({ page }) => {
		await installMockFreighter(page)
		await mockHorizonBalances(page)

		// Mock the courses API
		await page.route("**/api/courses", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: [
					{
						id: 1,
						slug: "web3-fundamentals",
						title: "Web3 Fundamentals",
						description: "Learn the basics of Web3",
						track: "web3",
						difficulty: "beginner",
						published: true,
						created_at: "2026-01-01T00:00:00Z",
						updated_at: "2026-01-01T00:00:00Z",
					},
					{
						id: 2,
						slug: "defi-protocols",
						title: "DeFi Protocols",
						description: "Learn about DeFi",
						track: "defi",
						difficulty: "intermediate",
						published: true,
						created_at: "2026-01-01T00:00:00Z",
						updated_at: "2026-01-01T00:00:00Z",
					},
				],
			}),
		}))

		// Mock enrolled courses
		await page.route("**/api/courses/enrolled", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify([]),
		}))

		await page.goto("/tracks")
		await page.waitForLoadState("networkidle")

		// Should show the skill tracks heading
		await expect(page.getByRole("heading", { name: "Skill Tracks" })).toBeVisible()

		// Should show download buttons on track cards
		const downloadButtons = page.getByRole("button", { name: /Download/i })
		const count = await downloadButtons.count()
		expect(count).toBeGreaterThanOrEqual(1)
	})

	test("Download button shows confirmation dialog", async ({ page }) => {
		await installMockFreighter(page)
		await mockHorizonBalances(page)

		await page.route("**/api/courses", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: [
					{
						id: 1,
						slug: "web3-fundamentals",
						title: "Web3 Fundamentals",
						description: "Learn the basics of Web3",
						track: "web3",
						difficulty: "beginner",
						published: true,
						created_at: "2026-01-01T00:00:00Z",
						updated_at: "2026-01-01T00:00:00Z",
					},
				],
			}),
		}))

		await page.route("**/api/courses/enrolled", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify([]),
		}))

		await page.goto("/tracks")
		await page.waitForLoadState("networkidle")

		// Click a download button
		const downloadBtn = page.getByRole("button", { name: /Download/i }).first()
		await downloadBtn.click()

		// Should show confirmation dialog
		await expect(page.getByText(/Download.*course.*for offline/i)).toBeVisible()
		await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible()
		await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible()
	})

	test("Download buttons disabled when offline", async ({ page }) => {
		await installMockFreighter(page)
		await mockHorizonBalances(page)

		await page.route("**/api/courses", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: [
					{
						id: 1,
						slug: "web3-fundamentals",
						title: "Web3 Fundamentals",
						description: "Learn the basics of Web3",
						track: "web3",
						difficulty: "beginner",
						published: true,
						created_at: "2026-01-01T00:00:00Z",
						updated_at: "2026-01-01T00:00:00Z",
					},
				],
			}),
		}))

		await page.route("**/api/courses/enrolled", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify([]),
		}))

		await page.goto("/tracks")
		await page.waitForLoadState("networkidle")

		// Go offline
		await page.context().setOffline(true)

		// Download buttons should be disabled
		const downloadBtn = page.getByRole("button", { name: /Download/i }).first()
		await expect(downloadBtn).toBeDisabled()

		await page.context().setOffline(false)
	})
})
