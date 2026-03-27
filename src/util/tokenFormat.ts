const DEFAULT_DECIMALS = 7

export function formatLRN(
	raw: bigint,
	decimals: number = DEFAULT_DECIMALS,
): string {
	return formatToken(raw, decimals)
}

export function formatUSDC(
	raw: bigint,
	decimals: number = DEFAULT_DECIMALS,
): string {
	return formatToken(raw, decimals)
}

export function parseLRN(
	display: string,
	decimals: number = DEFAULT_DECIMALS,
): bigint {
	return parseToken(display, decimals)
}

export function parseUSDC(
	display: string,
	decimals: number = DEFAULT_DECIMALS,
): bigint {
	return parseToken(display, decimals)
}

function formatToken(raw: bigint, decimals: number): string {
	const divisor = 10n ** BigInt(decimals)
	const isNegative = raw < 0n
	const abs = isNegative ? -raw : raw

	const wholePart = abs / divisor
	const fracPart = abs % divisor

	const wholeStr = wholePart.toLocaleString("en-US")
	const fracStr = fracPart.toString().padStart(decimals, "0")

	const formatted = `${wholeStr}.${fracStr}`
	return isNegative ? `-${formatted}` : formatted
}

function parseToken(display: string, decimals: number): bigint {
	const cleaned = display.replace(/[,\s]/g, "")

	if (cleaned === "" || cleaned === ".") {
		return 0n
	}

	const isNegative = cleaned.startsWith("-")
	const unsigned = isNegative ? cleaned.slice(1) : cleaned

	const parts = unsigned.split(".")
	const wholePart = parts[0] || "0"
	let fracPart = parts[1] || ""

	if (fracPart.length > decimals) {
		fracPart = fracPart.slice(0, decimals)
	} else {
		fracPart = fracPart.padEnd(decimals, "0")
	}

	const raw = BigInt(wholePart) * 10n ** BigInt(decimals) + BigInt(fracPart)
	return isNegative ? -raw : raw
}
