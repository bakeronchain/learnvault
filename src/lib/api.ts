import { getAuthToken } from "../util/auth"
import { generateRequestId } from "../utils/errors"

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

export async function apiFetchJson<T>(
	path: string,
	options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
	const { auth = false, headers, ...init } = options
	const requestId = generateRequestId()
	const baseHeaders = auth
		? createAuthHeaders(headers)
		: new Headers(headers as HeadersInit)
	baseHeaders.set("X-Request-ID", requestId)

	const response = await fetch(buildApiUrl(path), {
		...init,
		headers: baseHeaders,
	})
	const payload = (await response.json().catch(() => ({}))) as T & {
		error?: string
	}

	if (!response.ok) {
		const serverMessage = payload.error || `Request failed for ${path}`
		const err = new Error(`${serverMessage} (ref: ${requestId})`)
		;(err as Error & { requestId: string }).requestId = requestId
		throw err
	}

	return payload
}
