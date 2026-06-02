import { Badge, Icon } from "@stellar/design-system"
import React, { useState } from "react"

import { useMentors, useRequestMentor } from "../hooks/useMentorship"

const MentorshipPanel: React.FC = () => {
	const { data: mentors = [], isLoading } = useMentors()
	const requestMentor = useRequestMentor()
	const [skillsInput, setSkillsInput] = useState("")
	const [submitted, setSubmitted] = useState(false)

	const handleRequest = (e: React.FormEvent) => {
		e.preventDefault()
		const skills = skillsInput
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean)
		if (!skills.length) return
		requestMentor.mutate(skills, {
			onSuccess: () => {
				setSubmitted(true)
				setSkillsInput("")
			},
		})
	}

	return (
		<section className="mt-20">
			<h2 className="text-4xl font-black mb-4 tracking-tighter text-gradient">
				Mentor Matching
			</h2>
			<p className="text-white/50 mb-10 font-medium">
				Connect with experienced scholars who can guide your learning journey.
			</p>

			{isLoading ? (
				<div className="text-center py-10 text-white/40 font-bold uppercase tracking-widest animate-pulse">
					Loading Mentors...
				</div>
			) : mentors.length === 0 ? (
				<p className="text-white/40 mb-10">No mentors available yet.</p>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
					{mentors.map((mentor) => (
						<div
							key={mentor.address}
							className="iridescent-border p-[1px] rounded-[2rem]"
						>
							<div className="glass-card p-6 rounded-[2rem] h-full flex flex-col gap-3">
								<div className="flex items-center gap-2">
									<Icon.User size="sm" className="text-brand-cyan" />
									<span className="font-mono text-sm text-white/60 truncate">
										{mentor.address.slice(0, 8)}…{mentor.address.slice(-4)}
									</span>
								</div>
								<div className="flex flex-wrap gap-2">
									{mentor.skills.map((skill) => (
										<Badge key={skill} variant="secondary" size="sm">
											{skill}
										</Badge>
									))}
								</div>
								<span
									className={`text-xs font-bold uppercase tracking-widest ${mentor.availability ? "text-brand-cyan" : "text-white/30"}`}
								>
									{mentor.availability ? "Available" : "Unavailable"}
								</span>
							</div>
						</div>
					))}
				</div>
			)}

			<div className="iridescent-border p-[1px] rounded-[2rem] max-w-lg">
				<form
					onSubmit={handleRequest}
					className="glass-card p-8 rounded-[2rem] flex flex-col gap-4"
				>
					<h3 className="text-xl font-black">Request a Mentor</h3>
					{submitted && (
						<p className="text-brand-cyan font-bold text-sm">
							Request submitted! A mentor will reach out soon.
						</p>
					)}
					<label className="text-white/60 text-sm font-medium">
						Skills needed{" "}
						<span className="text-white/30">(comma-separated)</span>
					</label>
					<input
						type="text"
						value={skillsInput}
						onChange={(e) => setSkillsInput(e.target.value)}
						placeholder="e.g. Rust, Soroban, DeFi"
						className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-cyan"
						required
					/>
					<button
						type="submit"
						disabled={requestMentor.isPending}
						className="bg-brand-cyan text-black font-black uppercase tracking-widest py-3 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
					>
						{requestMentor.isPending ? "Submitting…" : "Submit Request"}
					</button>
					{requestMentor.isError && (
						<p className="text-red-400 text-sm">
							{requestMentor.error instanceof Error
								? requestMentor.error.message
								: "Failed to submit request"}
						</p>
					)}
				</form>
			</div>
		</section>
	)
}

export default MentorshipPanel
