import { clearAuthToken, getAuthToken } from "../util/auth"

const readEnv = (...keys: string[]): string => {
	for (const key of keys) {
		const value = (import.meta.env as Record<string, unknown>)[key]
		if (typeof value === "string" && value.trim().length > 0) {
			return value.trim().replace(/\/$/, "")
		}
	}

	return ""
}

const API_URL = readEnv(
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

export async function logoutSession(): Promise<void> {
	const token = getAuthToken()

	try {
		if (token && typeof fetch === "function") {
			await fetch(buildApiUrl("/api/auth/logout"), {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})
		}
	} catch {
		// Local logout should still proceed even if the server is unavailable.
	} finally {
		clearAuthToken()
	}
}
