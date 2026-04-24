import { Icon } from "@stellar/design-system"
import React from "react"
import { Helmet } from "react-helmet"
import { Link } from "react-router-dom"
import { useWikiPages } from "../hooks/useWiki"

const Wiki: React.FC = () => {
	const { data: pages, isLoading } = useWikiPages()

	const categories = pages
		? Array.from(new Set(pages.map((p) => p.category)))
		: []

	return (
		<div className="w-full max-w-6xl mx-auto px-6 py-12">
			<Helmet>
				<title>Wiki — LearnVault Docs</title>
			</Helmet>

			<div className="flex flex-col gap-8">
				<header className="flex flex-col gap-4">
					<div className="flex items-center gap-2 text-brand-cyan mb-2">
						<Icon.BookOpen01 size="md" />
						<span className="text-xs font-black uppercase tracking-widest">
							Documentation
						</span>
					</div>
					<h1 className="text-4xl sm:text-5xl font-black">Knowledge Base</h1>
					<p className="text-white/50 text-lg max-w-2xl">
						Explore guides, tutorials, and deep-dives into Stellar, Soroban, and
						how to make the most of LearnVault.
					</p>
				</header>

				{isLoading ? (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{[1, 2, 3].map((i) => (
							<div
								key={i}
								className="glass-card h-48 animate-pulse rounded-2xl border border-white/5"
							/>
						))}
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
						{categories.map((category) => (
							<section key={category} className="flex flex-col gap-4">
								<h2 className="text-sm font-black uppercase tracking-widest text-white/30 px-2">
									{category}
								</h2>
								<div className="flex flex-col gap-2">
									{pages
										?.filter((p) => p.category === category)
										.map((page) => (
											<Link
												key={page.id}
												to={`/wiki/${page.slug}`}
												className="glass-card p-5 rounded-2xl border border-white/5 hover:border-brand-cyan/30 hover:bg-brand-cyan/5 transition-all group"
											>
												<div className="flex items-center justify-between">
													<span className="font-bold group-hover:text-brand-cyan transition-colors">
														{page.title}
													</span>
													<Icon.ChevronRight
														size="sm"
														className="text-white/20 group-hover:text-brand-cyan transition-colors"
													/>
												</div>
											</Link>
										))}
								</div>
							</section>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

export default Wiki
