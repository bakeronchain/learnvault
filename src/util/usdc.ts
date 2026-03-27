/**
 * Utility functions for USDC token operations on Stellar
 */

import { Contract, rpc, xdr } from "@stellar/stellar-sdk"
import { networkPassphrase, rpcUrl } from "../contracts/util"

/**
 * Get the USDC contract ID from environment variables.
 * Checks both PUBLIC_USDC_CONTRACT_ID and VITE_USDC_CONTRACT_ID.
 * Returns undefined when neither is set (contract not configured).
 */
export function getUSDCContractId(): string | undefined {
	const contractId =
		(import.meta.env.PUBLIC_USDC_CONTRACT_ID as string | undefined) ||
		(import.meta.env.VITE_USDC_CONTRACT_ID as string | undefined)

	return contractId?.trim() || undefined
}

/**
 * Mint test USDC tokens to a specified address.
 * This function is only for testnet/development environments.
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
			(import.meta.env.PUBLIC_STELLAR_RPC_URL as string | undefined) ||
			"http://localhost:8000/rpc"
		void signTransaction
		throw new Error(
			`Please use the CLI script to mint test USDC:\n\n./scripts/mint-test-usdc.sh ${recipientAddress} ${amount}\n\nConfigured contract: ${contractId ?? "not set"}\nRPC endpoint: ${endpoint}`,
		)
	} catch (error) {
		console.error("Minting error:", error)
		if (error instanceof Error) throw error
		throw new Error("Failed to mint test USDC")
	}
}

// ---------------------------------------------------------------------------
// SAC (Stellar Asset Contract) balance helper
// ---------------------------------------------------------------------------

/**
 * Calls the SAC / SEP-41 `balance(address)` function on the USDC contract
 * via a read-only simulation (no transaction needed).
 *
 * Returns 0n when:
 *  - the contract ID is not configured
 *  - the contract is not deployed on the current network
 *  - the address has never interacted with the contract (balance is implicitly 0)
 *
 * @param address - The Stellar address whose USDC balance to query
 * @returns The raw token balance as a bigint (7 decimal places for USDC)
 */
export async function getUSDCBalance(address: string): Promise<bigint> {
	const contractId = getUSDCContractId()
	if (!contractId) {
		console.warn(
			"[getUSDCBalance] USDC contract ID not configured " +
				"(set PUBLIC_USDC_CONTRACT_ID or VITE_USDC_CONTRACT_ID).",
		)
		return 0n
	}

	try {
		const server = new rpc.Server(rpcUrl, { allowHttp: true })

		// Build the balance() invocation using the low-level Contract helper so
		// we don't need a generated client.
		const contract = new Contract(contractId)
		const operation = contract.call(
			"balance",
			xdr.ScVal.scvAddress(
				xdr.ScAddress.scAddressTypeAccount(
					xdr.PublicKey.publicKeyTypeEd25519(
						// Decode the strkey into raw bytes
						Buffer.from(
							// stellar-sdk exposes StrKey on the top-level import

							(
								await import("@stellar/stellar-sdk")
							).StrKey.decodeEd25519PublicKey(address),
						),
					),
				),
			),
		)

		const account = await server.getAccount(address).catch(() => null)
		if (!account) {
			// Address has never been funded — balance is 0
			return 0n
		}

		const { TransactionBuilder, BASE_FEE } =
			await import("@stellar/stellar-sdk")
		const tx = new TransactionBuilder(account, {
			fee: BASE_FEE,
			networkPassphrase,
		})
			.addOperation(operation)
			.setTimeout(30)
			.build()

		const result = await server.simulateTransaction(tx)

		if (rpc.Api.isSimulationError(result)) {
			// Contract not deployed or address not found — treat as zero balance
			console.warn("[getUSDCBalance] Simulation error:", result.error)
			return 0n
		}

		const returnVal = (result as rpc.Api.SimulateTransactionSuccessResponse)
			.result?.retval

		if (!returnVal) return 0n

		// The SAC balance() returns an i128; the SDK decodes it as a bigint.
		const scVal = returnVal
		if (scVal.switch().name === "scvI128") {
			const i128 = scVal.i128()
			const hi = BigInt(i128.hi().toString())
			const lo = BigInt(i128.lo().toString())
			return (hi << 64n) | lo
		}

		// Fallback: try to coerce whatever came back
		const { scValToNative } = await import("@stellar/stellar-sdk")
		const native = scValToNative(scVal) as unknown
		if (typeof native === "bigint") return native
		if (typeof native === "number") return BigInt(Math.trunc(native))
		return 0n
	} catch (error) {
		// Network errors, RPC unavailable, etc. — degrade gracefully
		console.error("[getUSDCBalance] Failed to fetch balance:", error)
		return 0n
	}
}
