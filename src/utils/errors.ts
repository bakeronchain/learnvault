import {
	type AppError,
	ErrorCode,
	createAppError,
	isAppError,
} from "../types/errors"

export function generateRequestId(): string {
	return `${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
	[ErrorCode.WALLET_NOT_CONNECTED]:
		"Connect your wallet to continue — use the button in the top navigation.",
	[ErrorCode.CONTRACT_NOT_DEPLOYED]:
		"This feature isn't available on the current network. Switch to Stellar Testnet in your wallet.",
	[ErrorCode.TRANSACTION_REJECTED]:
		"Transaction cancelled — nothing was sent or changed.",
	[ErrorCode.NETWORK_ERROR]:
		"Network request failed. Check your connection and try again.",
	[ErrorCode.INVALID_INPUT]:
		"One or more fields are invalid — review your input and try again.",
	[ErrorCode.UNKNOWN_ERROR]: "An unexpected error occurred.",
}

export function parseError(error: unknown): AppError {
	if (isAppError(error)) {
		return error
	}

	if (error instanceof Error) {
		const message = error.message.toLowerCase()

		if (
			message.includes("not connected") ||
			message.includes("wallet") ||
			message.includes("connect")
		) {
			return createAppError(
				ErrorCode.WALLET_NOT_CONNECTED,
				ERROR_MESSAGES[ErrorCode.WALLET_NOT_CONNECTED],
				{},
				error,
			)
		}

		if (
			message.includes("not deployed") ||
			message.includes("contract") ||
			message.includes("not found") ||
			message.includes("not configured")
		) {
			return createAppError(
				ErrorCode.CONTRACT_NOT_DEPLOYED,
				ERROR_MESSAGES[ErrorCode.CONTRACT_NOT_DEPLOYED],
				{},
				error,
			)
		}

		if (
			message.includes("rejected") ||
			message.includes("cancelled") ||
			message.includes("denied") ||
			message.includes("canc")
		) {
			return createAppError(
				ErrorCode.TRANSACTION_REJECTED,
				ERROR_MESSAGES[ErrorCode.TRANSACTION_REJECTED],
				{},
				error,
			)
		}

		if (
			message.includes("network") ||
			message.includes("fetch") ||
			message.includes("timeout") ||
			message.includes("econnrefused") ||
			message.includes("failed to")
		) {
			return createAppError(
				ErrorCode.NETWORK_ERROR,
				ERROR_MESSAGES[ErrorCode.NETWORK_ERROR],
				{},
				error,
			)
		}
	}

	return createAppError(
		ErrorCode.UNKNOWN_ERROR,
		ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR],
		{},
		error,
	)
}

export function isUserRejection(error: unknown): boolean {
	const parsed = parseError(error)
	return parsed.code === ErrorCode.TRANSACTION_REJECTED
}

export function getErrorMessage(error: unknown): string {
	if (isAppError(error)) {
		return error.message
	}
	if (error instanceof Error) {
		return error.message
	}
	return ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR]
}
