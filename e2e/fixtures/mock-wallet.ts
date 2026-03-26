import { type Page } from "@playwright/test"

export const E2E_WALLET_ADDRESS =
	"GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"

/**
 * Provides a minimal Freighter API surface so StellarWalletsKit can read
 * address/network/sign tx without a real extension.
 */
export async function installMockFreighter(page: Page) {
	await page.addInitScript(
		({ address }) => {
			const networkPassphrase = "Test SDF Network ; September 2015"

			;(window as any).freighterApi = {
				isConnected: async () => true,
				isAllowed: async () => true,
				getPublicKey: async () => address,
				getNetwork: async () => "TESTNET",
				getNetworkDetails: async () => ({
					network: "TESTNET",
					networkPassphrase,
				}),
				signTransaction: async (xdr: string) => xdr,
				signMessage: async (message: string) => `signed:${message}`,
			}

			localStorage.setItem("walletId", "freighter")
			localStorage.setItem("walletAddress", address)
			localStorage.setItem("walletNetwork", "TESTNET")
			localStorage.setItem("networkPassphrase", networkPassphrase)
		},
		{ address: E2E_WALLET_ADDRESS },
	)
}
