import React from "react"
import { Link } from "react-router-dom"
import { courses } from "../data/courses"

const levelStyles: Record<(typeof courses)[number]["level"], string> = {
	Beginner: "bg-brand-emerald/20 text-brand-emerald border-brand-emerald/20",
	Intermediate: "bg-brand-purple/20 text-brand-purple border-brand-purple/20",
	Advanced: "bg-red-500/20 text-red-400 border-red-500/20",
}

const Courses: React.FC = () => {
	return (
		<div className="container mx-auto px-4 py-12">
			<header className="mb-12 text-center">
				<p className="text-sm uppercase tracking-[0.35em] text-brand-cyan/80 mb-4">
					Learning Tracks
				</p>
				<h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">
					Choose a path and start with a focused first lesson.
				</h1>
				<p className="text-gray-400 text-lg max-w-3xl mx-auto leading-relaxed">
					Every LearnVault track is designed to move new learners from setup
					to hands-on progress with a clear first milestone.
				</p>
			</header>

			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
				{courses.map((course) => (
					<article
						key={course.id}
						className="glass-card rounded-[2rem] flex flex-col h-full border border-white/10 overflow-hidden group"
					>
						<div
							className={`h-36 bg-linear-to-br ${course.accentClassName} border-b border-white/10`}
						/>
						<div className="p-6 flex flex-col h-full">
							<div className="flex items-center justify-between mb-4 gap-3">
								<span className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-blue/20 text-brand-cyan border border-brand-cyan/20">
									{course.track}
								</span>
								<span
									className={`px-3 py-1 rounded-full text-xs font-semibold border ${levelStyles[course.level]}`}
								>
									{course.level}
								</span>
							</div>

							<h2 className="text-xl font-bold mb-3 group-hover:text-brand-cyan transition-colors duration-300">
								{course.title}
							</h2>
							<p className="text-white/55 text-sm leading-relaxed mb-5">
								{course.description}
							</p>

							<div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 mb-5">
								<p className="text-xs uppercase tracking-[0.25em] text-white/40">
									First lesson
								</p>
								<p className="mt-2 text-sm font-medium text-white/75">
									{course.firstLesson}
								</p>
							</div>

							<ul className="space-y-2 text-sm text-white/60 mb-6">
								{course.outcomes.map((outcome) => (
									<li key={outcome} className="rounded-xl bg-white/[0.03] px-3 py-2">
										{outcome}
									</li>
								))}
							</ul>

							<div className="mt-auto flex items-center justify-between gap-4 text-sm text-gray-400">
								<span>{course.duration}</span>
								<Link
									to={`/learn?course=${course.id}`}
									className="iridescent-border px-4 py-2 rounded-xl font-semibold text-white hover:scale-105 transition-transform"
								>
									Preview track
								</Link>
							</div>
						</div>
					</article>
				))}
			</div>
		</div>
	)
}

export default Courses
