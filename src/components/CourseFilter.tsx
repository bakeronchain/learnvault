import React from "react"
import { useTranslation } from "react-i18next"

export const DIFFICULTY_OPTIONS = [
	{ label: "All Levels", value: "" },
	{ label: "Beginner", value: "beginner" },
	{ label: "Intermediate", value: "intermediate" },
	{ label: "Advanced", value: "advanced" },
] as const

export const TRACK_OPTIONS = [
	{ label: "All Tracks", value: "" },
	{ label: "Web3", value: "web3" },
	{ label: "DeFi", value: "defi" },
	{ label: "Smart Contracts", value: "smart-contracts" },
	{ label: "Stellar", value: "stellar" },
] as const

export interface CourseTrackOption {
	label: string
	value: string
}

export interface CourseLanguageOption {
	label: string
	value: string
}

export const CONTENT_LANGUAGE_OPTIONS: readonly CourseLanguageOption[] = [
	{ label: "es", value: "es" },
	{ label: "fr", value: "fr" },
	{ label: "sw", value: "sw" },
]

interface CourseFilterProps {
	search: string
	onSearchChange: (value: string) => void
	difficulty: string
	onDifficultyChange: (value: string) => void
	track: string
	trackOptions?: readonly CourseTrackOption[]
	onTrackChange: (value: string) => void
	language?: string
	languageOptions?: readonly CourseLanguageOption[]
	onLanguageChange?: (value: string) => void
	onClear: () => void
	hasActiveFilters: boolean
}

export const CourseFilter: React.FC<CourseFilterProps> = ({
	search,
	onSearchChange,
	difficulty,
	onDifficultyChange,
	track,
	trackOptions = TRACK_OPTIONS,
	onTrackChange,
	language = "",
	languageOptions = CONTENT_LANGUAGE_OPTIONS,
	onLanguageChange,
	onClear,
	hasActiveFilters,
}) => {
	const { t } = useTranslation()
	return (
		<div className="mb-10 space-y-4">
			{/* Search input */}
			<div className="relative">
				<svg
					className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
					aria-hidden="true"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
					/>
				</svg>
				<input
					type="search"
					placeholder="Search courses by title or description…"
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
					className="w-full glass-card rounded-2xl border border-white/10 pl-11 pr-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:border-brand-cyan/40 bg-transparent transition-colors"
					aria-label="Search courses"
				/>
			</div>

			{/* Filter pills + clear */}
			<div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
				{/* Difficulty */}
				<div
					className="flex items-center gap-2 flex-wrap w-full sm:w-auto"
					role="group"
					aria-label="Filter by difficulty"
				>
					{DIFFICULTY_OPTIONS.map((opt) => (
						<button
							key={opt.value || "all-levels"}
							type="button"
							onClick={() => onDifficultyChange(opt.value)}
							aria-pressed={difficulty === opt.value}
							className={`w-full sm:w-auto px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border transition-all ${
								difficulty === opt.value
									? "bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan"
									: "bg-white/5 border-white/10 text-white/55 hover:border-white/25 hover:text-white/80"
							}`}
						>
							{opt.label}
						</button>
					))}
				</div>

				<div
					className="w-px h-5 bg-white/10 hidden sm:block"
					aria-hidden="true"
				/>

				{/* Track */}
				<div
					className="flex items-center gap-2 flex-wrap w-full sm:w-auto"
					role="group"
					aria-label="Filter by track"
				>
					{trackOptions.map((opt) => (
						<button
							key={opt.value || "all-tracks"}
							type="button"
							onClick={() => onTrackChange(opt.value)}
							aria-pressed={track === opt.value}
							className={`w-full sm:w-auto px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border transition-all ${
								track === opt.value
									? "bg-brand-purple/10 border-brand-purple/40 text-brand-purple"
									: "bg-white/5 border-white/10 text-white/55 hover:border-white/25 hover:text-white/80"
							}`}
						>
							{opt.label}
						</button>
					))}
				</div>

				{onLanguageChange ? (
					<>
						<div
							className="w-px h-5 bg-white/10 hidden sm:block"
							aria-hidden="true"
						/>
						{/* Content language */}
						<div
							className="flex items-center gap-2 flex-wrap w-full sm:w-auto"
							role="group"
							aria-label={t(
								"catalogueLanguageFilterLabel",
								"Filter by lesson language",
							)}
						>
							<button
								type="button"
								onClick={() => onLanguageChange("")}
								aria-pressed={language === ""}
								className={`w-full sm:w-auto px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border transition-all ${
									language === ""
										? "bg-brand-emerald/10 border-brand-emerald/40 text-brand-emerald"
										: "bg-white/5 border-white/10 text-white/55 hover:border-white/25 hover:text-white/80"
								}`}
							>
								{t("catalogueLanguageFilterAll", "All languages")}
							</button>
							{languageOptions.map((opt) => (
								<button
									key={opt.value}
									type="button"
									onClick={() => onLanguageChange(opt.value)}
									aria-pressed={language === opt.value}
									className={`w-full sm:w-auto px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border transition-all ${
										language === opt.value
											? "bg-brand-emerald/10 border-brand-emerald/40 text-brand-emerald"
											: "bg-white/5 border-white/10 text-white/55 hover:border-white/25 hover:text-white/80"
									}`}
								>
									{opt.label}
								</button>
							))}
						</div>
					</>
				) : null}

				{/* Clear */}
				{hasActiveFilters && (
					<button
						type="button"
						onClick={onClear}
						className="w-full sm:w-auto sm:ml-auto px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-white/50 border border-white/10 hover:border-white/30 hover:text-white/80 transition-all"
					>
						Clear ×
					</button>
				)}
			</div>
		</div>
	)
}
