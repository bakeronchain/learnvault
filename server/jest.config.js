/** @type {import('jest').Config} */
module.exports = {
	testEnvironment: "node",
	testMatch: ["**/tests/**/*.test.ts", "**/controllers/**/*.test.ts"],
	moduleFileExtensions: ["ts", "js", "json"],
	transform: {
		"^.+\\.ts$": [
			"ts-jest",
			{
				tsconfig: {
					esModuleInterop: true,
					module: "commonjs",
					types: ["node", "jest"],
				},
			},
		],
	},
	coverageProvider: "v8",
	collectCoverageFrom: [
		"src/**/*.ts",
		"!src/tests/**",
		"!src/**/*.test.ts",
		"!src/index.ts",
		"!src/openapi.ts",
		"!src/types/**",
		"!src/types.d.ts",
		"!src/templates/**",
	],
	coverageReporters: ["text", "lcov", "json-summary"],
	coverageThreshold: {
		global: {
			statements: 45,
			branches: 45,
			functions: 45,
			lines: 45,
		},
	},
}
