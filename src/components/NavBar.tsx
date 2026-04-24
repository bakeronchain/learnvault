import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { NavLink } from "react-router-dom"
import { NotificationBell } from "./NotificationBell"
import { ReputationBadge } from "./ReputationBadge"
import { WalletButton } from "./WalletButton"

export default function NavBar() {
	const [menuOpen, setMenuOpen] = useState(false)
	const menuId = useId()
	const { t } = useTranslation()
	const token = localStorage.getItem("auth_token") ?? undefined

	const navLinks = [
		{ to: "/courses", label: t("nav.learn") },
		{ to: "/dao", label: t("nav.dao") },
		{ to: "/leaderboard", label: t("nav.leaderboard") },
		{ to: "/donor", label: "Donor" },
		{ to: "/treasury", label: t("nav.treasury") },
	]

	return (
		<header className="fixed top-0 left-0 w-full z-50 px-4 sm:px-6 py-4">
			<div className="relative max-w-7xl mx-auto glass rounded-2xl border border-white/5 py-3 px-4 sm:px-8 flex items-center justify-between shadow-2xl backdrop-blur-xl">
				<NavLink
					to="/"
					className="flex items-center gap-2 sm:gap-3 group shrink-0"
					aria-label="LearnVault home"
				>
					<div className="w-8 h-8 bg-linear-to-br from-brand-cyan to-brand-blue rounded-lg flex items-center justify-center font-black text-[10px] shadow-lg shadow-brand-cyan/20 group-hover:scale-110 transition-transform">
						LV
					</div>
					<span className="text-xl font-black tracking-tighter text-gradient">
						LEARNVAULT
					</span>
				</NavLink>

				<nav
					id={menuId}
					aria-label="Primary"
					className={`${menuOpen ? "flex" : "hidden"} md:flex absolute md:relative top-full left-0 w-full md:w-auto mt-4 md:mt-0 flex-col md:flex-row glass md:bg-transparent rounded-2xl p-6 md:p-0 gap-2 md:gap-8 border border-white/5 md:border-none shadow-2xl md:shadow-none animate-in fade-in slide-in-from-top-4 md:animate-none`}
				>
					{navLinks.map(({ to, label }) => (
						<NavLink
							key={to}
							to={to}
							onClick={() => setMenuOpen(false)}
							className={({ isActive }) => `
								px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all
								${
									isActive
										? "text-brand-cyan bg-brand-cyan/5 shadow-[0_0_20px_rgba(0,210,255,0.1)]"
										: "text-white/70 hover:text-white hover:bg-white/5"
								}
							`}
						>
							{label}
						</NavLink>
					))}
				</nav>

				<div className="flex items-center gap-3 md:gap-4">
					<ReputationBadge
						className="hidden sm:inline-flex shrink-0"
						size="sm"
						showBalance
					/>
					<NotificationBell token={token} />
					<div className="hidden sm:block scale-90">
						<WalletButton />
					</div>
					<button
						type="button"
						onClick={() => setMenuOpen((current) => !current)}
						className="md:hidden w-10 h-10 glass flex items-center justify-center rounded-xl text-white/70 hover:text-white transition-colors border border-white/10"
						aria-controls={menuId}
						aria-expanded={menuOpen}
						aria-label={
							menuOpen ? "Close navigation menu" : "Open navigation menu"
						}
					>
						<div className="w-5 flex flex-col gap-1" aria-hidden="true">
							<span
								className={`h-0.5 bg-current rounded-full transition-all ${menuOpen ? "rotate-45 translate-y-1.5" : ""}`}
							/>
							<span
								className={`h-0.5 bg-current rounded-full transition-all ${menuOpen ? "opacity-0" : ""}`}
							/>
							<span
								className={`h-0.5 bg-current rounded-full transition-all ${menuOpen ? "-rotate-45 -translate-y-1.5" : ""}`}
							/>
						</div>
					</button>
				</div>
			</div>
		</header>
	)
}
