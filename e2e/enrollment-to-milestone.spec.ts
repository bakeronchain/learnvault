import { expect, test, type Page, type Route } from "@playwright/test"
import { mockHorizonBalances } from "./fixtures/mock-horizon"
import {
	E2E_WALLET_ADDRESS,
	installMockFreighter,
} from "./fixtures/mock-wallet"

async function fulfillJson(route: Route, body: unknown, status = 200) {
	await route.fulfill({
		status,
		contentType: "application/json",
		body: JSON.stringify(body),
	})
}

async function installEnrollmentFlowMocks(page: Page) {
	const state = {
		milestoneReportId: 1,
		milestones: [] as Array<{
			id: number
			scholar_address: string
			course_id: string
			evidence_github: string | null
			evidence_description: string | null
			submitted_at: string
			status: "pending" | "approved"
		}>,
		leaderboardBalance: "80",
		leaderboardCoursesCompleted: 1,
	}

	await page.addInitScript(() => {
		localStorage.setItem("authToken", "admin-review-token")
		localStorage.setItem("auth_token", "admin-review-token")
	})

	await page.route("**/api/**", async (route) => {
		const request = route.request()
		const url = new URL(request.url())
		const { pathname, searchParams } = url
		const method = request.method()

		if (pathname === "/api/courses" && method === "GET") {
			return fulfillJson(route, {
				data: [
					{
						id: 1,
						slug: "stellar-basics",
						title: "Stellar Basics",
						description: "Start with wallets, signatures, and Soroban flow.",
						track: "stellar",
						difficulty: "beginner",
						published: true,
						created_at: "2026-05-01T00:00:00.000Z",
						updated_at: "2026-05-01T00:00:00.000Z",
					},
				],
			})
		}

		if (pathname === "/api/courses/stellar-basics" && method === "GET") {
			return fulfillJson(route, {
				id: 1,
				slug: "stellar-basics",
				title: "Stellar Basics",
				description: "Start with wallets, signatures, and Soroban flow.",
				track: "stellar",
				difficulty: "beginner",
				published: true,
				lessons: [
					{
						id: 1,
						title: "Connect your wallet",
						content: "Lesson one content",
						order: 1,
						is_milestone: false,
					},
					{
						id: 2,
						title: "Navigate smart contract lessons",
						content: "Lesson two content",
						order: 2,
						is_milestone: false,
					},
					{
						id: 3,
						title: "Submit milestone evidence",
						content: "Lesson three content",
						order: 3,
						is_milestone: true,
					},
				],
			})
		}

		if (pathname === "/api/milestones" && method === "POST") {
			const body = request.postDataJSON() as {
				courseId?: string
				milestoneId?: string
				evidenceGithub?: string
				evidenceDescription?: string
			}
			const submitted = {
				id: state.milestoneReportId,
				scholar_address: E2E_WALLET_ADDRESS,
				course_id: body.courseId ?? "stellar-basics",
				evidence_github: body.evidenceGithub || null,
				evidence_description: body.evidenceDescription || null,
				submitted_at: new Date().toISOString(),
				status: "pending" as const,
			}
			state.milestones = [submitted]
			return fulfillJson(route, { data: submitted }, 201)
		}

		if (pathname === "/api/admin/stats" && method === "GET") {
			return fulfillJson(route, {
				pending_milestones: state.milestones.filter(
					(item) => item.status === "pending",
				).length,
				approved_milestones_today: state.milestones.filter(
					(item) => item.status === "approved",
				).length,
				rejected_milestones_today: 0,
				total_scholars: 1,
				total_lrn_minted: state.leaderboardBalance,
				open_proposals: 0,
				treasury_balance_usdc: "0",
				admin_api_key: {
					source: "env",
					rotatedAt: "2026-05-01T00:00:00.000Z",
					daysSinceRotation: 26,
					stale: false,
					transitionWindowEndsAt: null,
				},
			})
		}

		if (pathname === "/api/admin/milestones" && method === "GET") {
			const pageNum = Number(searchParams.get("page") ?? "1")
			const pageSize = Number(searchParams.get("pageSize") ?? "10")
			const start = (pageNum - 1) * pageSize
			const data = state.milestones.slice(start, start + pageSize)
			return fulfillJson(route, {
				data,
				total: state.milestones.length,
				page: pageNum,
				pageSize,
			})
		}

		if (pathname === "/api/admin/milestones/1/approve" && method === "POST") {
			state.milestones = state.milestones.map((item) => ({
				...item,
				status: "approved" as const,
			}))
			state.leaderboardBalance = "500"
			state.leaderboardCoursesCompleted = 3

			return fulfillJson(route, {
				data: {
					reportId: 1,
					status: "approved",
					contractTxHash: "approve-tx-1",
				},
			})
		}

		if (pathname === "/api/scholars/leaderboard" && method === "GET") {
			return fulfillJson(route, {
				rankings: [
					{
						rank: 1,
						address: E2E_WALLET_ADDRESS,
						lrn_balance: state.leaderboardBalance,
						courses_completed: state.leaderboardCoursesCompleted,
					},
					{
						rank: 2,
						address: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBYH6",
						lrn_balance: "120",
						courses_completed: 2,
					},
				],
				your_rank: 1,
			})
		}

		if (pathname === "/api/me" && method === "GET") {
			return fulfillJson(route, { address: E2E_WALLET_ADDRESS })
		}

		return route.continue()
	})
}

