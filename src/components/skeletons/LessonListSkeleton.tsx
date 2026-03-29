import React from "react"

const LessonListSkeleton: React.FC = () => {
	return (
		<aside className="glass-card flex flex-col h-full rounded-[2.5rem] border border-white/10 p-6 min-h-[400px]">
			<div className="h-7 bg-white/10 rounded-lg w-1/3 mb-6 animate-pulse" />

			<div className="mb-8">
				<div className="flex justify-between mb-2">
					<div className="h-4 bg-white/5 rounded-full w-16 animate-pulse" />
					<div className="h-4 bg-white/5 rounded-full w-12 animate-pulse" />
				</div>
				<div className="h-2 w-full bg-white/10 rounded-full" />
			</div>

			<div className="space-y-3 flex-1">
				{[1, 2, 3, 4, 5].map((i) => (
					<div
						key={i}
						className="flex items-start gap-3 p-3 rounded-2xl border border-white/5 bg-white/[0.02]"
					>
						<div className="mt-1 w-6 h-6 rounded-full bg-white/10 animate-pulse shrink-0" />
						<div className="h-4 bg-white/5 rounded-full w-3/4 mt-2 animate-pulse" />
					</div>
				))}
			</div>
		</aside>
	)
}

export { LessonListSkeleton }
