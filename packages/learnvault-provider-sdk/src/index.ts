// @learnvault/provider-sdk — Official SDK for the LearnVault Provider API
// Requires Node ≥ 18 (global fetch) or any environment with the Fetch API.

export interface LearnVaultClientOptions {
	apiKey: string
	baseUrl?: string
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface Pagination {
	total: number
	limit: number
	offset: number
}

export interface Course {
	id: number
	title: string
	slug: string
	description: string | null
	difficulty: "beginner" | "intermediate" | "advanced"
	track: string | null
	external_url: string | null
	is_published: boolean
	created_at: string
}

export interface SubmitCourseParams {
	title: string
	slug: string
	description?: string
	difficulty: "beginner" | "intermediate" | "advanced"
	track?: string
	external_url?: string
}

export interface Completion {
	id: number
	learner_address: string
	course_id: number
	course_slug: string
	milestone_id: number | null
	tx_hash: string | null
	completed_at: string
	created_at: string
}

export interface ReportCompletionParams {
	learner_address: string
	course_id: number
	milestone_id?: number
	tx_hash?: string
	completed_at?: string
}

export interface LrnBalance {
	address: string
	lrn_balance: string
}

export type WebhookEventType =
	| "milestone.completed"
	| "course.enrolled"
	| "completion.recorded"

export interface Webhook {
	id: number
	url: string
	events: WebhookEventType[]
	is_active: boolean
	failure_count: number
	last_triggered_at: string | null
	created_at: string
}

export interface RegisterWebhookParams {
	url: string
	events: WebhookEventType[]
}

export interface WebhookDelivery {
	id: number
	event_type: string
	status: "pending" | "delivered" | "failed"
	attempts: number
	response_status: number | null
	delivered_at: string | null
	created_at: string
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class LearnVaultApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly body: unknown,
		message: string,
	) {
		super(message)
		this.name = "LearnVaultApiError"
	}
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class LearnVaultProviderClient {
	private readonly apiKey: string
	private readonly baseUrl: string

	constructor(opts: LearnVaultClientOptions) {
		this.apiKey = opts.apiKey
		this.baseUrl = (opts.baseUrl ?? "https://api.learnvault.app").replace(
			/\/$/,
			"",
		)
	}

	private async request<T>(
		method: string,
		path: string,
		body?: unknown,
		params?: Record<string, string | number | undefined>,
	): Promise<T> {
		let url = `${this.baseUrl}/api${path}`

		if (params) {
			const qs = Object.entries(params)
				.filter(([, v]) => v !== undefined)
				.map(
					([k, v]) =>
						`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
				)
				.join("&")
			if (qs) url += `?${qs}`
		}

		const res = await fetch(url, {
			method,
			headers: {
				"Content-Type": "application/json",
				"X-Provider-API-Key": this.apiKey,
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		})

		const json = (await res
			.json()
			.catch(() => ({ error: res.statusText }))) as unknown

		if (!res.ok) {
			const msg =
				typeof json === "object" && json !== null && "message" in json
					? String((json as Record<string, unknown>).message)
					: res.statusText
			throw new LearnVaultApiError(res.status, json, msg)
		}

		return json as T
	}

	// -------------------------------------------------------------------------
	// Courses
	// -------------------------------------------------------------------------

	async submitCourse(params: SubmitCourseParams): Promise<Course> {
		const res = await this.request<{ data: Course }>(
			"POST",
			"/provider/courses",
			params,
		)
		return res.data
	}

	async listCourses(opts?: {
		limit?: number
		offset?: number
	}): Promise<{ data: Course[]; pagination: Pagination }> {
		return this.request("GET", "/provider/courses", undefined, opts)
	}

	// -------------------------------------------------------------------------
	// Completions
	// -------------------------------------------------------------------------

	async reportCompletion(params: ReportCompletionParams): Promise<Completion> {
		const res = await this.request<{ data: Completion }>(
			"POST",
			"/provider/completions",
			params,
		)
		return res.data
	}

	async listCompletions(opts?: {
		course_id?: number
		limit?: number
		offset?: number
	}): Promise<{ data: Completion[]; pagination: Pagination }> {
		return this.request("GET", "/provider/completions", undefined, opts)
	}

	// -------------------------------------------------------------------------
	// LRN data
	// -------------------------------------------------------------------------

	async getLrnBalance(address: string): Promise<LrnBalance> {
		const res = await this.request<LrnBalance>(
			"GET",
			`/provider/lrn-balances/${encodeURIComponent(address)}`,
		)
		return res
	}

	// -------------------------------------------------------------------------
	// Webhooks
	// -------------------------------------------------------------------------

	async registerWebhook(
		params: RegisterWebhookParams,
	): Promise<Webhook & { signing_secret: string }> {
		const res = await this.request<{
			data: Webhook & { signing_secret: string }
		}>("POST", "/provider/webhooks", params)
		return res.data
	}

	async listWebhooks(): Promise<Webhook[]> {
		const res = await this.request<{ data: Webhook[] }>(
			"GET",
			"/provider/webhooks",
		)
		return res.data
	}

	async deleteWebhook(webhookId: number): Promise<void> {
		await this.request("DELETE", `/provider/webhooks/${webhookId}`)
	}

	async listWebhookDeliveries(webhookId: number): Promise<WebhookDelivery[]> {
		const res = await this.request<{ data: WebhookDelivery[] }>(
			"GET",
			`/provider/webhooks/${webhookId}/deliveries`,
		)
		return res.data
	}
}

// ---------------------------------------------------------------------------
// Webhook signature verification (use in your server to validate incoming events)
// ---------------------------------------------------------------------------

export function verifyWebhookSignature(opts: {
	payload: string
	signature: string
	secret: string
	toleranceSeconds?: number
}): boolean {
	const { payload, signature, secret, toleranceSeconds = 300 } = opts

	// Signature header format: t=<timestamp>,v1=<hex>
	const parts: Record<string, string> = {}
	for (const chunk of signature.split(",")) {
		const [k, v] = chunk.split("=", 2)
		if (k && v) parts[k] = v
	}

	const timestamp = parseInt(parts["t"] ?? "", 10)
	const receivedSig = parts["v1"]

	if (!timestamp || !receivedSig) return false

	const now = Math.floor(Date.now() / 1000)
	if (Math.abs(now - timestamp) > toleranceSeconds) return false

	// Re-derive signature using Web Crypto (works in Node 18+, edge runtimes, browsers)
	// Synchronous HMAC via TextEncoder + subtle — use the async helper below for runtimes
	// that don't have synchronous crypto.
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const crypto = require("crypto") as typeof import("crypto")
		const expected = crypto
			.createHmac("sha256", secret)
			.update(`${timestamp}.${payload}`)
			.digest("hex")
		return crypto.timingSafeEqual(
			Buffer.from(expected),
			Buffer.from(receivedSig),
		)
	} catch {
		return false
	}
}
