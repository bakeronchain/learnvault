import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiFetchJson } from "../lib/api"

interface DraftRecord {
	id: number
	authorAddr: string
	title: string
	description: string | null
	difficulty: string
	status: string
	content: Record<string, unknown>
	reviewNotes: string | null
	createdAt: string
	updatedAt: string
}

interface DraftListResponse {
	drafts: DraftRecord[]
}

export default function StudioDraftReviewPage() {
	const { data, isLoading } = useQuery<DraftListResponse>({
		queryKey: ["studio-drafts-admin"],
		queryFn: () =>
			apiFetchJson<DraftListResponse>("/api/admin/studio/drafts", {
				auth: true,
			}),
	})

	const drafts = useMemo(() => data?.drafts ?? [], [data])
	return (
		<div className="mx-auto max-w-6xl px-6 py-10 text-white">
			<h1 className="mb-6 text-3xl font-semibold">Studio Draft Review</h1>
			{isLoading ? (
				<p className="text-sm text-white/70">Loading review queue…</p>
			) : drafts.length === 0 ? (
				<p className="text-sm text-white/70">Nothing to review.</p>
			) : (
				<div className="space-y-3">
					{drafts.map((draft) => (
						<div
							key={draft.id}
							className="rounded-xl border border-white/10 bg-white/5 p-4"
						>
							<div className="flex items-center justify-between gap-3">
								<div>
									<p className="font-medium">{draft.title}</p>
									<p className="text-sm text-white/70">{draft.authorAddr}</p>
								</div>
								<span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide">
									{draft.status}
								</span>
							</div>
							<p className="mt-3 text-sm text-white/70">{draft.description}</p>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
