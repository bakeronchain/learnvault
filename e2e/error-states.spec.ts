import { expect, test } from "@playwright/test"

import { mockHorizonBalances } from "./fixtures/mock-horizon"
import { installMockFreighter } from "./fixtures/mock-wallet"

test.describe("Error states and recovery", () => {
	test.beforeEach(async ({ page }) => {
		await installMockFreighter(page)
		await mockHorizonBalances(page)
	})

	test("404 route, missing course error boundary, and back/home recovery", async ({
		page,
	}) => {
		// 1–2: Unknown path shows static 404 page
		await page.goto("/this-does-not-exist")
		await expect(page.getByTestId("not-found-page")).toBeVisible()
		await expect(page.getByRole("heading", { name: "404" })).toBeVisible()
		await expect(
			page.getByText(/This page doesn't exist/i),
		).toBeVisible()

		// 5 (partial): Go Home from 404
		await page.getByTestId("not-found-go-home").click()
		await expect(page).toHaveURL("/")
		await expect(
			page.getByRole("heading", {
				name: /Learning is the proof of work/i,
			}),
		).toBeVisible()

		// 5 (partial): Go back from 404 — land on a known page first
		await page.goto("/courses")
		await expect(
			page.getByRole("heading", { name: /Choose a path/i }),
		).toBeVisible()
		await page.goto("/also-does-not-exist-e2e")
		await expect(page.getByTestId("not-found-page")).toBeVisible()
		await page.getByTestId("not-found-go-back").click()
		await expect(page).toHaveURL("/courses")

		// 3–4: Unknown course / lesson triggers the route ErrorBoundary
		await page.goto("/courses/definitely-missing-course-slug-e2e/lessons/1")
		await expect(page.getByTestId("error-boundary")).toBeVisible({
			timeout: 60_000,
		})
		await expect(
			page.getByRole("heading", { name: /Something went wrong/i }),
		).toBeVisible()

		// 5: Recovery from error boundary
		await page.getByTestId("error-boundary-go-home").click()
		await expect(page).toHaveURL("/")
		await expect(
			page.getByRole("heading", {
				name: /Learning is the proof of work/i,
			}),
		).toBeVisible()

		await page.goto("/courses")
		await expect(
			page.getByRole("heading", { name: /Choose a path/i }),
		).toBeVisible()
		await page.goto("/courses/another-missing-slug-e2e/lessons/1")
		await expect(page.getByTestId("error-boundary")).toBeVisible({
			timeout: 60_000,
		})
		await page.getByTestId("error-boundary-go-back").click()
		await expect(page).toHaveURL("/courses")
	})
})
