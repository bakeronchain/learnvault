import { useEffect } from "react"

const extractOrigin = (value: string) => {
	try {
		return new URL(value).origin
	} catch {
		return null
	}
}

const shouldSkipOrigin = (origin: string) =>
	origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")

const ensureHeadLink = (rel: "dns-prefetch" | "preconnect", href: string) => {
	const selector = `link[rel="${rel}"][href="${href}"]`
	if (document.head.querySelector(selector)) return

	const link = document.createElement("link")
	link.rel = rel
	link.href = href
	if (rel === "preconnect") {
		link.crossOrigin = "anonymous"
	}
	document.head.appendChild(link)
}

const stellarNetwork = (() => {
	const network = import.meta.env.PUBLIC_STELLAR_NETWORK
	if (network === "STANDALONE") return "LOCAL"
	return typeof network === "string" ? network : "LOCAL"
})()

const networkPassphrase =
	import.meta.env.PUBLIC_STELLAR_NETWORK_PASSPHRASE ??
	"Standalone Network ; February 2017"

const rpcUrl =
	import.meta.env.PUBLIC_STELLAR_RPC_URL ?? "http://localhost:8000/rpc"

const horizonUrl =
	import.meta.env.PUBLIC_STELLAR_HORIZON_URL ?? "http://localhost:8000"

const stellarEncode = (value: string) =>
	value.replace(/\//g, "//").replace(/;/g, "/;")

const labPrefix = () => {
	switch (stellarNetwork) {
		case "LOCAL":
			return `http://localhost:8000/lab/transaction-dashboard?$=network$id=custom&label=Custom&horizonUrl=${stellarEncode(horizonUrl)}&rpcUrl=${stellarEncode(rpcUrl)}&passphrase=${stellarEncode(networkPassphrase)};`
		case "PUBLIC":
			return `https://lab.stellar.org/transaction-dashboard?$=network$id=mainnet&label=Mainnet&horizonUrl=${stellarEncode(horizonUrl)}&rpcUrl=${stellarEncode(rpcUrl)}&passphrase=${stellarEncode(networkPassphrase)};`
		case "TESTNET":
			return `https://lab.stellar.org/transaction-dashboard?$=network$id=testnet&label=Testnet&horizonUrl=${stellarEncode(horizonUrl)}&rpcUrl=${stellarEncode(rpcUrl)}&passphrase=${stellarEncode(networkPassphrase)};`
		case "FUTURENET":
			return `https://lab.stellar.org/transaction-dashboard?$=network$id=futurenet&label=Futurenet&horizonUrl=${stellarEncode(horizonUrl)}&rpcUrl=${stellarEncode(rpcUrl)}&passphrase=${stellarEncode(networkPassphrase)};`
		default:
			return `https://lab.stellar.org/transaction-dashboard?$=network$id=testnet&label=Testnet&horizonUrl=${stellarEncode(horizonUrl)}&rpcUrl=${stellarEncode(rpcUrl)}&passphrase=${stellarEncode(networkPassphrase)};`
	}
}

/**
 * Adds connection hints for Horizon/RPC/Lab origins without importing the
 * heavier contract utility graph into the landing route bundle.
 */
const NetworkPreconnect = () => {
	useEffect(() => {
		const schedule =
			"requestIdleCallback" in window
				? window.requestIdleCallback.bind(window)
				: (callback: IdleRequestCallback) =>
						window.setTimeout(
							() =>
								callback({
									didTimeout: false,
									timeRemaining: () => 0,
								} as IdleDeadline),
							1,
						)

		schedule(() => {
			const origins = Array.from(
				new Set(
					[rpcUrl, horizonUrl, labPrefix()]
						.map(extractOrigin)
						.filter((origin): origin is string => Boolean(origin))
						.filter((origin) => !shouldSkipOrigin(origin)),
				),
			)

			origins.forEach((origin) => {
				ensureHeadLink("dns-prefetch", origin)
				ensureHeadLink("preconnect", origin)
			})
		})
	}, [])

	return null
}

export default NetworkPreconnect
