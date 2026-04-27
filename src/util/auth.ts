export function getAuthToken() {
	return (
		localStorage.getItem("authToken") ||
		localStorage.getItem("auth_token") ||
		""
	)
}
