import { expect, test, type Page, type Route } from "@playwright/test"

import { mockHorizonBalances } from "./fixtures/mock-horizon"
import {
	installMockFreighter,
	E2E_WALLET_ADDRESS,
} from "./fixtures/mock-wallet"

type MockProposal = {
	id: number
	author_address: string
	title: string
	description: string
	amount: string
	votes_for: string
	votes_against: string
	status: "pending" | "approved" | "rejected"
	deadline: string | null
	created_at: string
	user_vote_support: boolean | null
}

type MockComment = {
	id: number
	proposal_id: string
	author_address: string
	parent_id: number | null
	content: string
	upvotes: number
	downvotes: number
	is_pinned: boolean
	created_at: string
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
	await route.fulfill({
		status,
		contentType: "application/json",
		body: JSON.stringify(body),
	})
}

async function installDaoApiMocks(page: Page) {
	let nextProposalId = 2
	const proposals: MockProposal[] = [
		{
			id: 1,
			author_address: E2E_WALLET_ADDRESS,
			title: "Seed proposal",
			description: "Initial backend-backed proposal",
			amount: "100",
			votes_for: "0",
			votes_against: "0",
			status: "pending",
			deadline: "2099-01-01T00:00:00.000Z",
			created_at: "2026-03-28T10:00:00.000Z",
			user_vote_support: null,
		},
	]

	const commentsByProposal = new Map<number, MockComment[]>([
		[
			1,
			[
				{
					id: 101,
					proposal_id: "1",
					author_address: E2E_WALLET_ADDRESS,
					parent_id: null,
					content: "Backend comment loaded",
					upvotes: 4,
					downvotes: 0,
					is_pinned: false,
					created_at: "2026-03-28T10:05:00.000Z",
				},
			],
		],
	])

	await page.route("**/api/**", async (route) => {
		const request = route.request()
		const url = new URL(request.url())
		const { pathname, searchParams } = url
		const method = request.method()

		if (pathname === "/api/proposals" && method === "GET") {
			const viewer = searchParams.get("viewer_address")
			const response = proposals.map((proposal) => ({
				...proposal,
				user_vote_support:
					viewer?.toLowerCase() === E2E_WALLET_ADDRESS.toLowerCase()
						? proposal.user_vote_support
						: null,
			}))

			return fulfillJson(route, {
				proposals: response,
				total: response.length,
				page: 1,
			})
		}

		if (pathname === "/api/proposals" && method === "POST") {
			const body = request.postDataJSON() as {
				author_address: string
				title: string
				description: string
				requested_amount: string
			}

			const created: MockProposal = {
				id: nextProposalId++,
				author_address: body.author_address,
				title: body.title,
				description: body.description,
				amount: body.requested_amount,
				votes_for: "0",
				votes_against: "0",
				status: "pending",
				deadline: "2099-01-01T00:00:00.000Z",
				created_at: new Date().toISOString(),
				user_vote_support: null,
			}

			proposals.unshift(created)
			commentsByProposal.set(created.id, [
				{
					id: 200 + created.id,
					proposal_id: String(created.id),
					author_address: created.author_address,
					parent_id: null,
					content: "Fresh discussion thread",
					upvotes: 0,
					downvotes: 0,
					is_pinned: false,
					created_at: created.created_at,
				},
			])

			return fulfillJson(route, {
				proposal_id: created.id,
				tx_hash: `tx-${created.id}`,
			})
		}

		if (
			pathname.startsWith("/api/proposals/") &&
			pathname.endsWith("/comments")
		) {
			const proposalId = Number.parseInt(pathname.split("/")[3] ?? "", 10)
			return fulfillJson(route, commentsByProposal.get(proposalId) ?? [])
		}

		if (pathname.startsWith("/api/proposals/") && method === "GET") {
			const proposalId = Number.parseInt(pathname.split("/")[3] ?? "", 10)
			const proposal = proposals.find((item) => item.id === proposalId)

			if (!proposal) {
				return fulfillJson(route, { error: "Not found" }, 404)
			}

			return fulfillJson(route, proposal)
		}

		if (pathname.startsWith("/api/governance/voting-power/")) {
			return fulfillJson(route, { gov_balance: "10" })
		}

		if (pathname === "/api/governance/vote" && method === "POST") {
			const body = request.postDataJSON() as {
				proposal_id: number
				support: boolean
			}
			const proposal = proposals.find((item) => item.id === body.proposal_id)

			if (!proposal) {
				return fulfillJson(route, { error: "Not found" }, 404)
			}

			if (body.support) {
				proposal.votes_for = String(Number(proposal.votes_for) + 10)
			} else {
				proposal.votes_against = String(Number(proposal.votes_against) + 10)
			}
			proposal.user_vote_support = body.support

			return fulfillJson(route, {
				tx_hash: `vote-${proposal.id}`,
				votes_for: proposal.votes_for,
				votes_against: proposal.votes_against,
			})
		}

		return route.continue()
	})
}

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
		await expect(page.getByText("Backend comment loaded")).toBeVisible()
	})
})
