import { expect, test, type Page, type Route } from "@playwright/test"
import { mockHorizonBalances } from "./fixtures/mock-horizon"
import {
	E2E_WALLET_ADDRESS,
	installMockFreighter,
} from "./fixtures/mock-wallet"

type MockLeaderboardEntry = {
	rank: number
	address: string
	lrn_balance: string
	courses_completed: number
}

function buildAddress(index: number) {
	return `GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA${String(index).padStart(2, "0")}`
}

function buildRankings(total: number): MockLeaderboardEntry[] {
	return Array.from({ length: total }, (_, index) => ({
		rank: index + 1,
		address: buildAddress(index + 1),
		lrn_balance: String(5000 - index * 50),
		courses_completed: 24 - (index % 8),
	}))
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
	await route.fulfill({
		status,
		contentType: "application/json",
		body: JSON.stringify(body),
	})
}

async function installLeaderboardMocks(page: Page) {
	const rankings = buildRankings(13)
	const yourRank =
		rankings.find((entry) => entry.address === E2E_WALLET_ADDRESS)?.rank ?? 7

	await page.route("**/api/scholars/leaderboard**", async (route) => {
		const url = new URL(route.request().url())
		const pageParam = Number(url.searchParams.get("page") ?? "1")
		const limitParam = Number(url.searchParams.get("limit") ?? "10")
		const start = (pageParam - 1) * limitParam
		const end = start + limitParam

		return fulfillJson(route, {
			rankings: rankings.slice(start, end),
			total: rankings.length,
			your_rank: yourRank,
		})
	})
}

async function ensureWalletConnected(page: Page) {
	const connectedRank = page.getByTestId("leaderboard-your-rank")
	if ((await connectedRank.count()) > 0) return

	await page.evaluate(
		({ address }) => {
			const networkPassphrase = "Test SDF Network ; September 2015"
			localStorage.setItem("walletId", JSON.stringify("hot-wallet"))
			localStorage.setItem("walletType", JSON.stringify("hot-wallet"))
			localStorage.setItem("walletAddress", JSON.stringify(address))
			localStorage.setItem("walletNetwork", JSON.stringify("TESTNET"))
			localStorage.setItem(
				"networkPassphrase",
				JSON.stringify(networkPassphrase),
			)
		},
		{ address: E2E_WALLET_ADDRESS },
	)

	await page.reload()
}

test.describe("Leaderboard page", () => {
	test.beforeEach(async ({ page }) => {
		await installMockFreighter(page)
		await mockHorizonBalances(page)
		await installLeaderboardMocks(page)
	})

	test("displays ranked scholars, own rank, pagination, and truncated addresses", async ({
		page,
	}) => {
		await page.goto("/leaderboard")
		await ensureWalletConnected(page)

		await expect(
			page.getByRole("heading", { name: /leaderboard/i }),
		).toBeVisible()

		const rows = page.getByTestId("leaderboard-row")
		await expect(rows).toHaveCount(10)
		await expect(rows.first().getByTestId("leaderboard-rank-badge")).toHaveText(
			"1",
		)

		await expect(page.getByTestId("leaderboard-your-rank")).toContainText(
			"Your rank: #7",
		)

		const firstAddress = rows.first().getByTestId("leaderboard-address")
		await expect(firstAddress).toContainText("...")

		await expect(page.getByTestId("leaderboard-page-indicator")).toHaveText(
			"Page 1 of 2",
		)
		await page.getByTestId("leaderboard-next-page").click()
		await expect(page.getByTestId("leaderboard-page-indicator")).toHaveText(
			"Page 2 of 2",
		)
		await expect(rows).toHaveCount(3)
		await expect(rows.first().getByTestId("leaderboard-rank-badge")).toHaveText(
			"11",
		)
	})
})
