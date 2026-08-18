import { expect, test, type Page, type Route } from "@playwright/test"
import { mockHorizonBalances } from "./fixtures/mock-horizon"
import {
	E2E_WALLET_ADDRESS,
	installMockFreighter,
} from "./fixtures/mock-wallet"

const E2E_COURSE_SLUG = "course-1"
const E2E_COURSE_TITLE = "Stellar Smart Contracts 101"

type MockEnrollmentRecord = {
	course_id: string
	enrollment_id?: number
	tx_hash?: string
}

type MockCourse = {
	id: string
	title: string
	description: string
	instructor_address: string
	milestones_count: number
	created_at: string
	updated_at: string
	max_learners: number | null
}

type MockMilestone = {
	id: string
	course_id: string
	title: string
	description: string
	evidence_guide: string
	position: number
}

type MockMilestoneReport = {
	id: string
	learner_address: string
	course_id: string
	milestone_id: string
	evidence_uri: string
	status: "pending" | "approved" | "rejected"
	submitted_at: string
	reviewed_at: string | null
	reviewer_address: string | null
	comments: string | null
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
	await route.fulfill({
		status,
		contentType: "application/json",
		body: JSON.stringify(body),
	})
}

async function disableServiceWorkerForMocks(page: Page) {
	await page.addInitScript(() => {
		if (!("serviceWorker" in navigator)) return

		navigator.serviceWorker.register = (() =>
			Promise.reject(
				new Error("Service worker disabled in enrollment E2E"),
			)) as typeof navigator.serviceWorker.register

		void navigator.serviceWorker.getRegistrations().then((registrations) => {
			for (const registration of registrations) {
				void registration.unregister()
			}
		})
	})
}

