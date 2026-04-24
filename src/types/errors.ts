export enum ErrorCode {
	WALLET_NOT_CONNECTED = "WALLET_NOT_CONNECTED",
	CONTRACT_NOT_DEPLOYED = "CONTRACT_NOT_DEPLOYED",
	TRANSACTION_REJECTED = "TRANSACTION_REJECTED",
	NETWORK_ERROR = "NETWORK_ERROR",
	INVALID_INPUT = "INVALID_INPUT",
	UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export interface AppError {
	code: ErrorCode
	message: string
	requestId?: string
	context?: Record<string, unknown>
	originalError?: unknown
}

export interface ErrorContext {
	contractName?: string
	methodName?: string
	walletAddress?: string
	networkId?: string
	[key: string]: unknown
}

export function isAppError(error: unknown): error is AppError {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		"message" in error
	)
}

export function createAppError(
	code: ErrorCode,
	message: string,
	context?: ErrorContext,
	originalError?: unknown,
	requestId?: string,
): AppError {
	return {
		code,
		message,
		requestId,
		context,
		originalError,
	}
}
