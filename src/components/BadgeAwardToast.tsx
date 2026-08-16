import { Award, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

interface BadgeAwardToastProps {
	badgeName: string
	badgeType: string
	onDismiss: () => void
}

export function BadgeAwardToast({
	badgeName,
	badgeType,
	onDismiss,
}: BadgeAwardToastProps) {
	const { t } = useTranslation()
	const [isVisible, setIsVisible] = useState(false)

	useEffect(() => {
		// Animate in
		setIsVisible(true)

		// Auto-dismiss after 5 seconds
		const timer = setTimeout(() => {
			setIsVisible(false)
			setTimeout(onDismiss, 300) // Wait for animation
		}, 5000)

		return () => clearTimeout(timer)
	}, [onDismiss])

	const handleDismiss = () => {
		setIsVisible(false)
		setTimeout(onDismiss, 300)
	}

	return (
		<div
			className={`fixed top-4 right-4 z-50 transition-all duration-300 transform ${
				isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
			}`}
		>
			<div className="bg-gradient-to-r from-yellow-400 to-orange-500 dark:from-yellow-600 dark:to-orange-600 text-white rounded-lg shadow-lg p-4 flex items-center gap-3 max-w-sm">
				<div className="flex-shrink-0">
					<Award className="w-8 h-8" />
				</div>
				<div className="flex-1">
					<h4 className="font-semibold text-sm">
						{t("badges.awarded", "Badge Awarded!")}
					</h4>
					<p className="text-sm opacity-90">{badgeName}</p>
				</div>
				<button
					onClick={handleDismiss}
					className="flex-shrink-0 hover:bg-white/20 rounded-full p-1 transition-colors"
					aria-label="Dismiss"
				>
					<X className="w-4 h-4" />
				</button>
			</div>
		</div>
	)
}
