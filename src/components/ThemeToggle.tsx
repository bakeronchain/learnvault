import { Button, Icon } from "@stellar/design-system"
import { useEffect, useState } from "react"
import {
	applyTheme,
	getStoredTheme,
	getSystemTheme,
	persistTheme,
	type Theme,
} from "../util/theme"

export const ThemeToggle = () => {
	const [storedTheme, setStoredTheme] = useState<Theme | null>(() =>
		getStoredTheme(),
	)
	const [systemTheme, setSystemTheme] = useState<Theme>(() => getSystemTheme())

	const activeTheme = storedTheme ?? systemTheme
	const nextTheme = activeTheme === "dark" ? "light" : "dark"

	useEffect(() => {
		applyTheme(activeTheme)
	}, [activeTheme])

	useEffect(() => {
		if (
			typeof window === "undefined" ||
			typeof window.matchMedia !== "function"
		) {
			return
		}

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
		const updateSystemTheme = (matchesDark: boolean) => {
			if (storedTheme === null) {
				setSystemTheme(matchesDark ? "dark" : "light")
			}
		}

		updateSystemTheme(mediaQuery.matches)

		const handleChange = (event: MediaQueryListEvent) => {
			updateSystemTheme(event.matches)
		}

		mediaQuery.addEventListener("change", handleChange)

		return () => {
			mediaQuery.removeEventListener("change", handleChange)
		}
	}, [storedTheme])

	const toggleTheme = () => {
		setStoredTheme(nextTheme)
		persistTheme(nextTheme)
	}

	return (
		<Button
			variant="tertiary"
			size="md"
			onClick={toggleTheme}
			aria-label={`Switch to ${nextTheme} theme`}
			title={`Switch to ${nextTheme} theme`}
			className="!px-2"
		>
			{activeTheme === "dark" ? <Icon.Sun /> : <Icon.Moon01 />}
		</Button>
	)
}
