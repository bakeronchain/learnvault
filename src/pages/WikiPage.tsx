import { Icon } from "@stellar/design-system"
import React from "react"
import { Helmet } from "react-helmet"
import ReactMarkdown from "react-markdown"
import { useParams, Link } from "react-router-dom"
import { useWikiPage, useWikiPages } from "../hooks/useWiki"

const WikiPage: React.FC = () => {
	const { slug } = useParams<{ slug: string }>()
	const { data: page, isLoading, error } = useWikiPage(slug)
	const { data: allPages } = useWikiPages()

	const otherPagesInCategory =
		allPages?.filter((p) => p.category === page?.category && p.slug !== slug) ??
		[]

	if (isLoading) {
		return (
			<div className="w-full max-w-6xl mx-auto px-6 py-12 animate-pulse">
				<div className="h-8 bg-white/5 rounded w-1/4 mb-4" />
				<div className="h-12 bg-white/5 rounded w-3/4 mb-8" />
				<div className="space-y-4">
					<div className="h-4 bg-white/5 rounded w-full" />
					<div className="h-4 bg-white/5 rounded w-full" />
					<div className="h-4 bg-white/5 rounded w-2/3" />
				</div>
			</div>
		)
	}

	if (error || !page) {
		return (
			<div className="w-full max-w-6xl mx-auto px-6 py-24 text-center">
				<h1 className="text-4xl font-black mb-4">Page not found</h1>
				<p className="text-white/50 mb-8">
					The wiki page you are looking for doesn't exist or has been moved.
				</p>
				<Link to="/wiki" className="text-brand-cyan hover:underline">
					Back to Wiki
				</Link>
			</div>
		)
	}

	return (
		<div className="w-full max-w-6xl mx-auto px-6 py-12">
			<Helmet>
				<title>{page.title} — LearnVault Wiki</title>
			</Helmet>

			<div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12">
				<main className="flex flex-col gap-8">
					<nav className="flex items-center gap-2 text-sm text-white/40">
						<Link
							to="/wiki"
							className="hover:text-brand-cyan transition-colors"
						>
							Wiki
						</Link>
						<Icon.ChevronRight size="xs" />
						<span className="text-white/60">{page.category}</span>
					</nav>

					<h1 className="text-4xl sm:text-5xl font-black tracking-tight">
						{page.title}
					</h1>

					<article className="prose prose-invert prose-brand max-w-none glass-card p-8 md:p-12 rounded-[2.5rem] border border-white/10">
						<ReactMarkdown>{page.content}</ReactMarkdown>
					</article>
				</main>

				<aside className="flex flex-col gap-8">
					<div className="glass-card p-6 rounded-2xl border border-white/5">
						<h3 className="text-xs font-black uppercase tracking-widest text-white/30 mb-4">
							Related in {page.category}
						</h3>
						<div className="flex flex-col gap-3">
							{otherPagesInCategory.length > 0 ? (
								otherPagesInCategory.map((p) => (
									<Link
										key={p.id}
										to={`/wiki/${p.slug}`}
										className="text-sm font-bold text-white/70 hover:text-brand-cyan transition-colors"
									>
										{p.title}
									</Link>
								))
							) : (
								<p className="text-xs text-white/30 italic">
									No other pages in this category.
								</p>
							)}
						</div>
					</div>

					<div className="glass-card p-6 rounded-2xl border border-white/5 bg-brand-cyan/5">
						<h3 className="text-sm font-black mb-2">Need more help?</h3>
						<p className="text-xs text-white/50 mb-4">
							Join our community Discord to chat with other scholars and
							developers.
						</p>
						<a
							href="https://discord.gg/stellar"
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs font-black uppercase tracking-widest text-brand-cyan hover:underline"
						>
							Join Discord ↗
						</a>
					</div>
				</aside>
			</div>
		</div>
	)
}

export default WikiPage
