import React from "react"

interface PaginationProps {
	page: number
	totalPages: number
	onPageChange: (newPage: number) => void
}

const Pagination: React.FC<PaginationProps> = ({
	page,
	totalPages,
	onPageChange,
}) => {
	if (totalPages <= 1) return null

	const handlePrev = () => page > 1 && onPageChange(page - 1)
	const handleNext = () => page < totalPages && onPageChange(page + 1)

	const getPageNumbers = () => {
		const pages: (number | string)[] = []
		const delta = 2

		for (let i = 1; i <= totalPages; i++) {
			if (
				i === 1 ||
				i === totalPages ||
				(i >= page - delta && i <= page + delta)
			) {
				pages.push(i)
			} else if (pages[pages.length - 1] !== "...") {
				pages.push("...")
			}
		}
		return pages
	}

	return (
		<div className="flex items-center justify-between mt-8 px-2">
			<span className="text-xs text-white/30 font-medium">
				Page {page} of {totalPages}
			</span>

			<div className="flex items-center gap-3">
				{/* Prev Button */}
				<button
					onClick={handlePrev}
					disabled={page === 1}
					className="px-5 py-2 glass rounded-xl border border-white/10 text-xs font-black uppercase tracking-widest 
                     text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
				>
					← Prev
				</button>

				{/* Page Numbers */}
				<div className="flex items-center gap-1.5">
					{getPageNumbers().map((item, idx) => (
						<React.Fragment key={idx}>
							{item === "..." ? (
								<span className="px-3 py-2 text-white/40">…</span>
							) : (
								<button
									onClick={() => onPageChange(item as number)}
									className={`min-w-[44px] h-10 rounded-xl border text-xs font-black uppercase tracking-widest transition-all active:scale-[0.97]
                    ${
											item === page
												? "bg-brand-cyan text-black border-brand-cyan shadow-lg shadow-brand-cyan/30"
												: "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
										}`}
								>
									{item}
								</button>
							)}
						</React.Fragment>
					))}
				</div>

				<button
					onClick={handleNext}
					disabled={page === totalPages}
					className="px-5 py-2 glass rounded-xl border border-white/10 text-xs font-black uppercase tracking-widest 
                     text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
				>
					Next →
				</button>
			</div>

			<div className="w-20" />
		</div>
	)
}

export default Pagination
