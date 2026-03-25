import React from "react"

const CourseCardSkeleton: React.FC = () => {
	return (
		<div className="glass-card flex flex-col h-full rounded-[2.5rem] border border-white/5 overflow-hidden relative">
			{/* Decorative background glow placeholder */}
			<div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-[50px] pointer-events-none" />

			{/* Cover Image Placeholder */}
			<div className="relative h-48 w-full bg-white/5 border-b border-white/5 overflow-hidden">
				<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_2s_infinite] -translate-x-full" />
				
				{/* Difficulty Badge placeholder */}
				<div className="absolute top-5 left-5">
					<div className="w-20 h-6 bg-white/10 rounded-full animate-pulse" />
				</div>
			</div>

			{/* Card Content */}
			<div className="p-8 flex flex-col flex-1 relative z-10">
				<div className="h-8 bg-white/10 rounded-lg w-3/4 mb-4 animate-pulse" />
				<div className="space-y-2 mb-6 flex-1">
					<div className="h-4 bg-white/5 rounded-full w-full animate-pulse" />
					<div className="h-4 bg-white/5 rounded-full w-5/6 animate-pulse" />
					<div className="h-4 bg-white/5 rounded-full w-4/5 animate-pulse" />
				</div>

				{/* Metrics Row */}
				<div className="flex items-center justify-between py-4 border-t border-white/5 gap-4">
					<div className="w-24 h-4 bg-white/5 rounded-full animate-pulse" />
					<div className="w-20 h-8 bg-white/5 rounded-xl animate-pulse" />
				</div>

				{/* Button */}
				<div className="mt-6">
					<div className="w-full h-14 bg-white/10 rounded-2xl animate-pulse" />
				</div>
			</div>
			
			<style>{`
				@keyframes shimmer {
					100% {
						transform: translateX(100%);
					}
				}
			`}</style>
		</div>
	)
}

export { CourseCardSkeleton }
