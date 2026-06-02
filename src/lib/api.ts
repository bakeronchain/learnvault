import {
	clearAuthSession,
	getAuthToken,
	getRefreshToken,
	setAuthSession,
} from "../util/auth"

const readEnv = (...keys: string[]): string => {
	for (const key of keys) {
		const value = (import.meta.env as Record<string, unknown>)[key]
		if (typeof value === "string" && value.trim().length > 0) {
			return value.trim().replace(/\/$/, "")
		}
	}

	return ""
}

export const API_URL = readEnv(
	"VITE_API_URL",
	"VITE_SERVER_URL",
	"PUBLIC_API_URL",
	"PUBLIC_SERVER_URL",
)

export function buildApiUrl(path: string): string {
	if (/^https?:\/\//.test(path)) {
		return path
	}

	return `${API_URL}${path}`
}

export function createAuthHeaders(headers?: HeadersInit): Headers {
	const merged = new Headers(headers)
	const token = getAuthToken()

	if (token) {
		merged.set("Authorization", `Bearer ${token}`)
	}

	return merged
}

let refreshInFlight: Promise<boolean> | null = null

async function attemptRefresh(): Promise<boolean> {
	const refreshToken = getRefreshToken()
	if (!refreshToken) return false

	try {
		const response = await fetch(buildApiUrl("/api/auth/refresh"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken }),
		})
		const payload = (await response.json().catch(() => ({}))) as {
			token?: string
			refreshToken?: string
		}
		if (!response.ok || !payload.token || !payload.refreshToken) {
			clearAuthSession()
			return false
		}
		setAuthSession(payload.token, payload.refreshToken)
		return true
	} catch {
		clearAuthSession()
		return false
	}
}

export async function apiFetchJson<T>(
	path: string,
	options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
	const { auth = false, headers, ...init } = options
	const request = () =>
		fetch(buildApiUrl(path), {
			...init,
			headers: auth ? createAuthHeaders(headers) : headers,
		})

	let response = await request()

	if (auth && response.status === 401) {
		if (!refreshInFlight) {
			refreshInFlight = attemptRefresh().finally(() => {
				refreshInFlight = null
			})
		}
		const refreshed = await refreshInFlight
		if (refreshed) {
			response = await request()
		}
	}

	const payload = (await response.json().catch(() => ({}))) as T & {
		error?: string
	}

	if (!response.ok) {
		throw new Error(payload.error || `Request failed for ${path}`)
	}

	return payload
}
