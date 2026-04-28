/**
 * Lightweight Sentry compatibility shim.
 * In environments where @sentry/react is unavailable we keep a stable API
 * surface so the app can compile and run without hard dependency failures.
 */

const WALLET_ADDRESS_REGEX = /0x[a-fA-F0-9]{40}/g

export type SeverityLevel =
	| "fatal"
	| "error"
	| "warning"
	| "log"
	| "info"
	| "debug"

export interface SentryEvent {
	message?: string
	[key: string]: unknown
}

interface BreadcrumbPayload {
	message: string
	category?: string
	level?: SeverityLevel
	data?: Record<string, unknown>
}

interface SentryLike {
	init: (_config: Record<string, unknown>) => void
	setUser: (_user: Record<string, unknown> | null) => void
	captureException: (
		_error: unknown,
		_options?: {
			level?: SeverityLevel
			tags?: Record<string, string>
			extra?: Record<string, unknown>
		},
	) => string | undefined
	addBreadcrumb: (_breadcrumb: BreadcrumbPayload) => void
}

const SentryShim: SentryLike = {
	init: () => {},
	setUser: () => {},
	captureException: () => undefined,
	addBreadcrumb: () => {},
}

const redactWalletAddresses = (value: unknown): unknown => {
	if (typeof value === "string") {
		return value.replace(WALLET_ADDRESS_REGEX, "[REDACTED_WALLET]")
	}
	if (Array.isArray(value)) {
		return value.map(redactWalletAddresses)
	}
	if (value !== null && typeof value === "object") {
		const redacted: Record<string, unknown> = {}
		for (const [key, val] of Object.entries(value)) {
			redacted[key] = redactWalletAddresses(val)
		}
		return redacted
	}
	return value
}

export interface SentryConfig {
	dsn?: string
	environment: string
	release?: string
	tracesSampleRate?: number
	replaysSessionSampleRate?: number
	replaysOnErrorSampleRate?: number
}

export function initSentry(config: SentryConfig): void {
	if (!config.dsn) {
		console.warn(
			"Sentry DSN not configured. Error monitoring disabled. Set VITE_SENTRY_DSN environment variable.",
		)
		return
	}

	SentryShim.init({
		dsn: config.dsn,
		environment: config.environment,
		release: config.release,
		tracesSampleRate: config.tracesSampleRate ?? 0.1,
		replaysSessionSampleRate: config.replaysSessionSampleRate ?? 0.1,
		replaysOnErrorSampleRate: config.replaysOnErrorSampleRate ?? 1.0,
	})
}

export function setSentryUser(
	userId: string,
	email?: string,
	walletAddress?: string,
): void {
	SentryShim.setUser({
		id: userId,
		email,
		username: email?.split("@")[0],
		walletAddress,
	})
}

export function clearSentryUser(): void {
	SentryShim.setUser(null)
}

export function captureError(
	error: unknown,
	options?: {
		level?: SeverityLevel
		tags?: Record<string, string>
		extra?: Record<string, unknown>
	},
): string | undefined {
	return SentryShim.captureException(error, {
		level: options?.level ?? "error",
		tags: options?.tags,
		extra: options?.extra
			? (redactWalletAddresses(options.extra) as Record<string, unknown>)
			: undefined,
	})
}

export function addBreadcrumb(
	message: string,
	category?: string,
	level?: SeverityLevel,
	data?: Record<string, unknown>,
): void {
	SentryShim.addBreadcrumb({
		message: message.replace(WALLET_ADDRESS_REGEX, "[REDACTED_WALLET]"),
		category,
		level,
		data: data
			? (redactWalletAddresses(data) as Record<string, unknown>)
			: undefined,
	})
}

export const Sentry = SentryShim
