const storageKey = "learnvault:theme"
const root = document.documentElement

const themeClassNames = {
	light: "sds-theme-light",
	dark: "sds-theme-dark",
}

const applyTheme = (theme: "light" | "dark") => {
	const themeClass = themeClassNames[theme]
	root.classList.remove(themeClassNames.light, themeClassNames.dark)
	root.classList.add(themeClass)
	root.setAttribute("data-theme", theme)
	root.setAttribute("data-sds-theme", themeClass)
	root.style.colorScheme = theme
}

try {
	const rawTheme = localStorage.getItem(storageKey)
	const parsedTheme = rawTheme ? JSON.parse(rawTheme) : null
	const preferredTheme =
		parsedTheme === "light" || parsedTheme === "dark"
			? parsedTheme
			: window.matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light"

	applyTheme(preferredTheme)
} catch {
	applyTheme("light")
}
