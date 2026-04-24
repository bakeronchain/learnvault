import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useId, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { NavLink } from "react-router-dom"
import { fetchCourses } from "../hooks/useCourses"
import { fetchLeaderboard } from "../hooks/useLeaderboard"
import { fetchProposals } from "../hooks/useProposals"
import {
	fetchTreasuryActivityPage,
	fetchTreasuryStats,
} from "../hooks/useTreasury"
import { useWallet } from "../hooks/useWallet"
import { fetchHistory } from "../pages/History"
import GlobalSearch from "./GlobalSearch"
import { NotificationBell } from "./NotificationBell"
import { ReputationBadge } from "./ReputationBadge"
import { ThemeToggle } from "./ThemeToggle"
import { WalletButton } from "./WalletButton"

export default function NavBar() {
	const [menuOpen, setMenuOpen] = useState(false)
	const mobileMenuId = useId()
	const { t } = useTranslation()
	const token = localStorage.getItem("auth_token") ?? undefined

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
		{ to: "/community", label: "Community" },
		{ to: "/leaderboard", label: t("nav.leaderboard") },
		{ to: "/history", label: "Activity" },
		{ to: "/wiki", label: t("nav.docs") },
		{ to: "/donor", label: "Donor" },
		{ to: "/treasury", label: t("nav.treasury") },
	]

	const closeMenu = () => setMenuOpen(false)

	const queryClient = useQueryClient()
	const { address } = useWallet()

	const handlePrefetch = useCallback(
		(to: string) => {
			if (to === "/courses") {
				void queryClient.prefetchQuery({
					queryKey: ["courses"],
					queryFn: fetchCourses,
					staleTime: 60 * 1000,
				})
			} else if (to === "/dao") {
				void queryClient.prefetchQuery({
					queryKey: ["proposals", address],
					queryFn: () => fetchProposals(address),
					staleTime: 60 * 1000,
				})
			} else if (to === "/leaderboard") {
				void queryClient.prefetchQuery({
					queryKey: ["leaderboard", address],
					queryFn: () => fetchLeaderboard(address),
					staleTime: 300 * 1000,
				})
			} else if (to === "/history" && address) {
				void queryClient.prefetchQuery({
					queryKey: ["history", address],
					queryFn: () => fetchHistory(address),
					staleTime: 30 * 1000,
				})
			} else if (to === "/treasury") {
				void queryClient.prefetchQuery({
					queryKey: ["treasury", "stats"],
					queryFn: fetchTreasuryStats,
					staleTime: 60 * 1000,
				})
				void queryClient.prefetchQuery({
					queryKey: ["treasury", "activity"],
					queryFn: () => fetchTreasuryActivityPage(10, 0),
					staleTime: 60 * 1000,
				})
			}
		},
		[queryClient, address],
	)

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
					aria-label="Primary"
					className="hidden md:flex items-center gap-2 lg:gap-6"
				>
					{navLinks.map(({ to, label }) => (
						<NavLink
							key={to}
							to={to}
							onMouseEnter={() => handlePrefetch(to)}
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
					<div className="hidden lg:block">
						<GlobalSearch />
					</div>
					<ThemeToggle />

					<ReputationBadge
						className="hidden lg:inline-flex shrink-0"
						size="sm"
						showBalance
					/>
					<NotificationBell token={token} />
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
					className={`fixed top-0 right-0 z-50 h-full w-[min(24rem,92vw)] glass border-l border-white/10 shadow-2xl p-8 flex flex-col gap-6 transition-transform duration-500 ease-out ${
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
							onMouseEnter={() => handlePrefetch(to)}
							className={({ isActive }) =>
								`block w-full px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${
									isActive
										? "text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/20 shadow-[0_0_20px_rgba(0,210,255,0.1)]"
										: "text-slate-700 dark:text-white/70 border border-slate-200 dark:border-white/10 hover:text-black dark:hover:text-white hover:bg-white/5"
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
