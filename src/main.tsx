import "@stellar/design-system/build/styles.min.css"
import "./index.css"
import "./i18n"

import {
	MutationCache,
	QueryCache,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query"

import App from "./App.tsx"
import { BrowserRouter } from "react-router-dom"
import { NotificationProvider } from "./providers/NotificationProvider.tsx"
import { StrictMode } from "react"
import { WalletProvider } from "./providers/WalletProvider.tsx"
import { createRoot } from "react-dom/client"
import { initSentry } from "./lib/sentry"
import { parseError } from "./util/error"

// Issue #61 — FOUC prevention: apply theme before first render
;(function () {
	try {
		const saved = localStorage.getItem("learnvault:theme")
		const theme: string = saved
			? (JSON.parse(saved) as string)
			: window.matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light"
		const themeClass = theme === "dark" ? "sds-theme-dark" : "sds-theme-light"
		const html = document.documentElement
		const body = document.body
		// Apply SDS theme class + Tailwind dark class + data attributes
		;[html, body].forEach((el) => {
			el.classList.remove("sds-theme-dark", "sds-theme-light", "dark", "light")
			el.classList.add(themeClass)
			if (theme === "dark") el.classList.add("dark")
			el.setAttribute("data-theme", theme)
			el.setAttribute("data-sds-theme", themeClass)
		})
		html.style.colorScheme = theme
	} catch (e) {}
})()

const queryClient = new QueryClient({
	queryCache: new QueryCache({
		onError: (error) => {
			console.error("Query Error:", parseError(error))
		},
	}),
	mutationCache: new MutationCache({
		onError: (error) => {
			console.error("Mutation Error:", parseError(error))
		},
	}),
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: false,
			staleTime: 30 * 1000, // 30 seconds default
			gcTime: 10 * 60 * 1000, // 10 minutes
		},
	},
})

createRoot(document.getElementById("root") as HTMLElement).render(
	<StrictMode>
		<NotificationProvider>
			<QueryClientProvider client={queryClient}>
				<WalletProvider>
					<BrowserRouter>
						<App />
					</BrowserRouter>
				</WalletProvider>
			</QueryClientProvider>
		</NotificationProvider>
	</StrictMode>,
)
