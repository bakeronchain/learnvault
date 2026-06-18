import { useEffect, useState } from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
	const [isMobile, setIsMobile] = useState<boolean>(false)

	useEffect(() => {
		const check = () => {
			const width = window.innerWidth
			const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches
			setIsMobile(width < MOBILE_BREAKPOINT || hasCoarsePointer)
		}

		check()
		window.addEventListener("resize", check)
		return () => window.removeEventListener("resize", check)
	}, [])

	return isMobile
}
