import { AsyncLocalStorage } from "node:async_hooks"

type RequestContext = {
	requestId: string
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>()

let consolePatched = false

export function runWithRequestContext<T>(
	context: RequestContext,
	fn: () => T,
): T {
	return requestContextStorage.run(context, fn)
}

export function getRequestContext(): RequestContext | undefined {
	return requestContextStorage.getStore()
}

export function getRequestId(): string | undefined {
	return getRequestContext()?.requestId
}

const methods = ["log", "info", "warn", "error", "debug"] as const

export function setupConsoleRequestTracing(): void {
	if (consolePatched) {
		return
	}

	for (const method of methods) {
		const original = console[method].bind(console)
		console[method] = ((...args: unknown[]) => {
			const requestId = getRequestId()
			if (!requestId) {
				original(...args)
				return
			}

			const tag = `[requestId=${requestId}]`
			if (typeof args[0] === "string") {
				original(`${tag} ${args[0]}`, ...args.slice(1))
				return
			}

			original(tag, ...args)
		}) as (typeof console)[typeof method]
	}

	consolePatched = true
}
