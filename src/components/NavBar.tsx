import { Button, Icon, Text } from "@stellar/design-system"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { NavLink } from "react-router-dom"
import styles from "../App.module.css"
import { WalletButton } from "./WalletButton"

export default function NavBar() {
	const [menuOpen, setMenuOpen] = useState(false)
	const { t } = useTranslation()

	const navLinks = [
		{ to: "/learn", label: t("nav.learn") },
		{ to: "/dao", label: t("nav.dao") },
		{ to: "/leaderboard", label: t("nav.leaderboard") },
		{ to: "/profile", label: t("nav.profile") },
	]

	return (
		<header className={styles.NavBar}>
			<div className={styles.NavBarContent}>
				<NavLink to="/" className={styles.Logo}>
					<Text as="div" size="lg" weight="bold">
						LearnVault
					</Text>
				</NavLink>

				<nav
					className={`${styles.NavLinks} ${menuOpen ? styles.NavLinksOpen : ""}`}
				>
					{navLinks.map(({ to, label }) => (
						<NavLink key={to} to={to} onClick={() => setMenuOpen(false)}>
							{({ isActive }) => (
								<Button
									variant={isActive ? "primary" : "tertiary"}
									size="md"
									disabled={isActive}
								>
									{label}
								</Button>
							)}
						</NavLink>
					))}
				</nav>

				<div className={styles.NavRight}>
					<WalletButton />
					<Button
						variant="tertiary"
						size="md"
						onClick={() => setMenuOpen(!menuOpen)}
						className={styles.Hamburger}
					>
						{menuOpen ? <Icon.X /> : <Icon.Menu01 />}
					</Button>
				</div>
			</div>
		</header>
	)
}
