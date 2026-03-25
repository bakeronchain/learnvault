import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
	plugins: [react()],
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/tests/setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
		coverage: {
			include: ["src/util/**"],
			reporter: ["text", "lcov"],
			thresholds: {
				"src/util/**": {
					statements: 80,
					branches: 80,
					functions: 80,
					lines: 80,
				},
			},
		},
	},
	ssr: {
		noExternal: ["@creit.tech/stellar-wallets-kit"],
	},
})
