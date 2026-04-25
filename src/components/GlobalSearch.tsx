import { Icon } from "@stellar/design-system"
import React, { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useCourses } from "../hooks/useCourses"
import { useWikiPages } from "../hooks/useWiki"

const GlobalSearch: React.FC = () => {
	const [query, setQuery] = useState("")
	const [isOpen, setIsOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(-1)
	const navigate = useNavigate()
	const containerRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const listboxId = "global-search-listbox"

	const { courses = [] } = useCourses()
	const { data: wikiPages = [] } = useWikiPages()

	const results =
		query.length >= 2
			? [
					...courses
						.filter(
							(c) =>
								c.title.toLowerCase().includes(query.toLowerCase()) ||
								c.description.toLowerCase().includes(query.toLowerCase()),
						)
						.map((c) => ({
							id: `course-${c.id}`,
							title: c.title,
							category: "Course",
							link: `/courses`,
						})),
					...wikiPages
						.filter(
							(p) =>
								p.title.toLowerCase().includes(query.toLowerCase()) ||
								p.content.toLowerCase().includes(query.toLowerCase()),
						)
						.map((p) => ({
							id: `wiki-${p.id}`,
							title: p.title,
							category: "Wiki",
							link: `/wiki/${p.slug}`,
						})),
				].slice(0, 8)
			: []

	// Reset active index whenever results change
	useEffect(() => {
		setActiveIndex(-1)
	}, [results.length, query])

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

	const handleSelect = (link: string) => {
		setQuery("")
		setIsOpen(false)
		setActiveIndex(-1)
		void navigate(link)
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (!isOpen || results.length === 0) {
			if (e.key === "Escape") {
				setIsOpen(false)
				setActiveIndex(-1)
			}
			return
		}

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault()
				setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
				break
			case "ArrowUp":
				e.preventDefault()
				setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
				break
			case "Enter":
				e.preventDefault()
				if (activeIndex >= 0 && activeIndex < results.length) {
					handleSelect(results[activeIndex].link)
				}
				break
			case "Escape":
				e.preventDefault()
				setIsOpen(false)
				setActiveIndex(-1)
				break
		}
	}

	const showDropdown = isOpen && query.length >= 2

	return (
		<div className="relative" ref={containerRef}>
			<div className="relative group">
				<Icon.SearchMd
					className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-brand-cyan transition-colors"
					size="sm"
				/>
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
					placeholder="Search..."
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
					aria-label="Search results"
					className="absolute top-full mt-2 left-0 right-0 glass-card border border-white/10 rounded-2xl overflow-hidden shadow-2xl min-w-[300px] animate-in fade-in slide-in-from-top-2 duration-200"
				>
					{results.length > 0 ? (
						<div className="flex flex-col">
							{results.map((result, index) => (
								<button
									key={result.id}
									id={`search-option-${index}`}
									role="option"
									aria-selected={index === activeIndex}
									onClick={() => handleSelect(result.link)}
									onMouseEnter={() => setActiveIndex(index)}
									className={`flex items-center justify-between px-4 py-3 text-left border-b border-white/5 last:border-none transition-colors group ${
										index === activeIndex ? "bg-white/10" : "hover:bg-white/5"
									}`}
								>
									<div className="flex flex-col">
										<span className="text-xs font-black uppercase tracking-widest text-white/30 group-hover:text-brand-cyan/50 transition-colors">
											{result.category}
										</span>
										<span className="font-bold text-sm text-white/80 group-hover:text-white transition-colors">
											{result.title}
										</span>
									</div>
									<Icon.ChevronRight size="xs" className="text-white/20" />
								</button>
							))}
						</div>
					) : (
						<div className="p-4 text-center text-xs text-white/40 italic">
							No results for "{query}"
						</div>
					)}
				</div>
			)}
		</div>
	)
}

export default GlobalSearch