async function installEnrollmentMocks(
	page: Page,
	options: { initialEnrollments?: MockEnrollmentRecord[] } = {},
) {
	const mockCourse: MockCourse = {
		id: E2E_COURSE_SLUG,
		title: E2E_COURSE_TITLE,
		description: "Learn to build on Stellar",
		instructor_address: "GATEACHER123TEACHERTEACHERTEACHERTEACHE123",
		milestones_count: 3,
		created_at: "2026-01-01T00:00:00.000Z",
		updated_at: "2026-01-01T00:00:00.000Z",
		max_learners: null,
	}

	const mockCourseDetail = {
		id: 1,
		slug: E2E_COURSE_SLUG,
		title: E2E_COURSE_TITLE,
		description: mockCourse.description,
		track: "stellar",
		difficulty: "beginner",
		published: true,
		created_at: mockCourse.created_at,
		updated_at: mockCourse.updated_at,
		lessons: [
			{
				id: 1,
				title: "Setup Stellar Development Environment",
				content_markdown: "# Setup\n\nInstall the Stellar CLI.",
				order: 1,
				is_milestone: true,
				estimated_minutes: 20,
			},
			{
				id: 2,
				title: "Deploy First Smart Contract",
				content_markdown: "# Deploy\n\nDeploy your first contract.",
				order: 2,
				is_milestone: true,
				estimated_minutes: 30,
			},
			{
				id: 3,
				title: "Interact with Contract",
				content_markdown: "# Interact\n\nCall your contract.",
				order: 3,
				is_milestone: true,
				estimated_minutes: 25,
			},
		],
	}

	const mockMilestones: MockMilestone[] = [
		{
			id: "milestone-1",
			course_id: E2E_COURSE_SLUG,
			title: "Setup Stellar Development Environment",
			description: "Set up your local Stellar development environment",
			evidence_guide: "Screenshot of stellar/quickstart running",
			position: 1,
		},
		{
			id: "milestone-2",
			course_id: E2E_COURSE_SLUG,
			title: "Deploy First Smart Contract",
			description: "Deploy a simple Hello World contract",
			evidence_guide: "Transaction ID of contract deployment",
			position: 2,
		},
		{
			id: "milestone-3",
			course_id: E2E_COURSE_SLUG,
			title: "Interact with Contract",
			description: "Call your deployed contract",
			evidence_guide: "Screenshot of successful function call",
			position: 3,
		},
	]

	let persistedEnrollments: MockEnrollmentRecord[] = [
		...(options.initialEnrollments ?? []),
	]
	let milestoneReports: MockMilestoneReport[] = []
	let lrnBalance = 0
	let leaderboardRank = 1000

	await page.addInitScript(() => {
		localStorage.setItem("authToken", "e2e-enrollment-token")
		localStorage.setItem("refreshToken", "e2e-enrollment-refresh")
	})

	await page.route("**/api/**", async (route) => {
		const request = route.request()
		const url = new URL(request.url())
		const { pathname } = url
		const method = request.method()

		if (pathname === "/api/courses" && method === "GET") {
			return fulfillJson(route, {
				data: [
					{
						id: 1,
						slug: E2E_COURSE_SLUG,
						title: E2E_COURSE_TITLE,
						description: mockCourse.description,
						track: "stellar",
						difficulty: "beginner",
						published: true,
						created_at: mockCourse.created_at,
						updated_at: mockCourse.updated_at,
					},
				],
			})
		}

		if (
			pathname.match(/^\/api\/courses\/[^/]+$/) &&
			method === "GET" &&
			!pathname.endsWith("/enrolled")
		) {
			return fulfillJson(route, mockCourseDetail)
		}

		if (
			pathname.match(/^\/api\/courses\/[^/]+\/milestones$/) &&
			method === "GET"
		) {
			return fulfillJson(route, mockMilestones)
		}

		if (pathname === "/api/enrollments" && method === "GET") {
			return fulfillJson(route, { data: persistedEnrollments })
		}

		if (pathname === "/api/enrollments" && method === "POST") {
			const body = (await request.postDataJSON()) as {
				course_id: string
				tx_hash?: string
			}
			const enrollmentId = Date.now()
			persistedEnrollments = [
				...persistedEnrollments.filter(
					(entry) => entry.course_id !== body.course_id,
				),
				{
					course_id: body.course_id,
					enrollment_id: enrollmentId,
					tx_hash: body.tx_hash,
				},
			]
			return fulfillJson(
				route,
				{
					enrollment_id: enrollmentId,
					enrolled_at: new Date().toISOISOString(),
				},
				201,
			)
		}

		// POST /api/milestone-reports - submit milestone evidence
		if (pathname === "/api/milestone-reports" && method === "POST") {
			const body = await request.postDataJSON()
			const report: MockMilestoneReport = {
				id: `report-${Date.now()}`,
				learner_address: E2E_WALLET_ADDRESS,
				course_id: body.course_id,
				milestone_id: body.milestone_id,
				evidence_uri:
					body.evidence_uri || `ipfs://QmHashFor${body.milestone_id}`,
				status: "pending",
				submitted_at: new Date().toISOString(),
				reviewed_at: null,
				reviewer_address: null,
				comments: null,
			}
			milestoneReports.push(report)
			return fulfillJson(route, { report }, 201)
		}

		// GET /api/milestone-reports/:id - get report details
		if (
			pathname.match(/^\/api\/milestone-reports\/[^/]+$/) &&
			method === "GET"
		) {
			const reportId = pathname.split("/").pop()
			const report = milestoneReports.find((r) => r.id === reportId)
			if (!report) return fulfillJson(route, {}, 404)
			return fulfillJson(route, { report })
		}

		// POST /api/admin/milestone-reports/:id/approve - admin approves milestone
		if (
			pathname.match(/^\/api\/admin\/milestone-reports\/[^/]+\/approve$/) &&
			method === "POST"
		) {
			const reportId = pathname.split("/")[4]
			const report = milestoneReports.find((r) => r.id === reportId)
			if (!report) return fulfillJson(route, {}, 404)

			report.status = "approved"
			report.reviewed_at = new Date().toISOString()
			report.reviewer_address = "GAADMIN456ADMINADMINADMINADMINADMINADMIN456"

			// Award LRN tokens (100 per milestone)
			lrnBalance += 100

			return fulfillJson(route, { report })
		}

		// GET /api/scholars/leaderboard - get leaderboard rankings
		if (pathname === "/api/scholars/leaderboard" && method === "GET") {
			const yourRank = lrnBalance > 0 ? leaderboardRank : null
			return fulfillJson(route, {
				rankings: [
					{
						rank: 1,
						address: "GATOP1111111111111111111111111111111111111",
						lrn_balance: "5000",
						courses_completed: 5,
					},
					{
						rank: 2,
						address: "GATOP2222222222222222222222222222222222222",
						lrn_balance: "4500",
						courses_completed: 4,
					},
					{
						rank: 3,
						address: "GATOP3333333333333333333333333333333333333",
						lrn_balance: "4000",
						courses_completed: 4,
					},
					{
						rank: 4,
						address: "GATOP4444444444444444444444444444444444444",
						lrn_balance: "3500",
						courses_completed: 3,
					},
					{
						rank: 5,
						address: "GATOP5555555555555555555555555555555555555",
						lrn_balance: "3000",
						courses_completed: 3,
					},
					{
						rank: 6,
						address: "GATOP6666666666666666666666666666666666666",
						lrn_balance: "2500",
						courses_completed: 2,
					},
					{
						rank: 7,
						address: "GATOP7777777777777777777777777777777777777",
						lrn_balance: "2000",
						courses_completed: 2,
					},
					{
						rank: 8,
						address: "GATOP8888888888888888888888888888888888888",
						lrn_balance: "1500",
						courses_completed: 1,
					},
					{
						rank: 9,
						address: "GATOP9999999999999999999999999999999999999",
						lrn_balance: "1000",
						courses_completed: 1,
					},
					{
						rank: 10,
						address: E2E_WALLET_ADDRESS,
						lrn_balance: String(lrnBalance),
						courses_completed: lrnBalance > 0 ? 1 : 0,
					},
				],
				total: 1000,
				your_rank: yourRank,
			})
		}

		// GET /api/me - get current user profile
		if (pathname === "/api/me" && method === "GET") {
			return fulfillJson(route, {
				address: E2E_WALLET_ADDRESS,
				lrn_balance: String(lrnBalance),
				reputation_rank: yourRank,
				courses_enrolled: persistedEnrollments.length,
				courses_completed: lrnBalance > 0 ? 1 : 0,
			})
		}

		return route.continue()
	})
}

