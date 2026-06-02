import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"
import wasm from "vite-plugin-wasm"
// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss(), nodePolyfills(), wasm()],
	optimizeDeps: {
		esbuildOptions: {
			loader: {
				".js": "jsx",
			},
		},
		exclude: ["@stellar/stellar-xdr-json"],
	},
	build: {
		target: "esnext",
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("node_modules")) {
						if (
							id.includes("/react/") ||
							id.includes("\\react\\") ||
							id.includes("react-dom") ||
							id.includes("scheduler") ||
							id.includes("@tanstack/react-query") ||
							id.includes("@stellar/design-system")
						) {
							return "framework"
						}
						if (id.includes("@theahaco/contract-explorer")) {
							return "contract-explorer"
						}
						if (id.includes("recharts")) {
							return "charts"
						}
						if (
							id.includes("@stellar/stellar-sdk") ||
							id.includes("@stellar/stellar-xdr-json") ||
							id.includes("@creit.tech/stellar-wallets-kit")
						) {
							return "stellar"
						}
						if (id.includes("react-router")) {
							return "router"
						}
						if (id.includes("i18next")) {
							return "i18n"
						}
					}

					if (/[\\/]src[\\/]contracts[\\/]/.test(id)) {
						return "contract-clients"
					}
				},
			},
		},
	},
	define: {
		global: "window",
	},
	envPrefix: ["PUBLIC_", "VITE_"],
	server: {
		proxy: {
			"/friendbot": {
				target: "http://localhost:8000/friendbot",
				changeOrigin: true,
			},
			"/api": {
				target: "http://localhost:8000",
				changeOrigin: true,
				// Don't rewrite /api prefix — backend expects it
			},
		},
	},
})
