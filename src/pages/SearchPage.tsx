import { Icon } from "@stellar/design-system"
import React, { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { EmptyState } from "../components/states/emptyState"
import { ErrorState } from "../components/states/errorState"
import {
	useSearch,
	type SearchResults,
} from "../hooks/useSearch"

const TYPE_FILTERS = ["course", "lesson", "wiki", "forum", "profile"] as const

/** Splits snippet text on <mark> markers — safe rendering, no raw HTML. */
function HighlightedSnippet({ snippet }: { snippet: string }): React.ReactElement {
	const parts = useMemo(
		() => snippet.split(/(<mark>|<\/mark>)/g).filter((p) => p !== ""),
		[snippet]
	)
	let marked = false
	return (
		<p className="text-sm text-white/50">
			{parts.map((part, i) => {
				if (part === "<mark>") {
					marked = true
					return null
				}
				if (part === "</mark>") {
					marked = false
					return null
				}
				return marked ? (
					<mark key={i} className="bg-brand-cyan/30 text-white rounded px-0.5">
						{part}
					</mark>
				) : (
					<React.Fragment key={i}>{part}</React.Fragment>
				)
			})}
		</p>
	)
}

export default function SearchPage() {
	const { t } = useTranslation()
	const [searchParams, setSearchParams] = useSearchParams()
	const query = (searchParams.get("q") ?? "").trim()
	const activeType = searchParams.get("type") ?? ""
	const cursor = searchParams.get("cursor") ?? undefined

	const { data: results = [], nextCursor, isLoading, isError } = useSearch(query, activeType || undefined, cursor)

	const [history, setHistory] = useState<SearchResults[]>([])
	// Accumulate pages for "load more" so cursors chain without losing results.
	useEffect(() => {
		if (!cursor) setHistory([])
	}, [query, activeType])
	useEffect(() => {
		if (cursor && results.length > 0) {
			setHistory((prev) => [...prev, ...results])
		}
	}, [results]) // eslint-disable-line react-hooks/exhaustive-deps

	const visible = cursor && history.length > 0 ? [...history] : results

	function updateParam(key: string, value: string | null) {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev)
				if (value === null || value === "") next.delete(key)
				else next.set(key, value)
				if (key !== "cursor") next.delete("cursor") // filter change resets pagination
				return next
			},
			{ replace: false }
		)
	}

	return (
		<div className="max-w-3xl mx-auto px-4 py-10">
			<h1 className="text-2xl font-bold mb-1">{t("search.page_title")}</h1>
			{query && (
				<p className="text-white/50 text-sm mb-6">
					{t("search.page_results_for", { query })}
				</p>
			)}

			<div className="flex flex-wrap gap-2 mb-8" role="group" aria-label={t("search.type_filter_aria")}>
				<button
					className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
						activeType === "" ? "bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40" : "glass text-white/50 border border-white/10 hover:text-white"
					}`}
					onClick={() => updateParam("type", null)}
				>
					{t("search.filter_all")}
				</button>
				{TYPE_FILTERS.map((type) => (
					<button
						key={type}
						className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
							activeType === type
								? "bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40"
								: "glass text-white/50 border border-white/10 hover:text-white"
						}`}
						aria-pressed={activeType === type}
						onClick={() => updateParam("type", type)}
					>
						{t(`search.type_${type}`)}
					</button>
				))}
			</div>

			{isError ? (
				<ErrorState
					message={t("search.error_description")}
					onRetry={() => updateParam("retry", String(Date.now()))}
				/>
			) : isLoading && visible.length === 0 ? (
				<div className="space-y-3" aria-busy="true" data-testid="search-page-loading">
					{[0, 1, 2, 3].map((i) => (
						<div key={i} data-testid={`search-skeleton-${i}`} className="h-16 rounded-xl bg-white/5 animate-pulse" />
					))}
				</div>
			) : visible.length === 0 ? (
				query.length >= 2 ? (
					<EmptyState
						icon="🔎"
						title={t("search.no_results", { query })}
						description={t("search.no_results_hint")}
						ctaLabel={t("search.browse_courses")}
						ctaTo="/learn"
					/>
				) : (
					<EmptyState icon="🔎" title={t("search.page_empty_title")} description={t("search.no_results_hint")} />
				)
			) : (
				<>
					<ul className="flex flex-col gap-4" role="list">
						{visible.map((row) => (
							<li key={`${row.type}-${row.id}`}>
								<a
									href={row.url}
									className="block glass-card border border-white/10 rounded-xl p-4 hover:border-brand-cyan/30 transition-colors group"
								>
									<span className="text-[10px] font-black uppercase tracking-widest text-white/25 group-hover:text-brand-cyan/60 transition-colors">
										{t(`search.type_${row.type}`)}
									</span>
									<div className="flex items-center gap-2 mt-0.5">
										<span className="font-bold text-white/90">{row.title}</span>
										<Icon.ChevronRight size="xs" className="text-white/20" />
									</div>
									<HighlightedSnippet snippet={row.snippet} />
								</a>
							</li>
						))}
					</ul>

					{nextCursor && (
						<button
							className="w-full mt-6 py-3 glass border border-white/10 rounded-xl font-bold text-sm hover:border-brand-cyan/40 transition-colors"
							onClick={() => updateParam("cursor", nextCursor)}
						>
							{t("search.load_more")}
						</button>
					)}
				</>
			)}
		</div>
	)
}
