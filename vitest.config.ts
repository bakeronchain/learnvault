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
			PUBLIC_SCHOLARSHIP_TREASURY_CONTRACT:
				"CSCHOL1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO",
			PUBLIC_GOVERNANCE_TOKEN_CONTRACT:
				"CGOV1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO",
		},
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
