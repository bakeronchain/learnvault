const API_BASE =
	(import.meta.env.VITE_API_BASE_URL as string | undefined) ||
	(import.meta.env.VITE_SERVER_URL as string | undefined) ||
	"http://localhost:4000"

const API_ORIGIN = API_BASE.startsWith("/") ? "" : new URL(API_BASE).origin

interface DepositRequest {
	donorAddress: string
	amount: number
	txHash: string
}

export interface DepositData {
	id: number
	donor_address: string
	amount_usdc: string
	gov_issued: string
	tx_hash: string
	deposited_at: string
}

export interface DepositResponse {
	deposit: DepositData
	gov_balance: string
}

export interface Deposit {
	id: number
	donor_address: string
	amount_usdc: string
	gov_issued: string
	tx_hash: string
	deposited_at: string
}

export interface Pagination {
	page: number
	limit: number
	total: number
}

interface PaginatedDepositsResponse {
	data: Deposit[]
	pagination: Pagination
}

function parseErrorMessage(payload: unknown): string {
	if (typeof payload === "string") return payload
	if (
		payload &&
		typeof payload === "object" &&
		"error" in payload &&
		typeof payload.error === "object" &&
		payload.error &&
		"message" in payload.error &&
		typeof payload.error.message === "string"
	) {
		return payload.error.message
	}
	if (
		payload &&
		typeof payload === "object" &&
		"error" in payload &&
		typeof payload.error === "string"
	) {
		return payload.error
	}
	if (
		payload &&
		typeof payload === "object" &&
		"message" in payload &&
		typeof payload.message === "string"
	) {
		return payload.message
	}
	return "Unknown error"
}

export async function depositToTreasury({
	donorAddress,
	amount,
	txHash,
}: DepositRequest): Promise<DepositResponse> {
	const response = await fetch(`${API_ORIGIN}/api/treasury/deposit`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			donor_address: donorAddress,
			amount,
			tx_hash: txHash,
		}),
	})

	if (!response.ok) {
		const payload = await response.json().catch(() => ({}))
		const errorMsg = parseErrorMessage(payload)
		throw new Error(
			errorMsg === "Unknown error" ? "Failed to register deposit" : errorMsg,
		)
	}

	return (await response.json()) as DepositResponse
}

export async function getDepositsForAddress(
	address: string,
): Promise<Deposit[]> {
	const encodedAddress = encodeURIComponent(address)
	const response = await fetch(
		`${API_ORIGIN}/api/treasury/deposits/${encodedAddress}`,
	)

	if (!response.ok) {
		const payload = await response.json().catch(() => ({}))
		const errorMsg = parseErrorMessage(payload)
		throw new Error(
			errorMsg === "Unknown error" ? "Failed to fetch deposits" : errorMsg,
		)
	}

	const data = (await response.json()) as PaginatedDepositsResponse
	return data.data
}
