import { useEffect, useRef } from "react"
import { getAuthToken } from "../util/auth"

const PENDING_REF_KEY = "learnvault:pending_ref"
const CLAIMED_REF_KEY = "learnvault:claimed_ref"

const MAX_RETRIES = 15
const RETRY_INTERVAL = 1000

export function useReferralClaim(address: string | undefined) {
	const claimedRef = useRef(false)

	useEffect(() => {
		const pending = localStorage.getItem(PENDING_REF_KEY)
		if (!pending || !address) return

		if (claimedRef.current) return
		const claimed = localStorage.getItem(CLAIMED_REF_KEY)
		if (claimed === pending) return

		let cancelled = false
		let retries = 0

		function attemptClaim() {
			if (cancelled) return

			const token = getAuthToken()
			if (!token) {
				retries++
				if (retries < MAX_RETRIES) {
					setTimeout(attemptClaim, RETRY_INTERVAL)
				}
				return
			}

			fetch("/api/referrals/claim", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ code: pending }),
			})
				.then((res) => {
					if (!cancelled) {
						if (res.ok || res.status === 409) {
							localStorage.setItem(CLAIMED_REF_KEY, pending)
							claimedRef.current = true
						}
						localStorage.removeItem(PENDING_REF_KEY)
					}
				})
				.catch(() => {
					if (!cancelled) {
						localStorage.removeItem(PENDING_REF_KEY)
					}
				})
		}

		attemptClaim()

		return () => {
			cancelled = true
		}
	}, [address])
}

export function captureReferralParam() {
	const params = new URLSearchParams(window.location.search)
	const ref = params.get("ref")
	if (ref) {
		localStorage.setItem(PENDING_REF_KEY, ref)
	}
}
