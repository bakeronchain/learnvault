import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit"
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils"
import { Horizon } from "@stellar/stellar-sdk"
import { networkPassphrase, stellarNetwork } from "../contracts/util"
import storage from "./storage"

// Initialize the kit globally with static config (v2 SDK approach)
StellarWalletsKit.init({
	network: networkPassphrase as any,
	modules: defaultModules(),
})

export const connectWallet = async () => {
	try {
		// authModal pops the UI, sets the active module internally, and resolves the address
		const { address } = await StellarWalletsKit.authModal()
		// v2 SDK uses productId (e.g. "freighter", "hot-wallet") to identify the active module
		const selectedId =
			(StellarWalletsKit.selectedModule as any)?.productId || ""

		if (address) {
			storage.setItem("walletId", selectedId)
			storage.setItem("walletAddress", address)
			storage.setItem("walletType", selectedId)
		} else {
			storage.setItem("walletId", "")
			storage.setItem("walletAddress", "")
			storage.setItem("walletType", "")
		}

		if (selectedId === "freighter" || selectedId === "hot-wallet") {
			try {
				const network = await StellarWalletsKit.getNetwork()
				if (network.network && network.networkPassphrase) {
					storage.setItem("walletNetwork", network.network)
					storage.setItem("networkPassphrase", network.networkPassphrase)
				} else {
					storage.setItem("walletNetwork", "")
					storage.setItem("networkPassphrase", "")
				}
			} catch (e) {
				storage.setItem("walletNetwork", "")
				storage.setItem("networkPassphrase", "")
			}
		}
	} catch (error) {
		console.error("Wallet connection failed or was cancelled:", error)
	}
}

export const disconnectWallet = async () => {
	await StellarWalletsKit.disconnect().catch(() => {})
	storage.removeItem("walletId")
	storage.removeItem("walletType")
}

function getHorizonHost(mode: string) {
	switch (mode) {
		case "LOCAL":
			return "http://localhost:8000"
		case "FUTURENET":
			return "https://horizon-futurenet.stellar.org"
		case "TESTNET":
			return "https://horizon-testnet.stellar.org"
		case "PUBLIC":
			return "https://horizon.stellar.org"
		default:
			throw new Error(`Unknown Stellar network: ${mode}`)
	}
}

const horizon = new Horizon.Server(getHorizonHost(stellarNetwork), {
	allowHttp: stellarNetwork === "LOCAL",
})

const formatter = new Intl.NumberFormat()

export type MappedBalances = Record<string, Horizon.HorizonApi.BalanceLine>

export const fetchBalances = async (address: string) => {
	try {
		const { balances } = await horizon.accounts().accountId(address).call()
		const mapped = balances.reduce((acc, b) => {
			b.balance = formatter.format(Number(b.balance))
			const key =
				b.asset_type === "native"
					? "xlm"
					: b.asset_type === "liquidity_pool_shares"
						? b.liquidity_pool_id
						: `${b.asset_code}:${b.asset_issuer}`
			acc[key] = b
			return acc
		}, {} as MappedBalances)
		return mapped
	} catch (err) {
		// `not found` is sort of expected, indicating an unfunded wallet, which
		// the consumer of `balances` can understand via the lack of `xlm` key.
		// If the error does NOT match 'not found', log the error.
		// We should also possibly not return `{}` in this case?
		if (!(err instanceof Error && err.message.match(/not found/i))) {
			console.error(err)
		}
		return {}
	}
}

export const wallet = StellarWalletsKit
