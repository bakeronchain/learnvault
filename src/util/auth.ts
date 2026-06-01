export function getAuthToken() {
	return (
		localStorage.getItem("authToken") ||
		localStorage.getItem("auth_token") ||
		""
	)
}

export function getRefreshToken() {
	return (
		localStorage.getItem("refreshToken") ||
		localStorage.getItem("refresh_token") ||
		""
	)
}

export function setAuthSession(token: string, refreshToken?: string) {
	localStorage.setItem("authToken", token)
	localStorage.setItem("auth_token", token)
	if (refreshToken) {
		localStorage.setItem("refreshToken", refreshToken)
		localStorage.setItem("refresh_token", refreshToken)
	}
}

export function clearAuthSession() {
	localStorage.removeItem("authToken")
	localStorage.removeItem("auth_token")
	localStorage.removeItem("refreshToken")
	localStorage.removeItem("refresh_token")
}
