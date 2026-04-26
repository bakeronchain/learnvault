import { Card, Icon, Badge } from "@stellar/design-system"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

type CommunityEvent = {
	id: string
	title: string
	description: string
	date: string
	type: "hackathon" | "study_group" | "workshop"
	link: string
}

const Community: React.FC = () => {
	const { t } = useTranslation()
	const [events, setEvents] = useState<CommunityEvent[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		fetch("/api/community/events")
			.then((res) => res.json())
			.then((data) => {
				setEvents(data)
				setLoading(false)
			})
			.catch((err) => {
				console.error("Failed to fetch events", err)
				setLoading(false)
			})
	}, [])

	return (
		<div className="min-h-screen py-20 px-6">
			<div className="max-w-6xl mx-auto">
				<header className="mb-16 text-center">
					<h1 className="text-6xl font-black mb-6 tracking-tighter text-gradient">
						Community Events
					</h1>
					<p className="text-xl text-white/50 max-w-2xl mx-auto font-medium">
						Join hackathons, study groups, and workshops to master the Stellar
						ecosystem.
					</p>
				</header>

				{loading ? (
					<div className="text-center py-20 text-white/40 font-bold uppercase tracking-widest animate-pulse">
						Loading Events...
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
						{events.map((event) => (
							<div
								key={event.id}
								className="iridescent-border p-[1px] rounded-[2.5rem] transition-all hover:-translate-y-2"
							>
								<div className="glass-card p-8 rounded-[2.5rem] h-full flex flex-col">
									<div className="flex justify-between items-start mb-6">
										<Badge variant="secondary" size="md">
											{event.type.replace("_", " ")}
										</Badge>
										<Icon.Calendar size="md" className="text-brand-cyan" />
									</div>
									<h3 className="text-2xl font-black mb-4">{event.title}</h3>
									<p className="text-white/50 mb-8 flex-1 leading-relaxed">
										{event.description}
									</p>
									<div className="mt-auto pt-6 border-t border-white/5 flex justify-between items-center">
										<span className="text-brand-purple font-bold">
											{new Date(event.date).toLocaleDateString()}
										</span>
										<a
											href={event.link}
											target="_blank"
											rel="noopener noreferrer"
											className="text-brand-cyan font-black uppercase tracking-widest hover:underline flex items-center gap-2"
										>
											Join <Icon.ArrowUpRight size="sm" />
										</a>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

export default Community
