import { useTranslation } from "react-i18next"
import { LanguageSelector } from "./LanguageSelector"

const SOCIAL_LINKS = [
	{
		key: "github" as const,
		href: "https://github.com/bakeronchain/learnvault",
	},
	{
		key: "twitter" as const,
		href: "https://twitter.com/LearnVaultDAO",
	},
	{
		key: "discord" as const,
		href: "https://discord.gg/learnvault",
	},
]

export default function Footer() {
	const { t } = useTranslation()
	const year = new Date().getFullYear()

	return (
		<footer className="mt-24 border-t border-white/5">
			{/* Top accent line */}
			<div className="h-px w-full bg-linear-to-r from-transparent via-brand-cyan/20 to-transparent" />

			<div className="max-w-6xl mx-auto px-6 sm:px-8 py-10">
				<div className="flex flex-col sm:flex-row items-center justify-between gap-8">
					{/* Brand */}
					<div className="flex items-center gap-3 shrink-0">
						<div className="w-7 h-7 bg-linear-to-br from-brand-cyan to-brand-blue rounded-lg flex items-center justify-center font-black text-[9px] shadow-lg shadow-brand-cyan/20">
							LV
						</div>
						<span className="text-sm font-black tracking-widest uppercase text-white/50">
							LearnVault
						</span>
					</div>

					{/* Nav links */}
					<nav
						className="flex items-center gap-6 flex-wrap justify-center"
						aria-label="Footer"
					>
						{SOCIAL_LINKS.map(({ key, href }) => (
							<a
								key={key}
								href={href}
								target="_blank"
								rel="noopener noreferrer"
								className="text-xs font-bold uppercase tracking-widest text-white/30 hover:text-brand-cyan transition-colors"
							>
								{t(`nav.${key}`)}
							</a>
						))}
					</nav>

					{/* Right side: language + Soroban badge */}
					<div className="flex items-center gap-4 shrink-0">
						<LanguageSelector />
						<div className="flex items-center gap-2 px-3 py-1.5 glass rounded-xl border border-white/5">
							<span className="w-1.5 h-1.5 bg-brand-emerald rounded-full animate-pulse shrink-0" />
							<span className="text-[10px] font-black uppercase tracking-[2px] text-white/30 whitespace-nowrap">
								Powered by Soroban
							</span>
						</div>
					</div>
				</div>

				{/* Bottom copyright */}
				<div className="mt-8 pt-6 border-t border-white/5 text-center">
					<p className="text-[11px] text-white/20 uppercase tracking-widest font-semibold">
						© {year} LearnVault DAO. All Rights Reserved.
					</p>
				</div>
			</div>
		</footer>
	)
}
