/**
 * Utility functions for USDC token operations on Stellar
 */

import {
	Asset,
	Contract,
	rpc as StellarRpc,
	TransactionBuilder,
	Operation,
	Account,
	TimeoutInfinite,
} from "@stellar/stellar-sdk"
import { rpcUrl, networkPassphrase, horizonUrl } from "../contracts/util"

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
		const amountStroops = BigInt(Math.floor(amount * 10000000))

		const rpcUrl =
			import.meta.env.PUBLIC_STELLAR_RPC_URL || "http://localhost:8000/rpc"

		throw new Error(
			`Please use the CLI script to mint test USDC:\n\n` +
				`./scripts/mint-test-usdc.sh ${recipientAddress} ${amount}\n\n` +
				`The configured contract ${contractId} will be reachable via ${rpcUrl} once contract clients are generated.`,
		)
		const server = new StellarRpc.Server(rpcUrl)

		// 1. Fetch account sequence
		const accountResponse = await fetch(
			`${horizonUrl}/accounts/${recipientAddress}`,
		)
		if (!accountResponse.ok) {
			throw new Error("Could not fetch account details for sequence number")
		}
		const accountData = await accountResponse.json()
		const sourceAccount = new Account(recipientAddress, accountData.sequence)

		// 2. Build the transaction
		const contract = new Contract(contractId)
		const tx = new TransactionBuilder(sourceAccount, {
			fee: "100",
			networkPassphrase,
		})
			.addOperation(
				contract.call("mint", {
					to: recipientAddress,
					amount: amountStroops,
				}),
			)
			.setTimeout(TimeoutInfinite)
			.build()

		// 3. Prepare transaction (simulations, footprints, etc.)
		const preparedTx = await server.prepareTransaction(tx)

		// 4. Sign transaction via wallet
		const { signedTransaction } = await signTransaction(preparedTx.toXDR())

		// 5. Submit transaction
		const submissionRes = await server.sendTransaction(
			TransactionBuilder.fromXDR(signedTransaction, networkPassphrase),
		)

		if (submissionRes.status !== "PENDING") {
			throw new Error(`Transaction submission failed: ${submissionRes.status}`)
		}

		// 6. Wait for result (polling)
		let txResult = await server.getTransaction(submissionRes.hash)
		let retries = 0
		const maxRetries = 30 // 30 seconds max
		
		while (txResult.status === "NOT_FOUND" && retries < maxRetries) {
			await new Promise((resolve) => setTimeout(resolve, 1000))
			txResult = await server.getTransaction(submissionRes.hash)
			retries++
		}

		if (txResult.status === "FAILED") {
			throw new Error(`Transaction failed: ${JSON.stringify(txResult.resultXdr)}`)
		}

		if (txResult.status !== "SUCCESS") {
			throw new Error(`Transaction timed out or had unexpected status: ${txResult.status}`)
		}

		return submissionRes.hash
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
		const rpcUrl =
			import.meta.env.PUBLIC_STELLAR_RPC_URL || "http://localhost:8000/rpc"

		throw new Error(
			`Balance checking is not yet implemented. Query the configured RPC endpoint directly: ${rpcUrl}`,
		)
	} catch (error) {
		if (error instanceof Error) {
			throw error
		}
		throw new Error("Failed to get USDC balance")
	}
}
