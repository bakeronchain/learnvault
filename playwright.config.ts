import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
	testDir: "./e2e",
	timeout: 60_000,
	expect: { timeout: 10_000 },
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI ? [["github"], ["html"]] : [["list"], ["html"]],
	use: {
		baseURL: "http://127.0.0.1:4173",
		trace: "retain-on-failure",
		video: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	outputDir: "test-results",
	webServer: {
		command:
			"npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
		url: "http://127.0.0.1:4173",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
})
