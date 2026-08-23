import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import ReactMarkdown from "react-markdown"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { useCourseDetail } from "../hooks/useCourses"
import {
	useCourseTranslationEditor,
	useGlossary,
	useLessonTranslationEditor,
	usePublishCourseTranslation,
	usePublishLessonTranslation,
	useSaveCourseTranslationDraft,
	useSaveLessonTranslationDraft,
	useSubmitCourseTranslationForReview,
	useSubmitLessonTranslationForReview,
} from "../hooks/useCourseTranslations"

const TRANSLATABLE_LANGUAGES = ["es", "fr", "sw"] as const

type Target = { kind: "course" } | { kind: "lesson"; orderIndex: number }

const StatusPill: React.FC<{ status?: string; isStale?: boolean }> = ({
	status,
	isStale,
}) => {
	const { t } = useTranslation()
	if (!status) {
		return (
			<span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white/50">
				{t("translatorStatusUntranslated", "Untranslated")}
			</span>
		)
	}
	const label = isStale
		? t("translatorStatusStale", "Stale")
		: status === "published"
			? t("translatorStatusPublished", "Published")
			: status === "in_review"
				? t("translatorStatusInReview", "In review")
				: t("translatorStatusDraft", "Draft")
	const colorClass = isStale
		? "border-amber-500/40 bg-amber-500/10 text-amber-200"
		: status === "published"
			? "border-brand-emerald/40 bg-brand-emerald/10 text-brand-emerald"
			: status === "in_review"
				? "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan"
				: "border-white/15 bg-white/5 text-white/60"
	return (
		<span
			className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${colorClass}`}
		>
			{label}
		</span>
	)
}

export default function TranslatorWorkspace() {
	const { t } = useTranslation()
	const { courseId } = useParams<{ courseId: string }>()
	const [searchParams, setSearchParams] = useSearchParams()
	const languageCode = searchParams.get("lang") ?? "sw"
	const [target, setTarget] = useState<Target>({ kind: "course" })

	const { course, isLoading: isLoadingCourse } = useCourseDetail(courseId)
	const { data: glossary } = useGlossary(courseId)

	const handleLanguageChange = (value: string) => {
		setSearchParams((prev) => {
			const next = new URLSearchParams(prev)
			next.set("lang", value)
			return next
		})
	}

	return (
		<div className="mx-auto max-w-6xl px-6 py-12 text-white">
			<header className="mb-8 flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-black tracking-tight text-gradient">
						{t("translatorWorkspaceTitle", "Translator Workspace")}
					</h1>
					<p className="mt-1 text-white/60">
						{isLoadingCourse
							? t("translatorLoadingCourse", "Loading course…")
							: (course?.title ?? courseId)}
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Link
						to="/translate"
						className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white/60 hover:border-white/25 hover:text-white"
					>
						{t("translatorBackToQueue", "Back to queue")}
					</Link>
					<select
						value={languageCode}
						onChange={(event) => handleLanguageChange(event.target.value)}
						aria-label={t("translatorLanguageAriaLabel", "Target language")}
						className="rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white"
					>
						{TRANSLATABLE_LANGUAGES.map((code) => (
							<option key={code} value={code} className="text-black">
								{code}
							</option>
						))}
					</select>
				</div>
			</header>

			<div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
				<aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
					<p className="mb-3 text-xs font-black uppercase tracking-widest text-white/40">
						{t("translatorContentList", "Content")}
					</p>
					<nav className="space-y-1">
						<button
							type="button"
							onClick={() => setTarget({ kind: "course" })}
							className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors ${
								target.kind === "course"
									? "bg-brand-cyan/15 text-brand-cyan"
									: "text-white/60 hover:bg-white/5 hover:text-white"
							}`}
						>
							{t("translatorCourseMetadata", "Course title & description")}
						</button>
						{(course?.lessons ?? []).map((lesson) => (
							<button
								key={lesson.id}
								type="button"
								onClick={() =>
									setTarget({ kind: "lesson", orderIndex: lesson.order })
								}
								className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors ${
									target.kind === "lesson" && target.orderIndex === lesson.order
										? "bg-brand-cyan/15 text-brand-cyan"
										: "text-white/60 hover:bg-white/5 hover:text-white"
								}`}
							>
								{lesson.order}. {lesson.title}
							</button>
						))}
					</nav>

					{glossary && glossary.length > 0 ? (
						<div className="mt-6 border-t border-white/10 pt-4">
							<p className="mb-2 text-xs font-black uppercase tracking-widest text-white/40">
								{t("translatorGlossaryTitle", "Do not translate")}
							</p>
							<p className="mb-3 text-[11px] text-white/40">
								{t(
									"translatorGlossaryHint",
									"These protocol terms must survive a translation untouched.",
								)}
							</p>
							<ul className="space-y-2">
								{glossary.map((term) => (
									<li key={term.id} className="text-xs">
										<span className="font-bold text-brand-purple">
											{term.term}
										</span>
										{term.note ? (
											<span className="block text-white/40">{term.note}</span>
										) : null}
									</li>
								))}
							</ul>
						</div>
					) : null}
				</aside>

				{target.kind === "course" ? (
					<CourseTranslationPane
						courseId={courseId}
						languageCode={languageCode}
						sourceFallback={{
							title: course?.title ?? "",
							description: course?.description ?? "",
						}}
					/>
				) : (
					<LessonTranslationPane
						courseId={courseId}
						languageCode={languageCode}
						orderIndex={target.orderIndex}
					/>
				)}
			</div>
		</div>
	)
}

const useMarkdownPreview = () => {
	const [showPreview, setShowPreview] = useState(false)
	return { showPreview, setShowPreview }
}

const EditorActions: React.FC<{
	status?: string
	onSaveDraft: () => void
	onSubmit: () => void
	onPublish: () => void
	isSaving: boolean
	isSubmitting: boolean
	isPublishing: boolean
	error: string | null
}> = ({
	status,
	onSaveDraft,
	onSubmit,
	onPublish,
	isSaving,
	isSubmitting,
	isPublishing,
	error,
}) => {
	const { t } = useTranslation()
	return (
		<div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
			<button
				type="button"
				onClick={onSaveDraft}
				disabled={isSaving}
				className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:border-white/30 disabled:opacity-50"
			>
				{isSaving
					? t("translatorSaving", "Saving…")
					: t("translatorSaveDraft", "Save draft")}
			</button>
			<button
				type="button"
				onClick={onSubmit}
				disabled={isSubmitting || status === "in_review"}
				className="rounded-xl border border-brand-cyan/40 bg-brand-cyan/10 px-4 py-2 text-sm font-bold text-brand-cyan hover:bg-brand-cyan/20 disabled:opacity-50"
			>
				{isSubmitting
					? t("translatorSubmitting", "Submitting…")
					: t("translatorSubmitForReview", "Submit for review")}
			</button>
			<button
				type="button"
				onClick={onPublish}
				disabled={isPublishing || status !== "in_review"}
				title={t(
					"translatorPublishHint",
					"Only course-admins can publish — never a translator, regardless of language.",
				)}
				className="rounded-xl border border-brand-emerald/40 bg-brand-emerald/10 px-4 py-2 text-sm font-bold text-brand-emerald hover:bg-brand-emerald/20 disabled:opacity-50"
			>
				{isPublishing
					? t("translatorPublishing", "Publishing…")
					: t("translatorPublish", "Publish")}
			</button>
			{error ? (
				<p className="w-full text-sm text-red-300" role="alert">
					{error}
				</p>
			) : null}
		</div>
	)
}

const CourseTranslationPane: React.FC<{
	courseId: string | undefined
	languageCode: string
	sourceFallback: { title: string; description: string }
}> = ({ courseId, languageCode, sourceFallback }) => {
	const { t } = useTranslation()
	const { data, isLoading } = useCourseTranslationEditor(courseId, languageCode)
	const saveDraft = useSaveCourseTranslationDraft(courseId, languageCode)
	const submit = useSubmitCourseTranslationForReview(courseId, languageCode)
	const publish = usePublishCourseTranslation(courseId, languageCode)

	const [title, setTitle] = useState("")
	const [description, setDescription] = useState("")
	const [initialized, setInitialized] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const source = data?.source ?? sourceFallback

	if (data && !initialized) {
		setTitle(data.translation?.title ?? "")
		setDescription(data.translation?.description ?? "")
		setInitialized(true)
	}

	const runMutation = async (fn: () => Promise<unknown>) => {
		setError(null)
		try {
			await fn()
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong")
		}
	}

	return (
		<section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
			<div className="mb-4 flex items-center justify-between">
				<h2 className="text-lg font-black">
					{t("translatorCourseMetadata", "Course title & description")}
				</h2>
				<StatusPill
					status={data?.translation?.status}
					isStale={data?.translation?.isStale}
				/>
			</div>
			{isLoading ? (
				<p className="text-white/50">{t("translatorLoading", "Loading…")}</p>
			) : (
				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<p className="mb-2 text-xs font-black uppercase tracking-widest text-white/40">
							{t("translatorSourcePane", "English source")}
						</p>
						<div className="rounded-2xl border border-white/10 bg-black/20 p-4">
							<p className="font-bold">{source.title}</p>
							<p className="mt-2 text-sm text-white/60">{source.description}</p>
						</div>
					</div>
					<div>
						<p className="mb-2 text-xs font-black uppercase tracking-widest text-white/40">
							{t("translatorTranslationPane", "Translation ({{lang}})", {
								lang: languageCode,
							})}
						</p>
						<input
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							placeholder={t("translatorTitlePlaceholder", "Translated title")}
							className="mb-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
						/>
						<textarea
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							placeholder={t(
								"translatorDescriptionPlaceholder",
								"Translated description",
							)}
							rows={6}
							className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
						/>
					</div>
				</div>
			)}
			<EditorActions
				status={data?.translation?.status}
				isSaving={saveDraft.isPending}
				isSubmitting={submit.isPending}
				isPublishing={publish.isPending}
				error={error}
				onSaveDraft={() =>
					void runMutation(() => saveDraft.mutateAsync({ title, description }))
				}
				onSubmit={() => void runMutation(() => submit.mutateAsync())}
				onPublish={() => void runMutation(() => publish.mutateAsync())}
			/>
		</section>
	)
}

const LessonTranslationPane: React.FC<{
	courseId: string | undefined
	languageCode: string
	orderIndex: number
}> = ({ courseId, languageCode, orderIndex }) => {
	const { t } = useTranslation()
	const { data, isLoading } = useLessonTranslationEditor(
		courseId,
		orderIndex,
		languageCode,
	)
	const saveDraft = useSaveLessonTranslationDraft(
		courseId,
		orderIndex,
		languageCode,
	)
	const submit = useSubmitLessonTranslationForReview(
		courseId,
		orderIndex,
		languageCode,
	)
	const publish = usePublishLessonTranslation(
		courseId,
		orderIndex,
		languageCode,
	)
	const { showPreview, setShowPreview } = useMarkdownPreview()

	const [title, setTitle] = useState("")
	const [content, setContent] = useState("")
	const [loadedKey, setLoadedKey] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const stateKey = `${courseId}:${orderIndex}:${languageCode}`
	if (data && loadedKey !== stateKey) {
		setTitle(data.translation?.title ?? "")
		setContent(data.translation?.content ?? "")
		setLoadedKey(stateKey)
	}

	const runMutation = async (fn: () => Promise<unknown>) => {
		setError(null)
		try {
			await fn()
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong")
		}
	}

	const source = useMemo(() => data?.source, [data])

	return (
		<section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
			<div className="mb-4 flex items-center justify-between">
				<h2 className="text-lg font-black">
					{t("translatorLessonPane", "Lesson {{order}}", { order: orderIndex })}
				</h2>
				<StatusPill
					status={data?.translation?.status}
					isStale={data?.translation?.isStale}
				/>
			</div>
			{isLoading ? (
				<p className="text-white/50">{t("translatorLoading", "Loading…")}</p>
			) : (
				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<p className="mb-2 text-xs font-black uppercase tracking-widest text-white/40">
							{t("translatorSourcePane", "English source")}
						</p>
						<div className="max-h-[28rem] overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-4">
							<p className="mb-3 font-bold">{source?.title}</p>
							<div className="prose prose-invert prose-sm max-w-none">
								<ReactMarkdown>{source?.content ?? ""}</ReactMarkdown>
							</div>
						</div>
					</div>
					<div>
						<div className="mb-2 flex items-center justify-between">
							<p className="text-xs font-black uppercase tracking-widest text-white/40">
								{t("translatorTranslationPane", "Translation ({{lang}})", {
									lang: languageCode,
								})}
							</p>
							<button
								type="button"
								onClick={() => setShowPreview(!showPreview)}
								className="text-xs font-bold uppercase tracking-widest text-brand-cyan"
							>
								{showPreview
									? t("translatorEdit", "Edit")
									: t("translatorPreview", "Preview")}
							</button>
						</div>
						<input
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							placeholder={t("translatorTitlePlaceholder", "Translated title")}
							className="mb-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm"
						/>
						{showPreview ? (
							<div className="h-[24rem] overflow-y-auto rounded-xl border border-white/15 bg-black/20 p-4 prose prose-invert prose-sm max-w-none">
								<ReactMarkdown>{content}</ReactMarkdown>
							</div>
						) : (
							<textarea
								value={content}
								onChange={(event) => setContent(event.target.value)}
								placeholder={t(
									"translatorContentPlaceholder",
									"Translated markdown content",
								)}
								rows={16}
								className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 font-mono text-sm"
							/>
						)}
					</div>
				</div>
			)}
			<EditorActions
				status={data?.translation?.status}
				isSaving={saveDraft.isPending}
				isSubmitting={submit.isPending}
				isPublishing={publish.isPending}
				error={error}
				onSaveDraft={() =>
					void runMutation(() => saveDraft.mutateAsync({ title, content }))
				}
				onSubmit={() => void runMutation(() => submit.mutateAsync())}
				onPublish={() => void runMutation(() => publish.mutateAsync())}
			/>
		</section>
	)
}
