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
}
