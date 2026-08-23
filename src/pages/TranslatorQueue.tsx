import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { useTranslatorQueue } from "../hooks/useCourseTranslations"

const LANGUAGES = ["es", "fr", "sw"] as const

export default function TranslatorQueue() {
	const { t } = useTranslation()
	const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>("sw")
	const { data, isLoading, error } = useTranslatorQueue(language)

	return (
		<div className="mx-auto max-w-5xl px-6 py-12 text-white">
			<header className="mb-8 flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-black tracking-tight text-gradient">
						{t("translatorQueueTitle", "Translator Queue")}
					</h1>
					<p className="mt-1 text-white/60">
						{t(
							"translatorQueueDescription",
							"Untranslated lessons, submissions awaiting publish, and translations flagged stale because their English source changed. Check back here to find out if something you translated has gone stale — there is no notification for this yet.",
						)}
					</p>
				</div>
				<select
					value={language}
					onChange={(event) =>
						setLanguage(event.target.value as (typeof LANGUAGES)[number])
					}
					aria-label={t("translatorLanguageAriaLabel", "Target language")}
					className="rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white"
				>
					{LANGUAGES.map((code) => (
						<option key={code} value={code} className="text-black">
							{code}
						</option>
					))}
				</select>
			</header>

			{error ? (
				<p className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
					{error instanceof Error ? error.message : String(error)}
				</p>
			) : isLoading ? (
				<p className="text-white/50">{t("translatorLoading", "Loading…")}</p>
			) : (
				<div className="grid gap-6 md:grid-cols-3">
					<QueueColumn
						title={t("translatorQueueUntranslated", "Untranslated")}
						emptyLabel={t("translatorQueueEmpty", "Nothing here.")}
					>
						{(data?.untranslated ?? []).map((item) => (
							<Link
								key={`${item.courseSlug}-${item.orderIndex}`}
								to={`/translate/${item.courseSlug}?lang=${language}`}
								className="block rounded-xl border border-white/10 bg-white/5 p-3 text-sm hover:border-white/25"
							>
								<p className="font-bold">{item.lessonTitle}</p>
								<p className="text-xs text-white/40">{item.courseTitle}</p>
							</Link>
						))}
					</QueueColumn>

					<QueueColumn
						title={t("translatorQueueInReview", "In review")}
						emptyLabel={t("translatorQueueEmpty", "Nothing here.")}
					>
						{(data?.inReview ?? []).map((item) => (
							<Link
								key={`${item.kind}-${item.courseSlug}-${item.orderIndex ?? "course"}`}
								to={`/translate/${item.courseSlug}?lang=${language}`}
								className="block rounded-xl border border-brand-cyan/25 bg-brand-cyan/5 p-3 text-sm hover:border-brand-cyan/40"
							>
								<p className="font-bold">{item.title}</p>
								<p className="text-xs text-white/40">
									{item.kind === "course"
										? t("translatorKindCourse", "Course metadata")
										: t("translatorKindLesson", "Lesson")}
								</p>
							</Link>
						))}
					</QueueColumn>

					<QueueColumn
						title={t("translatorQueueStale", "Stale")}
						emptyLabel={t("translatorQueueEmpty", "Nothing here.")}
					>
						{(data?.stale ?? []).map((item) => (
							<Link
								key={`${item.kind}-${item.courseSlug}-${item.orderIndex ?? "course"}`}
								to={`/translate/${item.courseSlug}?lang=${language}`}
								className="block rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-sm hover:border-amber-500/40"
							>
								<p className="font-bold">{item.title}</p>
								<p className="text-xs text-white/40">
									{item.kind === "course"
										? t("translatorKindCourse", "Course metadata")
										: t("translatorKindLesson", "Lesson")}
								</p>
							</Link>
						))}
					</QueueColumn>
				</div>
			)}
		</div>
	)
}

const QueueColumn: React.FC<{
	title: string
	emptyLabel: string
	children: React.ReactNode
}> = ({ title, emptyLabel, children }) => {
	const hasChildren = React.Children.count(children) > 0
	return (
		<section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
			<h2 className="mb-3 text-sm font-black uppercase tracking-widest text-white/50">
				{title}
			</h2>
			<div className="space-y-2">
				{hasChildren ? (
					children
				) : (
					<p className="text-sm text-white/30">{emptyLabel}</p>
				)}
			</div>
		</section>
	)
}
