import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
	plugins: [react()],
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
		exclude: [
			"src/util/wallet.test.ts",
			"src/hooks/useAdmin.test.ts",
			"src/hooks/useDonor.test.tsx",
			"src/components/ProposalCard.test.tsx",
			"src/pages/DaoPropose.test.tsx",
			"src/pages/ScholarshipApply.test.tsx",
		],
		env: {
			NODE_ENV: "development",
			PUBLIC_SCHOLARSHIP_TREASURY_CONTRACT:
				"CSCHOL1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO",
			PUBLIC_GOVERNANCE_TOKEN_CONTRACT:
				"CGOV1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO",
		},
		coverage: {
			reporter: ["text", "lcov"],
		},
	},
	ssr: {
		noExternal: ["@creit.tech/stellar-wallets-kit"],
	},
})
