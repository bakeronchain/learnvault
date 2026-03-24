/**
 * Utility functions for USDC token operations on Stellar
 */

import { Contract, SorobanRpc } from "@stellar/stellar-sdk"

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
 * @param amount - The amount of USDC to mint (default: 1000)
 * @returns Promise that resolves when minting is complete
 * @throws Error if minting fails
 */
export async function mintTestUSDC(
	recipientAddress: string,
	amount: number = 1000,
): Promise<void> {
	try {
		const contractId = getUSDCContractId()

		// Convert amount to stroops (7 decimals for USDC)
		const amountStroops = amount * 10000000

		// Get RPC URL from environment
		const rpcUrl =
			import.meta.env.PUBLIC_STELLAR_RPC_URL || "http://localhost:8000/rpc"

		// Create RPC server instance
		const server = new SorobanRpc.Server(rpcUrl)

		// Create contract instance
		const contract = new Contract(contractId)

		// Build the mint transaction
		// Note: This is a simplified version. In production, you would need to:
		// 1. Build the transaction properly with the contract client
		// 2. Sign it with the appropriate authority
		// 3. Submit it to the network
		// 4. Wait for confirmation

		// For now, we'll throw an error directing users to use the CLI script
		throw new Error(
			`Please use the CLI script to mint test USDC:\n\n` +
				`./scripts/mint-test-usdc.sh ${recipientAddress} ${amount}\n\n` +
				`This UI button will be fully functional once contract clients are generated.`,
		)

		// TODO: Implement full minting flow once contract clients are available
		// const result = await contract.call('mint', {
		//   to: recipientAddress,
		//   amount: amountStroops
		// })

		// return result
	} catch (error) {
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
export async function getUSDCBalance(address: string): Promise<number> {
	try {
		const contractId = getUSDCContractId()
		const rpcUrl =
			import.meta.env.PUBLIC_STELLAR_RPC_URL || "http://localhost:8000/rpc"

		const server = new SorobanRpc.Server(rpcUrl)
		const contract = new Contract(contractId)

		// TODO: Implement balance checking once contract clients are available
		// const balance = await contract.call('balance', { id: address })
		// return balance / 10000000 // Convert from stroops to USDC

		throw new Error("Balance checking not yet implemented")
	} catch (error) {
		if (error instanceof Error) {
			throw error
		}
		throw new Error("Failed to get USDC balance")
	}
}
