import storage from "./storage"

export type Theme = "light" | "dark"

const themeClasses: Record<Theme, string> = {
	light: "sds-theme-light",
	dark: "sds-theme-dark",
}

export const getSystemTheme = (): Theme => {
	if (
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-color-scheme: dark)").matches
	) {
		return "dark"
	}
	return "light"
}

export const getStoredTheme = (): Theme | null =>
	storage.getItem("learnvault:theme", "safe")

export const resolveTheme = (): Theme => getStoredTheme() ?? getSystemTheme()

export const applyTheme = (theme: Theme) => {
	if (typeof document === "undefined") return

	const themeClass = themeClasses[theme]
	const targets = [document.documentElement, document.body].filter(
		(target): target is HTMLElement => target instanceof HTMLElement,
	)

	targets.forEach((target) => {
		// Issue #61 — Remove all theme classes then apply correct one
		target.classList.remove(
			themeClasses.light,
			themeClasses.dark,
			"dark",
			"light",
		)
		target.classList.add(themeClass)
		// Issue #61 — Add 'dark' class for Tailwind dark: variant support
		if (theme === "dark") target.classList.add("dark")
		target.setAttribute("data-theme", theme)
		target.setAttribute("data-sds-theme", themeClass)
	})

	document.documentElement.style.colorScheme = theme
}

export const persistTheme = (theme: Theme) => {
	storage.setItem("learnvault:theme", theme)
	applyTheme(theme)
}
