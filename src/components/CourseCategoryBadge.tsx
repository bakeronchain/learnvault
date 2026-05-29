import React from "react"

export type CourseCategory =
	| "web3"
	| "frontend"
	| "backend"
	| "smart-contract"
	| "design"
	| "defi"
	| "stellar"
	| string

interface CategoryConfig {
	label: string
	className: string
}

const CATEGORY_MAP: Record<string, CategoryConfig> = {
	web3: {
		label: "Web3",
		className: "bg-brand-cyan/15 text-brand-cyan border-brand-cyan/30",
	},
	frontend: {
		label: "Frontend",
		className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
	},
	backend: {
		label: "Backend",
		className: "bg-brand-purple/15 text-brand-purple border-brand-purple/30",
	},
	"smart-contract": {
		label: "Smart Contract",
		className: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
	},
	"smart-contracts": {
		label: "Smart Contracts",
		className: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
	},
	design: {
		label: "Design",
		className: "bg-pink-500/15 text-pink-400 border-pink-500/30",
	},
	defi: {
		label: "DeFi",
		className: "bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30",
	},
	stellar: {
		label: "Stellar",
		className: "bg-sky-500/15 text-sky-400 border-sky-500/30",
	},
	// difficulty levels used by CourseCard
	beginner: {
		label: "Beginner",
		className: "bg-brand-emerald/10 text-brand-emerald border-brand-emerald/20",
	},
	intermediate: {
		label: "Intermediate",
		className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
	},
	advanced: {
		label: "Advanced",
		className: "bg-red-500/10 text-red-500 border-red-500/20",
	},
}

const FALLBACK_CONFIG: Omit<CategoryConfig, "label"> = {
	className: "bg-white/10 text-white/60 border-white/20",
}

export function getCategoryConfig(category: string): CategoryConfig {
	const key = category.toLowerCase().replace(/\s+/g, "-")
	return CATEGORY_MAP[key] ?? { label: category, ...FALLBACK_CONFIG }
}

interface CourseCategoryBadgeProps {
	category: string
	className?: string
}

const CourseCategoryBadge: React.FC<CourseCategoryBadgeProps> = ({
	category,
	className = "",
}) => {
	const config = getCategoryConfig(category)
	return (
		<span
			className={`px-3 py-1 rounded-full text-xs font-semibold border ${config.className} ${className}`.trim()}
		>
			{config.label}
		</span>
	)
}

export default CourseCategoryBadge
