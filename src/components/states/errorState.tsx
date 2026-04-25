import { AlertCircle } from "lucide-react"

interface ErrorStateProps {
	message?: string
	onRetry?: () => void
}

export function ErrorState({
	message = "Something went wrong.",
	onRetry,
}: ErrorStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<AlertCircle className="h-12 w-12 text-destructive mb-4" />
			<h3 className="text-lg font-semibold">Failed to load</h3>
			<p className="text-sm text-muted-foreground mt-1 max-w-sm">{message}</p>
			{onRetry && (
				<button
					onClick={onRetry}
					className="mt-4 px-4 py-2 text-sm border border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer hover:text-black hover:border-gray-300 hover:bg-gray-100  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary   "
				>
					Try again
				</button>
			)}
		</div>
	)
}
