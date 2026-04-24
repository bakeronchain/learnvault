import { type Page } from "@playwright/test"

type Bal = {
	asset_type: "native" | "credit_alphanum4" | "credit_alphanum12"
	balance: string
	asset_code?: string
	asset_issuer?: string
}

export async function mockHorizonBalances(
	page: Page,
	opts?: { startLrn?: number },
) {
	let lrn = opts?.startLrn ?? 0

	await page.route("**/accounts/**", async (route) => {
		const balances: Bal[] = [
			{ asset_type: "native", balance: "1000.0000000" },
			{
				asset_type: "credit_alphanum4",
				asset_code: "LRN",
				asset_issuer:
					"GDUKMGUGDZQK6YH4FQDPZ3W4E6Y2Q3A6VJY3N4FQ5ZJ3N4FQ5ZJ3N4FQ",
				balance: String(lrn),
			},
		]

		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ balances }),
		})
	})

	return {
		increaseLrn(by: number) {
			lrn += by
		},
		getLrn() {
			return lrn
		},
	}
}
