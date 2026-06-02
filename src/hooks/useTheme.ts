"use client"

import { useEffect, useState } from "react"
import {
	type Theme,
	resolveTheme,
	persistTheme,
	applyTheme,
} from "../util/theme"

export const useTheme = () => {
	// Initialize with system/stored preference
	const [theme, setTheme] = useState<Theme>("light")

	useEffect(() => {
		const initialTheme = resolveTheme()
		setTheme(initialTheme)
		applyTheme(initialTheme)
	}, [])

	const toggleTheme = () => {
		const newTheme = theme === "light" ? "dark" : "light"
		setTheme(newTheme)
		persistTheme(newTheme)
	}

	return { theme, toggleTheme }
}
