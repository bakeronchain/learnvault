import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"
import { VitePWA } from "vite-plugin-pwa"
import wasm from "vite-plugin-wasm"
// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		nodePolyfills(),
		wasm(),
		VitePWA({
			strategies: "injectManifest",
			srcDir: "src",
			filename: "sw.ts",
			registerType: "autoUpdate",
			devOptions: { enabled: true },
			workbox: {
				globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
				navigateFallback: "/index.html",
				navigateFallbackDenylist: [/^\/api\//],
			},
			injectManifest: {
				maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
				globIgnores: [
					"**/contract-explorer-*.js",
					"**/stellar_xdr_json_bg-*.wasm",
				],
			},
			manifest: {
				name: "LearnVault",
				short_name: "LearnVault",
				description:
					"Decentralized education on Stellar — learn, earn, and prove your skills on-chain.",
				theme_color: "#070910",
				background_color: "#070910",
				display: "standalone",
				start_url: "/",
				icons: [
					{
						src: "/assets/brand/logos/learnvault-icon-light.svg",
						sizes: "any",
						type: "image/svg+xml",
						purpose: "any maskable",
					},
					{
						src: "/favicon.ico",
						sizes: "48x48",
						type: "image/x-icon",
					},
				],
			},
		}),
	],
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
