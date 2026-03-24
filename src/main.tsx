import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query"
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
