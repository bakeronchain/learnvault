import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Clock } from "lucide-react"
import { EmptyState as StateEmpty } from "./states/emptyState"
import {
	useSearch,
	getRecentSearches,
	addRecentSearch,
	clearRecentSearches,
	type SearchResults,
} from "../hooks/useSearch"

/** Splits text on <mark>/</mark> markers so snippets render safely — no dangerouslySetInnerHTML. */
function HighlightedSnippet({ snippet }: { snippet: string }): React.ReactElement {
	const parts = useMemo(
		() => snippet.split(/(<mark>|<\/mark>)/g).filter((p) => p !== ""),
		[snippet]
	)
	let marked = false
	return (
		<span className="text-white/50 text-xs line-clamp-2">
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
		</span>
	)
}

const GlobalSearch: React.FC = () => {
	const { t } = useTranslation()
	const [query, setQuery] = useState("")
	const [debouncedQuery, setDebouncedQuery] = useState("")
	const [isOpen, setIsOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(-1)
	const navigate = useNavigate()
	const containerRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const listboxId = "global-search-listbox"
	const abortControllerRef = useRef<AbortController | null>(null)
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const [recentSearches, setRecentSearches] = useState<string[]>([])
	const showRecents = isOpen && query.trim().length === 0 && recentSearches.length > 0

	const trimmed = debouncedQuery.trim().slice(0, 200)
	const { data: results = [], isLoading } = useSearch(trimmed.length >= 2 ? trimmed : "")
	const searching = isLoading && trimmed.length >= 2

	useEffect(() => {
		setRecentSearches(getRecentSearches())
	}, [isOpen])

	// Debounce search query
	useEffect(() => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current)
		}

		debounceTimerRef.current = setTimeout(() => {
			setDebouncedQuery(query)
		}, 300)

		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current)
			}
		}
	}, [query])

	// Cancel in-flight requests when query changes
	useEffect(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort()
		}
		abortControllerRef.current = new AbortController()

		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort()
			}
		}
	}, [debouncedQuery])

	const grouped = useMemo(() => {
		const groups = new Map<string, SearchResults[]>()
		for (const row of results) {
			const list = groups.get(row.type) ?? []
			list.push(row)
			groups.set(row.type, list)
		}
		return Array.from(groups.entries())
	}, [results])

	const flat = useMemo(() => results.slice(0, 8), [results])

	// Reset active index whenever results change
	useEffect(() => {
		setActiveIndex(-1)
	}, [results.length, debouncedQuery])

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target as Node)
			) {
				setIsOpen(false)
				setActiveIndex(-1)
			}
		}
		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [])

	const handleSelect = useCallback(
		(link?: string) => {
			setQuery("")
			setIsOpen(false)
			setActiveIndex(-1)
			void navigate(link ?? `/search?q=${encodeURIComponent(debouncedQuery)}`)
		},
		[navigate, debouncedQuery]
	)

	const commitSearch = useCallback(
		(value: string) => {
			addRecentSearch(value)
			setRecentSearches(getRecentSearches())
			navigate(`/search?q=${encodeURIComponent(value)}`)
			setIsOpen(false)
			inputRef.current?.blur()
		},
		[navigate]
	)

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Escape") {
			setIsOpen(false)
			setActiveIndex(-1)
			return
		}
		if (!isOpen) return

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault()
				setActiveIndex((prev) => (prev < flat.length - 1 ? prev + 1 : 0))
				break
			case "ArrowUp":
				e.preventDefault()
				setActiveIndex((prev) => (prev > 0 ? prev - 1 : flat.length - 1))
				break
			case "Enter":
				e.preventDefault()
				if (activeIndex >= 0 && activeIndex < flat.length) {
					addRecentSearch(trimmed)
					handleSelect(flat[activeIndex].url)
				} else if (trimmed.length >= 2) {
					commitSearch(trimmed)
				}
				break
		}
	}

	const showDropdown = isOpen && (query.trim().length >= 2 || showRecents)

	return (
		<div className="relative" ref={containerRef}>
			<div className="relative group">
				<input
					ref={inputRef}
					type="text"
					role="combobox"
					aria-expanded={showDropdown}
					aria-autocomplete="list"
					aria-controls={showDropdown ? listboxId : undefined}
					aria-activedescendant={
						activeIndex >= 0 ? `search-option-${activeIndex}` : undefined
					}
					placeholder={t("search.placeholder")}
					aria-label={t("search.placeholder")}
					maxLength={200}
					className="glass border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm w-[180px] focus:w-[240px] focus:border-brand-cyan/40 focus:outline-none transition-all"
					value={query}
					onChange={(e) => {
						setQuery(e.target.value)
						setIsOpen(true)
					}}
					onFocus={() => setIsOpen(true)}
					onKeyDown={handleKeyDown}
				/>
			</div>

			{showDropdown && (
				<div
					id={listboxId}
					role="listbox"
					aria-label={t("search.results_aria")}
					className="absolute top-full mt-2 left-0 right-0 glass-card border border-white/10 rounded-2xl overflow-hidden shadow-2xl min-w-[300px] max-h-[70vh] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200"
				>
					{showRecents ? (
						<div className="py-1" role="group" aria-label={t("search.recent_aria")}>
							<div className="flex items-center justify-between px-4 py-2">
								<span className="text-xs font-black uppercase tracking-widest text-white/30">
									{t("search.recent_title")}
								</span>
								<button
									className="text-xs text-white/40 hover:text-white/80 transition-colors"
									onClick={() => {
										clearRecentSearches()
										setRecentSearches([])
									}}
								>
									{t("search.recent_clear")}
								</button>
							</div>
							{recentSearches.map((recent) => (
								<button
									key={recent}
									role="option"
									aria-selected={false}
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => commitSearch(recent)}
									className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
								>
									<Clock className="h-3.5 w-3.5 text-white/30" />
									<span className="text-sm text-white/70">{recent}</span>
								</button>
							))}
						</div>
					) : searching ? (
						<div className="p-4 space-y-2" aria-busy="true">
							{[0, 1, 2].map((i) => (
								<div key={i} data-testid={`search-skeleton-${i}`} className="h-10 rounded-lg bg-white/5 animate-pulse" />
							))}
						</div>
					) : flat.length > 0 ? (
						<div className="flex flex-col">
							{grouped.map(([type, rows]) => (
								<div key={type}>
									<span className="block px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-white/25">
										{t(`search.type_${type}`)}
									</span>
									{rows.slice(0, 4).map((row) => {
										const index = flat.indexOf(row)
										return (
											<button
												key={`${row.type}-${row.id}`}
												id={`search-option-${index}`}
												role="option"
												aria-selected={index === activeIndex}
												onClick={() => {
													addRecentSearch(trimmed)
													handleSelect(row.url)
												}}
												onMouseEnter={() => setActiveIndex(index)}
												className={`w-full flex flex-col gap-0.5 px-4 py-3 text-left border-b border-white/5 last:border-none transition-colors group ${
													index === activeIndex ? "bg-white/10" : "hover:bg-white/5"
												}`}
											>
												<span className="font-bold text-sm text-white/80 group-hover:text-white transition-colors">
													{row.title}
												</span>
												<HighlightedSnippet snippet={row.snippet} />
											</button>
										)
									})}
								</div>
							))}
							<button
								className="w-full px-4 py-3 text-center text-sm font-bold text-brand-cyan hover:bg-white/5 transition-colors"
								onClick={() => commitSearch(trimmed)}
							>
								{t("search.see_all")}
							</button>
						</div>
					) : (
						<div className="p-4">
							<StateEmpty
								icon="🔎"
								title={t("search.no_results", { query: debouncedQuery })}
								description={t("search.no_results_hint")}
								ctaLabel={t("search.browse_courses")}
								ctaTo="/learn"
							/>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

export default GlobalSearch
