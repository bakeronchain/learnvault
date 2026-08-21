import { spawn, type ChildProcess } from "node:child_process"

import { expect, test, type Page, type Route } from "@playwright/test"
import { Keypair, StrKey } from "@stellar/stellar-sdk"

import {
	E2E_WALLET_ADDRESS,
	installMockFreighter,
} from "./fixtures/mock-wallet"

const E2E_PORT = 4174
const E2E_URL = `http://127.0.0.1:${E2E_PORT}`
const TRANSACTION_HASH = "a".repeat(64)
const TREASURY_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 1))
const GOVERNANCE_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 2))
const USDC_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 3))
const DELEGATEE_ADDRESS = Keypair.fromRawEd25519Seed(
	Buffer.alloc(32, 4),
).publicKey()
const DEPOSIT_AMOUNT = 100.5
const INITIAL_USDC = 321.75
const INITIAL_GOV_ATOMIC = 987_654_321n
const ISSUED_GOV_ATOMIC = 123_456_789n

let viteProcess: ChildProcess

async function waitForServer(url: string): Promise<void> {
	const deadline = Date.now() + 30_000
	while (Date.now() < deadline) {
		try {
			const response = await fetch(url)
			if (response.ok) return
		} catch {
			// Vite is still starting.
		}
		await new Promise((resolve) => setTimeout(resolve, 250))
	}
	throw new Error(`Timed out waiting for ${url}`)
}

test.beforeAll(async () => {
	viteProcess = spawn(
		"npm",
		[
			"run",
			"dev:ui",
			"--",
			"--host",
			"127.0.0.1",
			"--port",
			String(E2E_PORT),
			"--strictPort",
		],
		{
			cwd: process.cwd(),
			env: {
				...process.env,
				VITE_SERVER_URL: E2E_URL,
				VITE_SCHOLARSHIP_TREASURY_CONTRACT_ID: TREASURY_CONTRACT_ID,
				VITE_GOVERNANCE_TOKEN_CONTRACT_ID: GOVERNANCE_CONTRACT_ID,
				VITE_USDC_CONTRACT_ID: USDC_CONTRACT_ID,
			},
			stdio: "ignore",
		},
	)
	await waitForServer(E2E_URL)
})

test.afterAll(() => {
	viteProcess.kill("SIGTERM")
})

test.use({ serviceWorkers: "block" })

const fulfillJson = async (route: Route, body: unknown): Promise<void> => {
	await route.fulfill({
		status: 200,
		contentType: "application/json",
		body: JSON.stringify(body),
	})
}

async function installTestModules(page: Page): Promise<void> {
	await page.route("**/src/util/wallet.ts*", async (route) => {
		await route.fulfill({
			contentType: "application/javascript",
			body: `
				export const wallet = {
					signTransaction: async (xdr) => {
						const signed = await window.freighterApi.signTransaction(xdr)
						return {
							signedTxXdr: typeof signed === "string" ? signed : signed.signedTxXdr,
							signerAddress: "${E2E_WALLET_ADDRESS}",
						}
					},
				}
				export const fetchBalances = async () => ({})
				export const connectWallet = async () => {}
				export const disconnectWallet = async () => {}
			`,
		})
	})
	await page.route("**/src/util/soroban-transaction.ts*", async (route) => {
		await route.fulfill({
			contentType: "application/javascript",
			body: `
				export class SorobanTransactionError extends Error {}
				export const prepareAndConfirmTransaction = async ({ signTransaction }) => {
					await signTransaction("prepared-soroban-xdr")
					return "${TRANSACTION_HASH}"
				}
			`,
		})
	})
	await page.route("**/src/util/usdc.ts*", async (route) => {
		await route.fulfill({
			contentType: "application/javascript",
			body: `
				export const getUSDCContractId = () => "${USDC_CONTRACT_ID}"
				export const getUSDCBalance = async () => {
					const response = await fetch("/api/test/usdc-balance")
					const data = await response.json()
					return BigInt(data.atomic)
				}
			`,
		})
	})
}

async function installFreighterSignatureRecorder(page: Page): Promise<void> {
	await page.evaluate(() => {
		const testWindow = window as typeof window & {
			freighterApi: {
				signTransaction: (xdr: string) => Promise<string>
			}
			__freighterSignatures?: string[]
		}
		const originalSign = testWindow.freighterApi.signTransaction
		testWindow.__freighterSignatures = []
		testWindow.freighterApi.signTransaction = async (xdr: string) => {
			testWindow.__freighterSignatures?.push(xdr)
			return originalSign(xdr)
		}
	})
}

