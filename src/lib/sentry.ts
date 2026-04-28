import * as Sentry from "@sentry/react"

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

export interface SentryConfig {
	dsn?: string
	environment: string
	release?: string
	tracesSampleRate?: number
	replaysSessionSampleRate?: number
	replaysOnErrorSampleRate?: number
}

/**
 * Initialize Sentry for the frontend React application
 * Call this at app startup before rendering
 */
export function initSentry(config: SentryConfig): void {
	if (!config.dsn) {
		console.warn(
			"Sentry DSN not configured. Error monitoring disabled. Set VITE_SENTRY_DSN environment variable.",
		)
		return
	}

	Sentry.init({
		dsn: config.dsn,
		environment: config.environment,
		release: config.release,
		integrations: [
			// React integration with automatic component tracking
			Sentry.reactIntegration(),
			// Browser tracing for performance monitoring
			Sentry.browserTracingIntegration(),
			// Replay integration for session replay (optional)
			Sentry.replayIntegration({
				maskAllText: true,
				blockAllMedia: true,
			}),
		],
		// Performance monitoring
		tracesSampleRate: config.tracesSampleRate ?? 0.1,
		// Session replay configuration
		replaysSessionSampleRate: config.replaysSessionSampleRate ?? 0.1,
		replaysOnErrorSampleRate: config.replaysOnErrorSampleRate ?? 1.0,
		// PII scrubbing
		beforeSend: (event: Sentry.ErrorEvent) => {
			return scrubPII(event as unknown as Sentry.Event) as Sentry.ErrorEvent | null
		},
		beforeSendTransaction: (transaction) => {
			// Also scrub PII from transaction events
			return scrubPII(transaction as unknown as Sentry.Event) as Sentry.Event | null
		},
		// Ignore common non-actionable errors
		ignoreErrors: [
			// Browser extensions
			/top\.location/,
			/chrome-extension:/,
			/extension:/,
			// Network errors that are expected
			/NetworkError/,
			/Network request failed/,
			/Failed to fetch/,
			// Random plugins/extensions
			/atomicFindClose/,
			// Facebook borked
			/fb_xd_fragment/,
			// Other
			/can't redefine non-configurable property/,
		],
		// Deny URLs that are not actionable
		denyUrls: [
			// Chrome extensions
			/extensions\//i,
			/^chrome:\/\//i,
			/^chrome-extension:\/\//i,
			// Facebook flakiness
			/graph\.facebook\.com/i,
			// Facebook blocked
			/connect\.facebook\.net/i,
			// Woopra flakiness
			/eatdifferent\.com\.woopra-ns\.com/i,
			/static\.woopra\.com\/js\/woopra\.js/i,
			// Other plugins
			/127\.0\.0\.1:4000\/isalive/i,
		],
		// Auto session tracking
		autoSessionTracking: true,
		// Detect release from Vite build
		detectRelease: true,
	})

	console.log(`Sentry initialized for environment: ${config.environment}`)
}

/**
 * Set user context for Sentry (call after wallet connection/authentication)
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
 * Clear user context (call on wallet disconnect/logout)
 */
export function clearSentryUser(): void {
	Sentry.setUser(null)
}

/**
 * Capture a custom error with additional context
 */
export function captureError(
	error: unknown,
	options?: {
		level?: Sentry.SeverityLevel
		tags?: Record<string, string>
		extra?: Record<string, unknown>
	},
): string | undefined {
	return Sentry.captureException(error, {
		level: options?.level ?? "error",
		tags: options?.tags,
		extra: options?.extra ? redactWalletAddresses(options.extra) : undefined,
	})
}

/**
 * Add a breadcrumb (will be attached to next error)
 */
export function addBreadcrumb(
	message: string,
	category?: string,
	level?: Sentry.SeverityLevel,
	data?: Record<string, unknown>,
): void {
	Sentry.addBreadcrumb({
		message: message.replace(WALLET_ADDRESS_REGEX, "[REDACTED_WALLET]"),
		category,
		level,
		data: data ? redactWalletAddresses(data) : undefined,
	})
}

export { Sentry }
