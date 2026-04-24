import React, { Component, type ErrorInfo, type ReactNode } from "react"
import { generateRequestId } from "../utils/errors"

const SUPPORT_EMAIL = "support@learnvault.app"

interface Props {
	children?: ReactNode
}

interface State {
	hasError: boolean
	error: Error | null
	requestId: string | null
}

export default class ErrorBoundary extends Component<Props, State> {
	public state: State = {
		hasError: false,
		error: null,
		requestId: null,
	}

	public static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error, requestId: generateRequestId() }
	}

	public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("Uncaught error:", error, errorInfo)
	}

	private handleRetry = () => {
		this.setState({ hasError: false, error: null, requestId: null })
	}

	public render() {
		if (this.state.hasError) {
			const { error, requestId } = this.state
			const subject = encodeURIComponent("LearnVault Error Report")
			const bodyText = [
				`Error: ${error?.message ?? "Unknown error"}`,
				`Request ID: ${requestId ?? "N/A"}`,
				"",
				"Steps to reproduce:",
				"[please describe what you were doing]",
			].join("\n")
			const mailtoLink = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${encodeURIComponent(bodyText)}`

			return (
				<div className="flex flex-col items-center justify-center p-8 m-4 border border-red-200/20 bg-red-500/10 rounded-xl h-full min-h-[50vh]">
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
					<p className="text-gray-400 mb-2 text-center max-w-md">
						The application encountered an unexpected error. Try refreshing the
						page — if the problem persists, contact support with the reference
						ID below.
					</p>
					{requestId && (
						<p className="text-xs text-gray-500 font-mono mb-6">
							Ref: {requestId}
						</p>
					)}
					<div className="flex gap-4">
						<button
							onClick={this.handleRetry}
							className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors cursor-pointer"
						>
							Try Again
						</button>
						<a
							href={mailtoLink}
							className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium border border-slate-700 transition-colors"
						>
							Contact Support
						</a>
					</div>
				</div>
			)
		}

		return this.props.children
	}
}
