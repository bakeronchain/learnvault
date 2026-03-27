import { useQuery } from "@tanstack/react-query"
import { useToast } from "../components/Toast/ToastProvider"
import { getUSDCBalance, getUSDCContractId } from "../util/usdc"

// USDC has 7 decimal places on Stellar
const USDC_DECIMALS = 7n
const USDC_SCALE = 10n ** USDC_DECIMALS

const BALANCE_STALE_TIME = 60 * 1000 // 1 minute

export interface UseUSDCResult {
	/** Raw balance as bigint (7 decimal places). undefined when no address provided. */
	rawBalance: bigint | undefined
	/** Human-readable balance as a number (e.g. 1000.5). undefined when no address provided. */
	balance: number | undefined
	/** Whether the USDC contract is configured in env vars. */
	isConfigured: boolean
	isLoading: boolean
}

/**
 * Fetches the USDC balance for a given Stellar address.
 *
 * @param address - The Stellar address to query. Pass undefined to skip fetching.
 */
export function useUSDC(address: string | undefined): UseUSDCResult {
	const { showError } = useToast()
	const isConfigured = Boolean(getUSDCContractId())

	const { data: rawBalance, isLoading } = useQuery({
		queryKey: ["usdc", "balance", address],
		queryFn: async (): Promise<bigint> => {
			try {
				return await getUSDCBalance(address!)
			} catch (error) {
				console.error("[useUSDC] balance fetch failed:", error)
				showError("Failed to load USDC balance")
				return 0n
			}
		},
		enabled: Boolean(address) && isConfigured,
		staleTime: BALANCE_STALE_TIME,
	})

	const balance =
		rawBalance !== undefined
			? Number(rawBalance) / Number(USDC_SCALE)
			: undefined

	return {
		rawBalance: address ? rawBalance : undefined,
		balance: address ? balance : undefined,
		isConfigured,
		isLoading,
	}
}
