import { driver } from "driver.js"
import "driver.js/dist/driver.css"
import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useWallet } from "../hooks/useWallet"

const TOUR_COMPLETE_KEY = "learnvault:tour-complete"

export const OnboardingTour = () => {
	const { address } = useWallet()
	const location = useLocation()
	const navigate = useNavigate()

	useEffect(() => {
		const isTourComplete = localStorage.getItem(TOUR_COMPLETE_KEY)
		if (isTourComplete) return

		// Small delay to ensure DOM is settled
		const timer = setTimeout(() => {
			const driverObj = driver({
				showProgress: true,
				allowClose: true,
				overlayColor: "rgba(0, 0, 0, 0.75)",
				steps: [
					{
						element: "#connect-wallet-button",
						popover: {
							title: "Connect Your Wallet",
							description:
								"Start by connecting your Stellar wallet to track your progress on-chain.",
							side: "bottom",
							align: "start",
						},
					},
					{
						element: "#courses-nav-link",
						popover: {
							title: "Explore Courses",
							description:
								"Browse our catalog of courses and find a learning track that interests you.",
							side: "bottom",
							align: "start",
						},
					},
					{
						element: "#course-card-0",
						popover: {
							title: "Start Learning",
							description:
								"Pick a course and jump into your first lesson to start earning rewards.",
							side: "top",
							align: "center",
						},
					},
					{
						element: "#mark-complete-button",
						popover: {
							title: "Complete Milestones",
							description:
								"Finish your lesson and mark it as complete to record your achievement on the blockchain.",
							side: "top",
							align: "center",
						},
					},
				],
				onDestroyed: () => {
					// We only mark it complete if they reached the end or explicitly closed it?
					// Actually, the request says "Show tour only on first visit".
					// So once they interact with it, we can mark it.
					// To be safe, we mark it complete so it doesn't annoy them again.
					localStorage.setItem(TOUR_COMPLETE_KEY, "true")
				},
			})

			// Logic to trigger steps based on location and state
			if (location.pathname === "/" && !address) {
				if (document.querySelector("#connect-wallet-button")) {
					driverObj.drive(0)
				}
			} else if (location.pathname === "/" && address) {
				if (document.querySelector("#courses-nav-link")) {
					driverObj.drive(1)
				}
			} else if (location.pathname === "/courses") {
				if (document.querySelector("#course-card-0")) {
					driverObj.drive(2)
				}
			} else if (location.pathname.includes("/lessons/")) {
				if (document.querySelector("#mark-complete-button")) {
					driverObj.drive(3)
				}
			}
		}, 1000)

		return () => clearTimeout(timer)
	}, [address, location.pathname])

	return null
}
