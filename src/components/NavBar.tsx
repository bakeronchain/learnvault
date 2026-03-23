import { Button, Icon, Text } from "@stellar/design-system"
import { useState } from "react"
import { NavLink } from "react-router-dom"
import styles from "../App.module.css"
import { WalletButton } from "./WalletButton"

export default function NavBar() {
	const [menuOpen, setMenuOpen] = useState(false)

	const navLinks = [
		{ to: "/learn", label: "Learn" },
		{ to: "/dao", label: "DAO" },
		{ to: "/leaderboard", label: "Leaderboard" },
		{ to: "/profile", label: "My Profile" },
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
