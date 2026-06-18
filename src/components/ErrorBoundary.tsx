import React, { Component, type ErrorInfo, type ReactNode } from "react"
import { parseError } from "../util/error"
import { logger } from "../utils/logger"

interface Props {
	children?: ReactNode
}

interface State {
	hasError: boolean
	error: Error | null
	errorId: string | null
}

export default class ErrorBoundary extends Component<Props, State> {
	public state: State = {
		hasError: false,
		error: null,
		errorId: null,
	}

	public static getDerivedStateFromError(error: Error): State {
		// Update state so the next render will show the fallback UI.
		const errorId = Math.random().toString(36).substring(2, 10).toUpperCase()
		return { hasError: true, error, errorId }
	}

	public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		const friendlyMessage = parseError(error)
		console.error(`Uncaught error (${friendlyMessage}):`, error, errorInfo)
	}

	private handleRetry = () => {
		this.setState({ hasError: false, error: null, errorId: null })
	}

	private handleReport = () => {
		// Keep local diagnostics in development until a real reporting service lands.
		logger.info("Error reported:", this.state.error, "ID:", this.state.errorId)
		alert("Error has been reported to the team. Thank you!")
	}

	public render() {
		if (this.state.hasError) {
			const friendlyMessage = this.state.error
				? parseError(this.state.error)
				: "An unexpected error occurred. Please try again."

			const errorId = this.state.errorId || "UNKNOWN"
			const mailtoLink = `mailto:support@learnvault.xyz?subject=Error Report [${errorId}]&body=Message: ${encodeURIComponent(friendlyMessage)}%0D%0AStack: ${encodeURIComponent(this.state.error?.stack || "")}`

			return (
				<div
					className="flex flex-col items-center justify-center p-8 m-4 border border-red-200/20 bg-red-500/10 rounded-xl h-full min-h-[50vh]"
					data-testid="error-boundary"
				>
					<svg
						className="w-12 h-12 text-red-500 mb-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					<h2 className="text-xl font-bold mb-2 text-white">
						Something went wrong
					</h2>
					<p className="text-gray-400 mb-6 text-center max-w-md">
						{friendlyMessage}
					</p>
					{this.state.errorId && (
						<p className="text-xs text-gray-500 font-mono mb-6">
							Ref: {this.state.errorId}
						</p>
					)}
					<div className="flex flex-wrap gap-4 justify-center">
						<button
							type="button"
							onClick={this.handleRetry}
							className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors cursor-pointer"
							data-testid="error-boundary-try-again"
						>
							Try Again
						</button>
						<button
							type="button"
							onClick={() => window.history.back()}
							className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors cursor-pointer"
							data-testid="error-boundary-go-back"
						>
							Go back
						</button>
						<a
							href="/"
							className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
							data-testid="error-boundary-go-home"
						>
							Go Home
						</a>
						<a
							href={mailtoLink}
							className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium border border-slate-700 transition-colors"
						>
							Report Issue
						</a>
					</div>
				</div>
			)
		}

		return this.props.children
	}
}