test.describe("Enrollment to milestone approval", () => {
	test.beforeEach(async ({ page }) => {
		await installMockFreighter(page)
		await mockHorizonBalances(page)
		await installEnrollmentFlowMocks(page)
	})

	test("covers wallet connection, course flow, milestone submission, admin approval, and reputation update", async ({
		page,
	}) => {
		await page.goto("/courses")
		await expect(
			page.getByRole("heading", {
				name: "Choose a path and start with a focused first lesson.",
			}),
		).toBeVisible()
		await expect(page.getByText("Stellar Basics")).toBeVisible()

		await page.goto("/learn")
		await page.getByTestId("enroll-course").click()
		await expect(
			page.getByRole("button", { name: /Mark as Complete/i }).first(),
		).toBeVisible()

		await page.goto("/courses/stellar-basics/lessons/1")
		await expect(
			page.getByRole("heading", { name: "Connect your wallet" }),
		).toBeVisible()
		await page.getByRole("button", { name: "Mark as Complete" }).click()
		await page.getByRole("link", { name: /Next Lesson/i }).click()

		await expect(
			page.getByRole("heading", { name: "Navigate smart contract lessons" }),
		).toBeVisible()
		await page.getByRole("button", { name: "Mark as Complete" }).click()
		await page.getByRole("link", { name: /Next Lesson/i }).click()

		await expect(
			page.getByRole("heading", { name: "Submit milestone evidence" }),
		).toBeVisible()
		await page
			.getByPlaceholder("https://github.com/your-username/your-repo")
			.fill("https://github.com/learnvault/stellar-basics-milestone")
		await page
			.getByPlaceholder("Briefly describe what you built or achieved...")
			.fill("Completed the wallet setup flow and milestone proof.")
		await page.getByRole("button", { name: "Submit Milestone" }).click()
		await expect(page.getByText("Submission Received")).toBeVisible()

		await page.goto("/admin")
		await page.getByRole("button", { name: "Milestones" }).click()
		await expect(page.getByText("stellar-basics")).toBeVisible()
		await page.getByRole("button", { name: "Approve" }).click()
		await page.getByRole("button", { name: "Confirm Approval" }).click()
		await expect(page.getByText("approved")).toBeVisible()

		await page.goto("/leaderboard")
		await expect(page.getByText("500")).toBeVisible()
		await expect(page.getByText("Top Scholar")).toBeVisible()
		await expect(page.getByText("You")).toBeVisible()
	})
})
