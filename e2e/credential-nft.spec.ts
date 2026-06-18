/**
 * Credential NFT E2E
 *
 * Scenario:
 *  1. Scholar completes all milestones in a scholarship program
 *  2. Admin triggers NFT mint
 *  3. Verify NFT appears in scholar profile
 *  4. Navigate to credential verification page
 *  5. Verify credential details match
 *  6. Copy share link and verify it resolves
 */

import { expect, test, type Page, type Route } from "@playwright/test"

import { mockHorizonBalances } from "./fixtures/mock-horizon"
import {
	installMockFreighter,
	E2E_WALLET_ADDRESS,
} from "./fixtures/mock-wallet"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MilestoneStatus = "not_started" | "pending" | "approved"

type Milestone = {
	id: number
	title: string
	status: MilestoneStatus
}

type ScholarNft = {
	token_id: string
	scholar_address: string
	program_name: string
	issued_at: string
	tx_hash: string
	metadata_uri: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROGRAM_ID = "scholarship-alpha-2026"
const PROGRAM_NAME = "LearnVault Alpha Scholarship 2026"
const NFT_TOKEN_ID = "NFT-ALPHA-001"
const NFT_TX_HASH = "tx-nft-mint-001"
const CREDENTIAL_SHARE_PATH = `/credentials/${NFT_TOKEN_ID}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fulfillJson(route: Route, body: unknown, status = 200) {
	await route.fulfill({
		status,
		contentType: "application/json",
		body: JSON.stringify(body),
	})
}

/**
 * Installs API mocks for the full credential NFT lifecycle.
 *
 * Returns helpers to advance state:
 * - `completeAllMilestones()` — marks every milestone as approved
 * - `mintNft()` — simulates the admin triggering the on-chain mint
 */
async function installCredentialMocks(page: Page) {
	const milestones: Milestone[] = [
		{ id: 1, title: "Project Proposal", status: "not_started" },
		{ id: 2, title: "Mid-program Review", status: "not_started" },
		{ id: 3, title: "Final Submission", status: "not_started" },
	]

	let mintedNft: ScholarNft | null = null

	await page.route("**/api/**", async (route) => {
		const request = route.request()
		const url = new URL(request.url())
		const { pathname } = url
		const method = request.method()

		// --- Scholar milestones for the program ---
		if (
			pathname === `/api/programs/${PROGRAM_ID}/milestones` &&
			method === "GET"
		) {
			return fulfillJson(route, {
				program_id: PROGRAM_ID,
				program_name: PROGRAM_NAME,
				milestones: milestones.map((m) => ({
					...m,
					learner: E2E_WALLET_ADDRESS,
				})),
			})
		}

		// --- Complete a single milestone (admin action) ---
		if (
			pathname.match(
				new RegExp(`^/api/programs/${PROGRAM_ID}/milestones/\\d+/complete$`),
			) &&
			method === "POST"
		) {
			const id = Number.parseInt(pathname.split("/")[5] ?? "", 10)
			const ms = milestones.find((m) => m.id === id)
			if (!ms) return fulfillJson(route, { error: "Not found" }, 404)
			ms.status = "approved"
			return fulfillJson(route, { milestone_id: id, status: "approved" })
		}

		// --- Scholar NFTs ---
		if (
			pathname === `/api/scholars/${E2E_WALLET_ADDRESS}/nfts` &&
			method === "GET"
		) {
			return fulfillJson(route, { nfts: mintedNft ? [mintedNft] : [] })
		}

		// --- Admin: mint NFT ---
		if (
			pathname === `/api/programs/${PROGRAM_ID}/mint-credential` &&
			method === "POST"
		) {
			const allDone = milestones.every((m) => m.status === "approved")
			if (!allDone) {
				return fulfillJson(
					route,
					{ error: "Not all milestones completed" },
					422,
				)
			}

			mintedNft = {
				token_id: NFT_TOKEN_ID,
				scholar_address: E2E_WALLET_ADDRESS,
				program_name: PROGRAM_NAME,
				issued_at: new Date().toISOString(),
				tx_hash: NFT_TX_HASH,
				metadata_uri: `ipfs://QmLearnVaultAlpha/${NFT_TOKEN_ID}.json`,
			}

			return fulfillJson(route, {
				token_id: mintedNft.token_id,
				tx_hash: mintedNft.tx_hash,
			})
		}

		// --- Public credential verification ---
		if (
			pathname === `/api/credentials/${NFT_TOKEN_ID}` &&
			method === "GET"
		) {
			if (!mintedNft)
				return fulfillJson(route, { error: "Not found" }, 404)
			return fulfillJson(route, mintedNft)
		}

		return route.continue()
	})

	return {
		/** Mark all milestones as approved without going through the UI. */
		completeAllMilestones() {
			for (const m of milestones) m.status = "approved"
		},
		/** Simulate the admin minting the NFT on-chain. */
		mintNft() {
			mintedNft = {
				token_id: NFT_TOKEN_ID,
				scholar_address: E2E_WALLET_ADDRESS,
				program_name: PROGRAM_NAME,
				issued_at: new Date().toISOString(),
				tx_hash: NFT_TX_HASH,
				metadata_uri: `ipfs://QmLearnVaultAlpha/${NFT_TOKEN_ID}.json`,
			}
		},
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Credential NFT flow", () => {
	test.beforeEach(async ({ page }) => {
		await installMockFreighter(page)
		await mockHorizonBalances(page)
	})

	test("1. Scholar sees their milestone progress for the program", async ({
		page,
	}) => {
		await installCredentialMocks(page)
		await page.goto(`/programs/${PROGRAM_ID}/milestones`)

		await expect(
			page.getByRole("heading", { name: PROGRAM_NAME }),
		).toBeVisible()

		// All three milestones are listed
		await expect(page.getByTestId("milestone-row")).toHaveCount(3)
		await expect(page.getByTestId("milestone-row").first()).toContainText(
			"Project Proposal",
		)
	})

	test("2. Admin can trigger NFT mint once all milestones are approved", async ({
		page,
	}) => {
		const mocks = await installCredentialMocks(page)
		mocks.completeAllMilestones()

		await page.goto(`/admin/programs/${PROGRAM_ID}`)

		await expect(
			page.getByTestId("mint-credential-btn"),
		).toBeEnabled()

		await page.getByTestId("mint-credential-btn").click()

		await expect(page.getByTestId("mint-success-toast")).toBeVisible()
		await expect(page.getByTestId("mint-success-toast")).toContainText(
			NFT_TOKEN_ID,
		)
	})

	test("2b. Admin cannot mint if milestones are incomplete", async ({
		page,
	}) => {
		await installCredentialMocks(page)
		await page.goto(`/admin/programs/${PROGRAM_ID}`)

		// Mint button should be disabled when milestones aren't all approved
		await expect(page.getByTestId("mint-credential-btn")).toBeDisabled()
	})

	test("3. NFT appears in scholar profile after mint", async ({ page }) => {
		const mocks = await installCredentialMocks(page)
		mocks.completeAllMilestones()
		mocks.mintNft()

		await page.goto(`/profile/${E2E_WALLET_ADDRESS}`)

		await expect(
			page.getByTestId("credential-nft-card"),
		).toBeVisible()
		await expect(page.getByTestId("credential-nft-card")).toContainText(
			PROGRAM_NAME,
		)
		await expect(page.getByTestId("credential-nft-card")).toContainText(
			NFT_TOKEN_ID,
		)
	})

	test("4–5. Credential verification page shows correct details", async ({
		page,
	}) => {
		const mocks = await installCredentialMocks(page)
		mocks.completeAllMilestones()
		mocks.mintNft()

		await page.goto(CREDENTIAL_SHARE_PATH)

		// Heading
		await expect(
			page.getByRole("heading", { name: /Verified Credential/i }),
		).toBeVisible()

		// Program name matches
		await expect(page.getByTestId("credential-program-name")).toHaveText(
			PROGRAM_NAME,
		)

		// Scholar address matches
		await expect(
			page.getByTestId("credential-scholar-address"),
		).toContainText(E2E_WALLET_ADDRESS.slice(0, 6))

		// On-chain transaction hash is present
		await expect(page.getByTestId("credential-tx-hash")).toContainText(
			NFT_TX_HASH,
		)

		// Validity badge
		await expect(
			page.getByTestId("credential-valid-badge"),
		).toContainText(/valid/i)
	})

	test("6. Share link copies to clipboard and resolves to the credential page", async ({
		page,
		context,
	}) => {
		const mocks = await installCredentialMocks(page)
		mocks.completeAllMilestones()
		mocks.mintNft()

		// Grant clipboard permissions in the test context
		await context.grantPermissions(["clipboard-read", "clipboard-write"])

		await page.goto(CREDENTIAL_SHARE_PATH)

		// Click the share / copy button
		await page.getByTestId("copy-share-link").click()

		// Button feedback
		await expect(page.getByTestId("copy-share-link")).toContainText(/copied/i)

		// Clipboard contains a URL that includes the token id
		const clipboard = await page.evaluate(() =>
			navigator.clipboard.readText(),
		)
		expect(clipboard).toContain(NFT_TOKEN_ID)

		// The copied URL resolves: navigate to it and verify the page loads
		await page.goto(clipboard)
		await expect(
			page.getByTestId("credential-program-name"),
		).toHaveText(PROGRAM_NAME)
	})
})
