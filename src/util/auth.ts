export function getAuthToken() {
	return (
		localStorage.getItem("authToken") ||
		localStorage.getItem("auth_token") ||
		""
	)
}

export function clearAuthToken() {
	localStorage.removeItem("authToken")
	localStorage.removeItem("auth_token")
}
