import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetchJson } from "../lib/api"
import { getAuthToken } from "../util/auth"

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

export default function StudioDraftsPage() {
	const queryClient = useQueryClient()
	const authToken = getAuthToken()
	const [title, setTitle] = useState("")
	const [description, setDescription] = useState("")
	const [difficulty, setDifficulty] = useState("beginner")
	const [notes, setNotes] = useState("")

	const { data, isLoading } = useQuery<DraftListResponse>({
		queryKey: ["studio-drafts"],
		queryFn: () =>
			apiFetchJson<DraftListResponse>("/api/studio/drafts", {
				auth: true,
			}),
			enabled: Boolean(authToken),
	})

	const drafts = useMemo(() => data?.drafts ?? [], [data])

	const createDraft = useMutation({
		mutationFn: (payload: Record<string, unknown>) =>
			apiFetchJson<DraftRecord>("/api/studio/drafts", {
				method: "POST",
				auth: true,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			}),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["studio-drafts"] })
		},
	})

	const submitDraft = useMutation({
		mutationFn: (id: number) =>
			apiFetchJson<DraftRecord>(`/api/studio/drafts/${id}/submit`, {
				method: "POST",
				auth: true,
			}),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["studio-drafts"] })
		},
	})

	const handleCreate = async () => {
		await createDraft.mutateAsync({
			title,
			description,
			difficulty,
			content: { lessons: [] },
		})
		setTitle("")
		setDescription("")
		setDifficulty("beginner")
	}

	return (
		<div className="mx-auto max-w-6xl px-6 py-10 text-white">
			<h1 className="mb-6 text-3xl font-semibold">Trusted Creator Studio</h1>
			<p className="mb-8 max-w-2xl text-sm text-white/70">
				Draft and submit new course proposals once your reputation meets the threshold.
			</p>

			<div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
				<div className="grid gap-4 md:grid-cols-2">
					<label className="flex flex-col gap-2 text-sm">
						<span>Title</span>
						<input
							className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
						/>
					</label>
					<label className="flex flex-col gap-2 text-sm">
						<span>Description</span>
						<textarea
							className="min-h-24 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
						/>
					</label>
					<label className="flex flex-col gap-2 text-sm">
						<span>Difficulty</span>
						<select
							className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"
							value={difficulty}
							onChange={(e) => setDifficulty(e.target.value)}
						>
							<option value="beginner">Beginner</option>
							<option value="intermediate">Intermediate</option>
							<option value="advanced">Advanced</option>
						</select>
					</label>
					<label className="flex flex-col gap-2 text-sm">
						<span>Reviewer notes</span>
						<input
							className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
						/>
					</label>
				</div>
				<button
					className="mt-4 rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium"
					onClick={() => {
						void handleCreate()
					}}
				>
					Create draft
				</button>
			</div>

			<div className="rounded-2xl border border-white/10 bg-white/5 p-6">
				<h2 className="mb-4 text-xl font-semibold">Your drafts</h2>
				{isLoading ? (
					<p className="text-sm text-white/70">Loading drafts…</p>
				) : drafts.length === 0 ? (
					<p className="text-sm text-white/70">No drafts yet.</p>
				) : (
					<div className="space-y-3">
						{drafts.map((draft) => (
							<div
								key={draft.id}
								className="rounded-xl border border-white/10 bg-black/20 p-4"
							>
								<div className="flex items-center justify-between gap-3">
									<div>
										<p className="font-medium">{draft.title}</p>
										<p className="text-sm text-white/70">{draft.description}</p>
									</div>
									<span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide">
										{draft.status}
									</span>
								</div>
								<div className="mt-3 flex gap-2">
									<button
										className="rounded-lg border border-white/10 px-3 py-1.5 text-sm"
										onClick={() => void submitDraft.mutateAsync(draft.id)}
									>
										Submit for review
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
