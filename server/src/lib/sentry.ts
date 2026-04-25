import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node"
import type { Request, Response, NextFunction } from "express"

/**
 * Regex pattern for Stellar wallet addresses (0x followed by 40 hex characters)
 * Used for PII scrubbing to redact sensitive wallet addresses from error reports
 */
const WALLET_ADDRESS_REGEX = /0x[a-fA-F0-9]{40}/g

/**
 * Redacts wallet addresses from strings to prevent PII leakage in Sentry reports
 */
function redactWalletAddresses(value: unknown): unknown {
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

/**
 * PII scrubbing filter for beforeSend
 * Redacts wallet addresses from error messages, stack traces, and contexts
 */
function scrubPII(event: Sentry.Event): Sentry.Event | null {
	// Redact wallet addresses from error messages
	if (event.message && typeof event.message === "string") {
		event.message = event.message.replace(WALLET_ADDRESS_REGEX, "[REDACTED_WALLET]")
	}

	// Redact from exception values
	if (event.exception?.values) {
		for (const exception of event.exception.values) {
			if (exception.value) {
				exception.value = exception.value.replace(
					WALLET_ADDRESS_REGEX,
					"[REDACTED_WALLET]",
				)
			}
			if (exception.stacktrace?.frames) {
				for (const frame of exception.stacktrace.frames) {
					if (frame.vars) {
						frame.vars = redactWalletAddresses(frame.vars) as Record<
							string,
							unknown
						>
					}
				}
			}
		}
	}

	// Redact from breadcrumbs
	if (event.breadcrumbs) {
		for (const breadcrumb of event.breadcrumbs) {
			if (breadcrumb.message) {
				breadcrumb.message = breadcrumb.message.replace(
					WALLET_ADDRESS_REGEX,
					"[REDACTED_WALLET]",
				)
			}
			if (breadcrumb.data) {
				breadcrumb.data = redactWalletAddresses(
					breadcrumb.data,
				) as Record<string, unknown>
			}
		}
	}

	// Redact from contexts
	if (event.contexts) {
		for (const [key, context] of Object.entries(event.contexts)) {
			event.contexts[key] = redactWalletAddresses(context) as Record<
				string,
				unknown
			>
		}
	}

	// Redact from extra data
	if (event.extra) {
		event.extra = redactWalletAddresses(event.extra) as Record<string, unknown>
	}

	// Redact from user context (but preserve user ID for tracking)
	if (event.user) {
		const { walletAddress, ...safeUser } = event.user
		if (walletAddress) {
			safeUser.walletAddress = "[REDACTED_WALLET]"
		}
		event.user = redactWalletAddresses(safeUser) as Record<string, unknown>
	}

	return event
}

interface SentryConfig {
	dsn?: string
	environment: string
	release?: string
	tracesSampleRate?: number
	profilesSampleRate?: number
}

/**
 * Initialize Sentry for the backend Express application
 * Must be called before any other imports that might throw errors
 */
export function initSentry(config: SentryConfig): void {
	if (!config.dsn) {
		console.warn(
			"Sentry DSN not configured. Error monitoring disabled. Set SENTRY_DSN environment variable.",
		)
		return
	}

	Sentry.init({
		dsn: config.dsn,
		environment: config.environment,
		release: config.release,
		integrations: [
			nodeProfilingIntegration(),
			Sentry.httpIntegration(),
			Sentry.expressIntegration(),
		],
		tracesSampleRate: config.tracesSampleRate ?? 0.1,
		profilesSampleRate: config.profilesSampleRate ?? 0.1,
		beforeSend: (event: Sentry.ErrorEvent) => {
			return scrubPII(event as unknown as Sentry.Event) as Sentry.ErrorEvent | null
		},
		beforeSendTransaction: (transaction) => {
			// Also scrub PII from transaction events
			return scrubPII(transaction as unknown as Sentry.Event) as Sentry.Event | null
		},
		ignoreErrors: [
			// Ignore common non-actionable errors
			/Request aborted/,
			/ECONNRESET/,
			/ETIMEDOUT/,
			/Sockets closed/,
		],
		denyUrls: [
			// Ignore errors from node_modules
			/node_modules\//,
		],
	})

	console.log(`Sentry initialized for environment: ${config.environment}`)
}

/**
 * Express middleware to enrich Sentry scope with request context
 * Attach this BEFORE your routes
 */
export function sentryRequestHandler(
	req: Request,
	_res: Response,
	next: NextFunction,
): void {
	const scope = Sentry.getCurrentScope()
	scope.setExtra("requestId", req.get("X-Request-ID"))
	scope.setExtra("ip", req.ip)
	scope.setExtra("userAgent", req.get("User-Agent"))

	if (req.body && typeof req.body === "object") {
		// Only include non-sensitive fields
		const safeBody: Record<string, unknown> = {}
		for (const [key, value] of Object.entries(req.body)) {
			// Exclude potentially sensitive fields
			if (
				!key.toLowerCase().includes("password") &&
				!key.toLowerCase().includes("secret") &&
				!key.toLowerCase().includes("token") &&
				!key.toLowerCase().includes("private")
			) {
				safeBody[key] = redactWalletAddresses(value)
			}
		}
		scope.setExtra("body", safeBody)
	}

	next()
}

/**
 * Set user context for Sentry (call after authentication)
 */
export function setSentryUser(
	userId: string,
	email?: string,
	walletAddress?: string,
): void {
	Sentry.setUser({
		id: userId,
		email,
		username: email?.split("@")[0],
		walletAddress,
	})
}

/**
 * Clear user context (call on logout)
 */
export function clearSentryUser(): void {
	Sentry.setUser(null)
}

export { Sentry }
