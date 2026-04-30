import pino from "pino"

const isProduction = process.env.NODE_ENV === "production"
const isTest = process.env.NODE_ENV === "test"

function buildTransport () {
	if (isTest) return undefined
	if (!isProduction) {
		return {
			target: "pino-pretty",
			options: { colorize: true, translateTime: "SYS:standard" },
		}
	}
	return undefined
}

export const logger = pino({
	level: isTest
		? "silent"
		: (process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug")),
	transport: buildTransport(),
})

/**
 * Truncates a Stellar wallet address for safe logging — never log full addresses
 * as they can be used as PII fingerprints. Shows first 4 + last 4 characters.
 * e.g. "GABC...WXYZ"
 */
export function maskAddress (address: string): string {
	if (!address || address.length <= 8) return address
	return `${address.slice(0, 4)}...${address.slice(-4)}`
}
