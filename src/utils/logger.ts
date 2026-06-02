const isDevelopment = import.meta.env.DEV

type LogMethod = "debug" | "info" | "warn"

const devLog = (method: LogMethod, ...args: unknown[]) => {
	if (!isDevelopment) return
	console[method](...args)
}

export const logger = {
	debug: (...args: unknown[]) => devLog("debug", ...args),
	info: (...args: unknown[]) => devLog("info", ...args),
	warn: (...args: unknown[]) => devLog("warn", ...args),
}
