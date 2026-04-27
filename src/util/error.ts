export function parseError(error: unknown): string {
	if (!error) return "An unexpected error occurred."

	// Convert to string for easier pattern matching,
	// works for both Error objects (via .message) and string literals/objects.
	const errorMsg =
		typeof error === "object" && error !== null && "message" in error
			? String((error as Error).message)
			: String(error)

	const lowerError = String(errorMsg).toLowerCase()

	// Catch insufficient balance from contract output
	if (
		lowerError.includes("insufficient balance") ||
		lowerError.includes("not enough") ||
		lowerError.includes("underfunded")
	) {
		return "You don't have enough LRN for this action"
	}

	// Catch network mismatch issues from wallet
	if (
		lowerError.includes("network") ||
		lowerError.includes("wrong network") ||
		lowerError.includes("testnet") ||
		lowerError.includes("mismatch")
	) {
		return "Please switch to Testnet in your wallet"
	}

	// Catch user rejection / cancellation
	if (
		lowerError.includes("user rejected") ||
		lowerError.includes("cancelled") ||
		lowerError.includes("rejected by user") ||
		lowerError.includes("declined")
	) {
		return "Transaction cancelled"
	}

	// Always fallback to a friendly, generic message per the requirement:
	// "No raw error objects ever shown to users"
	return "An unexpected error occurred. Please try again."
}
