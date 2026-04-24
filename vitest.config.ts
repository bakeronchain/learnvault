import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
	plugins: [react()],
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
		env: {
			NODE_ENV: "development",
			PUBLIC_SCHOLARSHIP_TREASURY_CONTRACT:
				"CSCHOL1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO",
			PUBLIC_GOVERNANCE_TOKEN_CONTRACT:
				"CGOV1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO",
		},
		coverage: {
			provider: "v8",
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/contracts/**",
				"src/test/**",
				"src/main.tsx",
				"**/*.test.{ts,tsx}",
				"**/*.d.ts",
			],
			reporter: ["text", "lcov", "json-summary"],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 80,
				statements: 80,
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
