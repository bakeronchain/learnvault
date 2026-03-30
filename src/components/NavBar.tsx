import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { NavLink } from "react-router-dom"
import { ReputationBadge } from "./ReputationBadge"
import { WalletButton } from "./WalletButton"
import { ThemeToggle } from "./ThemeToggle"

export default function NavBar() {
	const [menuOpen, setMenuOpen] = useState(false)
	const mobileMenuId = useId()
	const { t } = useTranslation()

	useEffect(() => {
		if (typeof document === "undefined") return
		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = menuOpen ? "hidden" : previousOverflow
		return () => {
			document.body.style.overflow = previousOverflow
		}
	}, [menuOpen])

	const navLinks = [
		{ to: "/courses", label: t("nav.learn") },
		{ to: "/dao", label: t("nav.dao") },
		{ to: "/leaderboard", label: t("nav.leaderboard") },
		{ to: "/history", label: "Activity" },
		{ to: "/donor", label: "Donor" },
		{ to: "/treasury", label: t("nav.treasury") },
	]

	const closeMenu = () => setMenuOpen(false)

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

				<nav aria-label="Primary" className="hidden md:flex items-center gap-2 lg:gap-6">
					{navLinks.map(({ to, label }) => (
						<NavLink
							key={to}
							to={to}
							className={({ isActive }) =>
								`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
									isActive
										? "text-brand-cyan bg-brand-cyan/5 shadow-[0_0_20px_rgba(0,210,255,0.1)]"
										: "text-slate-700 dark:text-white/70 hover:text-brand-blue dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
								}`
							}
						>
							{label}
						</NavLink>
					))}
				</nav>

				<div className="flex items-center gap-3 md:gap-4">
					<ThemeToggle />
					
					<ReputationBadge
						className="hidden lg:inline-flex shrink-0"
						size="sm"
						showBalance
					/>
					<div className="hidden md:block scale-90 [&_button]:dark:text-black [&_button]:dark:bg-white">
						<WalletButton />
					</div>
					<button
						type="button"
						onClick={() => setMenuOpen((current) => !current)}
						className="md:hidden w-10 h-10 glass flex items-center justify-center rounded-xl text-slate-700 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors border border-white/10"
						aria-controls={mobileMenuId}
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

			<div
				className={`md:hidden ${menuOpen ? "pointer-events-auto" : "pointer-events-none"}`}
			>
				<button
					type="button"
					onClick={closeMenu}
					aria-label="Close mobile menu backdrop"
					className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
						menuOpen ? "opacity-100" : "opacity-0"
					}`}
				/>

				<nav
					id={mobileMenuId}
					aria-label="Mobile primary"
					className={`fixed top-0 right-0 z-50 h-full w-[min(20rem,85vw)] glass border-l border-white/10 shadow-2xl p-6 flex flex-col gap-4 transition-transform duration-300 ${
						menuOpen ? "translate-x-0" : "translate-x-full"
					}`}
				>
					<div className="flex items-center justify-between">
						<span className="text-xs font-black uppercase tracking-[0.25em] text-slate-500 dark:text-white/40">
							Menu
						</span>
						<button
							type="button"
							onClick={closeMenu}
							className="w-9 h-9 rounded-xl border border-white/10 text-slate-700 dark:text-white/70 hover:text-black dark:hover:text-white hover:border-white/20"
							aria-label="Close mobile navigation menu"
						>
							×
						</button>
					</div>

					<ReputationBadge className="w-full" size="sm" showBalance />
					<div className="w-full [&_button]:dark:text-black [&_button]:dark:bg-white">
						<WalletButton />
					</div>

					<div className="h-px bg-slate-200 dark:bg-white/10 my-1" />

					{navLinks.map(({ to, label }) => (
						<NavLink
							key={to}
							to={to}
							onClick={closeMenu}
							className={({ isActive }) =>
								`block w-full px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
									isActive
										? "text-brand-cyan bg-brand-cyan/5 border border-brand-cyan/20"
										: "text-slate-700 dark:text-white/70 border border-slate-200 dark:border-white/10 hover:text-black dark:hover:text-white"
								}`
							}
						>
							{label}
						</NavLink>
					))}
				</nav>
			</div>
		</header>
	)
}