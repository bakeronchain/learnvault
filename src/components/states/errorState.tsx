import { AlertCircle } from "lucide-react"

const SUPPORT_EMAIL = "support@learnvault.app"

interface ErrorStateProps {
	message?: string
	onRetry?: () => void
	requestId?: string
	showContactSupport?: boolean
}

export function ErrorState({
	message = "An unexpected error occurred. Please try again.",
	onRetry,
	requestId,
	showContactSupport,
}: ErrorStateProps) {
	const subject = encodeURIComponent("LearnVault Support Request")
	const bodyText = [
		`Error: ${message}`,
		requestId ? `Request ID: ${requestId}` : "",
		"",
		"Steps to reproduce:",
		"[please describe what you were doing]",
	]
		.filter(Boolean)
		.join("\n")
	const mailtoLink = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${encodeURIComponent(bodyText)}`

	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<AlertCircle className="h-12 w-12 text-destructive mb-4" />
			<h3 className="text-lg font-semibold">Failed to load</h3>
			<p className="text-sm text-muted-foreground mt-1 max-w-sm">{message}</p>
			{requestId && (
				<p className="mt-2 text-xs text-muted-foreground/60 font-mono">
					Request ID: {requestId}
				</p>
			)}
			<div className="mt-4 flex flex-wrap gap-3 justify-center">
				{onRetry && (
					<button
						onClick={onRetry}
						className="px-4 py-2 text-sm border border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer hover:text-black hover:border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
					>
						Try again
					</button>
				)}
				{showContactSupport && (
					<a
						href={mailtoLink}
						className="px-4 py-2 text-sm border border-input rounded-md transition-colors text-muted-foreground hover:text-black hover:border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
					>
						Contact support
					</a>
				)}
			</div>
		</div>
	)
}