test("cubre el flujo completo del Sponsor Portal #1017", async ({ page }) => {
	let usdcBalance = INITIAL_USDC
	let govBalance = INITIAL_GOV_ATOMIC
	const deposits: Array<Record<string, unknown>> = []
	let depositPayload: unknown
	const postPaths: string[] = []

	await installTestModules(page)
	page.on("request", (request) => {
		if (request.method() === "POST") {
			postPaths.push(new URL(request.url()).pathname)
		}
	})
	await page.route("**/api/**", async (route) => {
		const request = route.request()
		const pathname = new URL(request.url()).pathname

		if (pathname === "/api/test/usdc-balance") {
			return fulfillJson(route, {
				atomic: BigInt(Math.round(usdcBalance * 10_000_000)).toString(),
			})
		}
		if (pathname.startsWith("/api/governance/voting-power/")) {
			return fulfillJson(route, { gov_balance: govBalance.toString() })
		}
		if (pathname.startsWith("/api/governance/delegation/")) {
			return fulfillJson(route, {
				address: E2E_WALLET_ADDRESS,
				delegatee: null,
				is_delegating: false,
				own_balance: govBalance.toString(),
				delegated_to_me: "0",
				voting_power: govBalance.toString(),
			})
		}
		if (pathname === "/api/proposals") {
			return fulfillJson(route, { proposals: [], total: 0, page: 1 })
		}
		if (pathname === "/api/treasury/deposit" && request.method() === "POST") {
			depositPayload = request.postDataJSON()
			usdcBalance -= DEPOSIT_AMOUNT
			govBalance += ISSUED_GOV_ATOMIC
			deposits.push({
				id: 1,
				donor_address: E2E_WALLET_ADDRESS,
				amount_usdc: String(DEPOSIT_AMOUNT),
				gov_issued: "12.3456789",
				tx_hash: TRANSACTION_HASH,
				deposited_at: "2026-08-20T12:00:00.000Z",
			})
			return fulfillJson(route, {
				deposit: deposits[0],
				gov_balance: govBalance.toString(),
			})
		}
		if (pathname.startsWith("/api/treasury/deposits/")) {
			return fulfillJson(route, {
				data: deposits,
				pagination: { page: 1, limit: 20, total: deposits.length },
			})
		}
		await route.abort()
	})

	await page.goto(`${E2E_URL}/sponsor`)
	await expect(
		page.getByRole("heading", { name: "Get started with LearnVault" }),
	).toBeVisible()
	await expect(
		page.getByRole("heading", { name: "Sponsor Portal" }),
	).toBeHidden()

	await installMockFreighter(page)
	await page.reload()
	await installFreighterSignatureRecorder(page)

	await expect(page.getByText(`${INITIAL_USDC} USDC`)).toBeVisible()
	await expect(page.getByText("98.7654321 GOV")).toBeVisible()

	await page.getByLabel("USDC amount").fill(String(DEPOSIT_AMOUNT))
	await page.getByRole("button", { name: "Deposit USDC" }).click()

	await expect
		.poll(() =>
			page.evaluate(
				() =>
					(
						window as typeof window & {
							__freighterSignatures?: string[]
						}
					).__freighterSignatures ?? [],
			),
		)
		.toEqual(["prepared-soroban-xdr"])
	await expect.poll(() => postPaths).toContain("/api/treasury/deposit")
	await expect
		.poll(() => depositPayload)
		.toEqual({
			donor_address: E2E_WALLET_ADDRESS,
			amount: DEPOSIT_AMOUNT,
			tx_hash: TRANSACTION_HASH,
		})
	await expect(page.getByText("221.25 USDC")).toBeVisible()
	await expect(page.getByText("111.111111 GOV")).toBeVisible()
	await expect(page.getByText(`${DEPOSIT_AMOUNT} USDC`)).toBeVisible()
	await expect(page.getByText("12.3456789 GOV")).toBeVisible()

	await page.reload()
	await installFreighterSignatureRecorder(page)
	await expect(page.getByText("221.25 USDC")).toBeVisible()
	await expect(page.getByText("111.111111 GOV")).toBeVisible()
	await expect(page.getByText(`${DEPOSIT_AMOUNT} USDC`)).toBeVisible()

	await page.getByLabel("Delegate address").fill(DELEGATEE_ADDRESS)
	await page.getByRole("button", { name: "Delegate power" }).click()
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					(
						window as typeof window & {
							__freighterSignatures?: string[]
						}
					).__freighterSignatures?.length ?? 0,
			),
		)
		.toBe(1)
})
