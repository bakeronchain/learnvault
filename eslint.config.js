import { config } from "@theahaco/ts-config/eslint"
import { globalIgnores } from "eslint/config"
import globals from "globals"

/** @type {import("eslint").Linter.Config[]} */
export default [
	globalIgnores([
		"dist",
		"packages",
		"target/packages",
		"src/contracts/*",
		"!src/contracts/util.ts",
	]),
	...config,
	{
		files: ["**/*.{ts,tsx}"],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
			parserOptions: {
				tsconfigRoot: import.meta.dirname,
			},
		},
	},
	{
		files: ["server/src/**/*.ts", "server/scripts/**/*.ts"],
		rules: {
			"no-restricted-properties": [
				"error",
				{
					object: "console",
					property: "error",
					message: "Use the structured server logger instead of console.error.",
				},
			],
		},
	},
]
