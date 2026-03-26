/**
 * Utility functions for USDC token operations on Stellar
 */

import { rpcUrl } from "../contracts/util"

/**
 * Get the USDC contract ID from environment variables
 * @returns The USDC contract ID
 * @throws Error if USDC contract ID is not configured
 */
export function getUSDCContractId(): string {
	const contractId = import.meta.env.PUBLIC_USDC_CONTRACT_ID

	if (!contractId) {
		throw new Error(
			"USDC contract ID not configured. Please set PUBLIC_USDC_CONTRACT_ID in your .env file.",
		)
	}

	return contractId
}

/**
 * Mint test USDC tokens to a specified address
 * This function is only for testnet/development environments
 *
 * @param recipientAddress - The Stellar address to receive the USDC
 * @param signTransaction - Callback to sign the transaction XDR
 * @param amount - The amount of USDC to mint (default: 1000)
 * @returns Promise that resolves to the transaction hash when minting is complete
 * @throws Error if minting fails
 */
export async function mintTestUSDC(
	recipientAddress: string,
	signTransaction: (xdr: string) => Promise<{ signedTransaction: string }>,
	amount: number = 1000,
): Promise<string> {
	try {
		const contractId = getUSDCContractId()

		const endpoint =
			import.meta.env.PUBLIC_STELLAR_RPC_URL || "http://localhost:8000/rpc"
		void signTransaction
		throw new Error(
			`Please use the CLI script to mint test USDC:\n\n./scripts/mint-test-usdc.sh ${recipientAddress} ${amount}\n\nConfigured contract: ${contractId}\nRPC endpoint: ${endpoint}`,
		)
	} catch (error) {
		console.error("Minting error:", error)
		if (error instanceof Error) {
			throw error
		}
		throw new Error("Failed to mint test USDC")
	}
}

/**
 * Get USDC balance for an address
 *
 * @param address - The Stellar address to check
 * @returns Promise that resolves to the USDC balance
 */
export async function getUSDCBalance(_address: string): Promise<number> {
	try {
		getUSDCContractId()
		const endpoint = import.meta.env.PUBLIC_STELLAR_RPC_URL || rpcUrl

		throw new Error(
			`Balance checking is not yet implemented. Query the configured RPC endpoint directly: ${endpoint}`,
		)
	} catch (error) {
		if (error instanceof Error) {
			throw error
		}
		throw new Error("Failed to get USDC balance")
	}
}
