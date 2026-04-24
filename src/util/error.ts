export function parseError(error: unknown): string {
	if (!error) return "An unexpected error occurred. Please try again."

	const errorMsg =
		typeof error === "object" && error !== null && "message" in error
			? String((error as Error).message)
			: String(error)

	const lowerError = String(errorMsg).toLowerCase()

	if (
		lowerError.includes("insufficient balance") ||
		lowerError.includes("not enough") ||
		lowerError.includes("underfunded")
	) {
		return "You don't have enough LRN tokens for this action. Add more tokens and try again."
	}

	if (
		lowerError.includes("network") ||
		lowerError.includes("wrong network") ||
		lowerError.includes("testnet") ||
		lowerError.includes("mismatch")
	) {
		return "Wrong network detected — switch to Stellar Testnet in your wallet and try again."
	}

	if (
		lowerError.includes("user rejected") ||
		lowerError.includes("cancelled") ||
		lowerError.includes("rejected by user") ||
		lowerError.includes("declined")
	) {
		return "Transaction cancelled — nothing was sent or changed."
	}

	if (
		lowerError.includes("timeout") ||
		lowerError.includes("econnrefused") ||
		lowerError.includes("fetch")
	) {
		return "Connection timed out. Check your network connection and try again."
	}

	return "An unexpected error occurred. Please try again or contact support if the problem persists."
}