test.describe("Enrollment to Milestone E2E Flow", () => {
	test.beforeEach(async ({ page }) => {
		await installMockFreighter(page)
		await mockHorizonBalances(page)
		await disableServiceWorkerForMocks(page)
	})

	test("blocks direct lesson access until enrollment is persisted", async ({
		page,
	}) => {
		await installEnrollmentMocks(page)
		await page.goto(`/courses/${E2E_COURSE_SLUG}/lessons/1`)
		await page.waitForLoadState("networkidle")

		await expect(
			page.getByRole("heading", { name: /Enrollment Required/i }),
		).toBeVisible()
		await expect(
			page.getByRole("button", { name: /Enroll Now/i }),
		).toBeVisible()
		await expect(page.getByText(/Install the Stellar CLI/i)).toHaveCount(0)
	})

	test.describe("with persisted enrollment", () => {
		test.beforeEach(async ({ page }) => {
			await installEnrollmentMocks(page, {
				initialEnrollments: [
					{
						course_id: E2E_COURSE_SLUG,
						enrollment_id: 1,
						tx_hash: "persisted-enrollment-hash",
					},
				],
			})
		})

		test("shows lesson content after persisted enrollment survives reload", async ({
			page,
		}) => {
			await page.goto(`/courses/${E2E_COURSE_SLUG}/lessons/1`)
			await page.waitForLoadState("networkidle")

			await expect(
				page.getByRole("heading", {
					name: /Setup Stellar Development Environment/i,
				}),
			).toBeVisible()
			await expect(page.getByText(/Install the Stellar CLI/i)).toBeVisible()

			await page.reload()
			await page.waitForLoadState("networkidle")

			await expect(
				page.getByRole("heading", {
					name: /Setup Stellar Development Environment/i,
				}),
			).toBeVisible()
		})

		test("should complete full enrollment and milestone approval flow", async ({
			page,
		}) => {
			await page.goto(`/courses/${E2E_COURSE_SLUG}/lessons/1`)
			await page.waitForLoadState("networkidle")

			await expect(
				page.getByRole("heading", {
					name: /Setup Stellar Development Environment/i,
				}),
			).toBeVisible()

			await page.reload()
			await page.waitForLoadState("networkidle")
			await expect(page.getByText(/Install the Stellar CLI/i)).toBeVisible()

			// Navigate through lessons/milestones
			const milestone1 = page.locator(
				'text="Setup Stellar Development Environment"',
			)
			await expect(milestone1).toBeVisible()

			await milestone1.click()
			await page.waitForLoadState("networkidle")

			// Step 6: Submit milestone evidence
			const submitButton = page.locator('button:has-text("Submit Evidence")')
			await expect(submitButton).toBeVisible()

			const evidenceInput = page.locator(
				'textarea[placeholder*="evidence"], input[placeholder*="evidence"]',
			)
			await evidenceInput.fill("https://example.com/screenshot.png")

			await submitButton.click()

			// Confirm submission
			const confirmSubmitButton = page.locator('button:has-text("Confirm")')
			await confirmSubmitButton.click()

			await page.waitForLoadState("networkidle")

			// Verify submission success
			await expect(page.locator("text=Evidence submitted")).toBeVisible({
				timeout: 5000,
			})
			await expect(page.locator("text=Pending Review")).toBeVisible()

			// Step 7: Switch to admin wallet to approve milestone
			// Store original address
			const learnerAddress = E2E_WALLET_ADDRESS

			// Switch to admin wallet (simulated by updating localStorage)
			await page.evaluate(() => {
				localStorage.setItem(
					"admin_wallet",
					"GAADMIN456ADMINADMINADMINADMINADMINADMIN456",
				)
			})

			// Navigate to admin dashboard
			await page.goto("/admin/milestone-reports")
			await page.waitForLoadState("networkidle")

			// Find the submitted milestone report
			const milestoneReport = page.locator(
				`text=${learnerAddress.substring(0, 10)}`,
			)
			await expect(milestoneReport).toBeVisible()

			// Approve the milestone
			const approveButton = page.locator('button:has-text("Approve")').first()
			await approveButton.click()

			// Confirm approval
			const confirmApprovalButton = page.locator('button:has-text("Confirm")')
			await confirmApprovalButton.click()

			await page.waitForLoadState("networkidle")

			// Verify approval success
			await expect(page.locator("text=Milestone approved")).toBeVisible({
				timeout: 5000,
			})

			// Step 8: Switch back to learner wallet
			await page.evaluate(() => {
				localStorage.setItem("admin_wallet", "")
			})

			// Step 9: Verify LRN balance increased
			await page.goto("/me")
			await page.waitForLoadState("networkidle")

			const lrnBalance = page
				.locator('text="LRN Balance"')
				.locator("..")
				.locator("text=/[0-9]+/")
			await expect(lrnBalance).toContainText(/100|LRN/)

			// Step 10: Verify reputation rank updated
			await page.goto("/leaderboard")
			await page.waitForLoadState("networkidle")

			// Verify learner appears in leaderboard
			const learnerInLeaderboard = page.locator('text="You"')
			await expect(learnerInLeaderboard).toBeVisible()

			// Verify rank is displayed
			const rankBadge = page.locator('[data-testid="leaderboard-rank-badge"]')
			await expect(rankBadge).toBeVisible()

			// Verify LRN balance in leaderboard
			const leaderboardBalance = page.locator('text="100"')
			await expect(leaderboardBalance).toBeVisible()
		})

		test("should handle multiple milestone submissions and approvals", async ({
			page,
		}) => {
			await page.goto(`/courses/${E2E_COURSE_SLUG}/lessons/1`)
			await page.waitForLoadState("networkidle")

			await expect(
				page.getByRole("heading", {
					name: /Setup Stellar Development Environment/i,
				}),
			).toBeVisible()

			const milestones = page.locator('[data-testid="milestone-item"]')
			const count = await milestones.count()

			for (let i = 0; i < Math.min(count, 2); i++) {
				const milestone = milestones.nth(i)
				await milestone.click()

				const submitButton = page.locator('button:has-text("Submit Evidence")')
				const evidence = page.locator('textarea[placeholder*="evidence"]')

				await evidence.fill(`Evidence for milestone ${i + 1}`)
				await submitButton.click()
				await page.locator('button:has-text("Confirm")').click()

				await page.waitForLoadState("networkidle")
			}

			const pendingIndicators = page.locator('text="Pending Review"')
			expect(await pendingIndicators.count()).toBeGreaterThanOrEqual(2)
		})
	})
})
