import { useTranslation } from "react-i18next"
import { LanguageSelector } from "./LanguageSelector"

export default function Footer() {
	const { t } = useTranslation()

	return (
		<footer className="px-6 py-12 mt-20 border-t border-white/5 relative overflow-hidden">
			<div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-linear-to-r from-transparent via-brand-cyan/20 to-transparent" />
			<div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
				<div className="flex flex-col md:flex-row items-center gap-3 opacity-50">
					<div className="w-6 h-6 bg-white/10 rounded flex items-center justify-center font-black text-[8px]">
						LV
					</div>
					<span className="text-xs font-bold tracking-widest uppercase mt-2 md:mt-0">
						LearnVault v1.0
					</span>
				</div>

				<div className="flex flex-wrap justify-center gap-4 md:gap-8 max-w-sm md:max-w-none">
					{[
						{
							label: t("nav.github"),
							href: "https://github.com/bakeronchain/learnvault",
						},
						{
							label: t("nav.twitter"),
							href: "https://twitter.com/LearnVaultDAO",
						},
						{
							label: t("nav.discord"),
							href: "https://discord.gg/learnvault",
						},
					].map((link) => (
						<a
							key={link.label}
							href={link.href}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs font-black uppercase tracking-widest text-white/30 hover:text-brand-cyan transition-colors"
						>
							{link.label}
						</a>
					))}
				</div>

				<div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
					<LanguageSelector />
					<div className="flex items-center gap-2 px-4 py-2 glass rounded-xl border border-white/5">
						<span className="w-1.5 h-1.5 bg-brand-emerald rounded-full animate-pulse" />
						<span className="text-[10px] font-black uppercase tracking-[2px] text-white/40 whitespace-nowrap">
							Powered by Soroban
						</span>
					</div>
				</div>
			</div>
			<p className="text-center text-[10px] text-white/10 mt-12 uppercase tracking-[4px] font-black w-full px-4 break-words">
				© 2024 LearnVault DAO. All Rights Reserved.
			</p>
		</footer>
	)
}
