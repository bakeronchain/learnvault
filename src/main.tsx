import {
	QueryClient,
	QueryClientProvider,
	QueryCache,
	MutationCache,
} from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "@stellar/design-system/build/styles.min.css"
import "./index.css"
import App from "./App.tsx"
import { NotificationProvider } from "./providers/NotificationProvider.tsx"
import { WalletProvider } from "./providers/WalletProvider.tsx"
import "./i18n"
import { parseError } from "./util/error"
import { initSentry } from "./lib/sentry"

// Initialize Sentry for error monitoring
initSentry({
	dsn: import.meta.env.VITE_SENTRY_DSN,
	environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "development",
	release:
		import.meta.env.VITE_SENTRY_RELEASE ||
		import.meta.env.VITE_GIT_COMMIT_HASH,
	tracesSampleRate:
		import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE
			? parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE)
			: 0.1,
	replaysSessionSampleRate:
		import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE
			? parseFloat(import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE)
			: 0.1,
	replaysOnErrorSampleRate:
		import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE
			? parseFloat(import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE)
			: 1.0,
})

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
