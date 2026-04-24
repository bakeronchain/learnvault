import { Link } from "react-router-dom"
import styles from "./ComingSoon.module.css" // optional

interface ComingSoonProps {
	title: string
	issueUrl?: string
}

export function ComingSoon({ title, issueUrl }: ComingSoonProps) {
	return (
		<div className="max-w-2xl mx-auto p-8 text-center">
			<div className="mb-8">
				{/* LearnVault rocket 🚀 */}
				<pre className="text-2xl md:text-4xl font-mono text-gray-400 mb-4">
					{"🚀\n /_\\\n |o| \n  | \n / \\"}
				</pre>
			</div>

			<h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">
				{title}
			</h1>

			<p className="text-xl text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
				This page is under construction. We're building something awesome for
				the LearnVault community!
			</p>

			<div className="space-y-4">
				<p className="text-lg text-gray-500">Stay tuned for updates 📚✨</p>

				{issueUrl && (
					<Link
						to={issueUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg transition-colors duration-200"
					>
						View open issues →
					</Link>
				)}
			</div>
		</div>
	)
}
