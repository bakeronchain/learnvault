import { Badge, Button, Card, Icon } from "@stellar/design-system"
import { useMemo, useState } from "react"
import { BookingModal } from "../components/mentor-booking/BookingModal"
import { type Mentor, useMentors } from "../hooks/useMentorBooking"

const MentorDirectory = () => {
	const { mentors, loading, error, refetch } = useMentors()
	const [skillFilter, setSkillFilter] = useState("")
	const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null)

	const allSkills = useMemo(() => {
		const set = new Set<string>()
		mentors.forEach((m) => m.skills.forEach((s) => set.add(s)))
		return Array.from(set).sort()
	}, [mentors])

	const filteredMentors = useMemo(() => {
		if (!skillFilter) return mentors
		return mentors.filter((m) => m.skills.includes(skillFilter))
	}, [mentors, skillFilter])

	return (
		<div className="min-h-screen py-20 px-6">
			<div className="max-w-6xl mx-auto">
				<header className="mb-16 text-center">
					<h1 className="text-6xl font-black mb-6 tracking-tighter text-gradient">
						Mentor Directory
					</h1>
					<p className="text-xl text-white/50 max-w-2xl mx-auto font-medium">
						Book 1:1 sessions with vetted mentors. Payment is held in escrow and
						released only after the session is complete.
					</p>
				</header>

				{error && (
					<div className="glass-card rounded-2xl p-6 mb-8 border border-red-500/20">
						<p className="text-red-400 font-medium">{error}</p>
						<Button
							variant="secondary"
							size="md"
							onClick={() => void refetch()}
							className="mt-4"
						>
							Retry
						</Button>
					</div>
				)}

				<div className="flex flex-wrap gap-3 mb-12 justify-center">
					<button
						className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
							!skillFilter
								? "bg-brand-cyan text-black"
								: "glass-card text-white/60 hover:text-white"
						}`}
						onClick={() => setSkillFilter("")}
					>
						All skills
					</button>
					{allSkills.map((skill) => (
						<button
							key={skill}
							className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
								skillFilter === skill
									? "bg-brand-cyan text-black"
									: "glass-card text-white/60 hover:text-white"
							}`}
							onClick={() => setSkillFilter(skill)}
						>
							{skill}
						</button>
					))}
				</div>

				{loading ? (
					<div className="text-center py-20 text-white/40 font-bold uppercase tracking-widest animate-pulse">
						Loading Mentors...
					</div>
				) : filteredMentors.length === 0 ? (
					<div className="text-center py-20 text-white/40 font-medium">
						No mentors found. Be the first to register!
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
						{filteredMentors.map((mentor) => (
							<div
								key={mentor.address}
								className="iridescent-border p-px rounded-[2.5rem] transition-all hover:-translate-y-2"
							>
								<div className="glass-card p-8 rounded-[2.5rem] h-full flex flex-col">
									<div className="flex justify-between items-start mb-6">
										<div className="flex flex-wrap gap-2">
											{mentor.skills.map((skill) => (
												<Badge key={skill} variant="secondary" size="md">
													{skill}
												</Badge>
											))}
										</div>
										<Icon.UserCircle size="md" className="text-brand-cyan" />
									</div>
									<h3 className="text-xl font-black mb-2">
										{mentor.address.slice(0, 4)}...
										{mentor.address.slice(-4)}
									</h3>
									{mentor.bio && (
										<p className="text-white/50 mb-6 flex-1 leading-relaxed">
											{mentor.bio}
										</p>
									)}
									<div className="mt-auto pt-6 border-t border-white/5 flex justify-between items-center">
										<span className="text-brand-purple font-bold">
											${mentor.hourly_rate}/hr
										</span>
										<Button
											variant="primary"
											size="md"
											onClick={() => setSelectedMentor(mentor)}
										>
											Book Session
										</Button>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{selectedMentor && (
				<BookingModal
					mentor={selectedMentor}
					onClose={() => setSelectedMentor(null)}
				/>
			)}
		</div>
	)
}

export default MentorDirectory
