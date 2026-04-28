import { useState } from "react"

type DiffResponse = {
	course_id: string
	order_index: number
	from: {
		version: number
		title: string
		change_summary?: string | null
	}
	to: {
		version: number
		title: string
		change_summary?: string | null
	}
	diff: {
		added_lines: string[]
		removed_lines: string[]
		added_count: number
		removed_count: number
	}
}

export default function LessonVersionDiff() {
	const [courseIdOrSlug, setCourseIdOrSlug] = useState("")
	const [orderIndex, setOrderIndex] = useState("1")
	const [fromVersion, setFromVersion] = useState("1")
	const [toVersion, setToVersion] = useState("2")
	const [apiKey, setApiKey] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [result, setResult] = useState<DiffResponse | null>(null)

	const handleFetchDiff = async () => {
		if (!courseIdOrSlug.trim()) return
		setIsLoading(true)
		setError(null)
		setResult(null)

		try {
			const url = new URL(
				`/api/courses/${encodeURIComponent(courseIdOrSlug.trim())}/lessons/${encodeURIComponent(orderIndex)}/diff`,
				window.location.origin,
			)
			url.searchParams.set("fromVersion", fromVersion)
			url.searchParams.set("toVersion", toVersion)

			const response = await fetch(url.toString(), {
				headers: {
					...(apiKey.trim() ? { "x-api-key": apiKey.trim() } : {}),
				},
			})

			if (!response.ok) {
				const payload = await response.json().catch(() => ({}))
				throw new Error((payload as { error?: string }).error || "Failed to fetch diff")
			}

			const payload = (await response.json()) as DiffResponse
			setResult(payload)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch diff")
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div className="mx-auto max-w-6xl px-6 py-12 text-white">
			<header className="mb-8">
				<h1 className="text-4xl font-black tracking-tight text-gradient">
					Admin Lesson Version Diff
				</h1>
				<p className="mt-2 text-white/60">
					Compare two lesson versions by course and order index.
				</p>
			</header>

			<section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					<input
						value={courseIdOrSlug}
						onChange={(event) => setCourseIdOrSlug(event.target.value)}
						placeholder="Course slug or id"
						className="rounded-xl border border-white/15 bg-black/20 px-3 py-2"
					/>
					<input
						value={orderIndex}
						onChange={(event) => setOrderIndex(event.target.value)}
						placeholder="Lesson order index"
						type="number"
						min="1"
						className="rounded-xl border border-white/15 bg-black/20 px-3 py-2"
					/>
					<input
						value={fromVersion}
						onChange={(event) => setFromVersion(event.target.value)}
						placeholder="From version"
						type="number"
						min="1"
						className="rounded-xl border border-white/15 bg-black/20 px-3 py-2"
					/>
					<input
						value={toVersion}
						onChange={(event) => setToVersion(event.target.value)}
						placeholder="To version"
						type="number"
						min="1"
						className="rounded-xl border border-white/15 bg-black/20 px-3 py-2"
					/>
					<input
						value={apiKey}
						onChange={(event) => setApiKey(event.target.value)}
						placeholder="Admin API key (optional)"
						className="rounded-xl border border-white/15 bg-black/20 px-3 py-2"
					/>
				</div>
				<button
					type="button"
					onClick={() => void handleFetchDiff()}
					className="mt-4 rounded-xl bg-brand-cyan px-4 py-2 text-sm font-black uppercase tracking-widest text-black"
				>
					{isLoading ? "Loading..." : "Compare Versions"}
				</button>
				{error && <p className="mt-3 text-sm text-red-300">{error}</p>}
			</section>

			{result && (
				<section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<h2 className="text-lg font-black">From v{result.from.version}</h2>
							<p className="text-white/70">{result.from.title}</p>
							{result.from.change_summary && (
								<p className="mt-2 text-sm text-white/50">{result.from.change_summary}</p>
							)}
						</div>
						<div>
							<h2 className="text-lg font-black">To v{result.to.version}</h2>
							<p className="text-white/70">{result.to.title}</p>
							{result.to.change_summary && (
								<p className="mt-2 text-sm text-white/50">{result.to.change_summary}</p>
							)}
						</div>
					</div>

					<div className="mt-6 grid gap-4 lg:grid-cols-2">
						<div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/5 p-4">
							<p className="text-sm font-black uppercase tracking-widest text-emerald-300">
								Added lines ({result.diff.added_count})
							</p>
							<pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-emerald-100">
								{result.diff.added_lines.join("\n") || "No added lines."}
							</pre>
						</div>
						<div className="rounded-2xl border border-rose-300/20 bg-rose-400/5 p-4">
							<p className="text-sm font-black uppercase tracking-widest text-rose-300">
								Removed lines ({result.diff.removed_count})
							</p>
							<pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-rose-100">
								{result.diff.removed_lines.join("\n") || "No removed lines."}
							</pre>
						</div>
					</div>
				</section>
			)}
		</div>
	)
}
