import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react"

export type StellarNetwork = "PUBLIC" | "TESTNET" | "FUTURENET" | "LOCAL"

export interface NetworkConfig {
	id: StellarNetwork
	name: string
	passphrase: string
	rpcUrl: string
	horizonUrl: string
	explorerUrl: string
	isProduction: boolean
}

const NETWORK_CONFIGS: Record<StellarNetwork, NetworkConfig> = {
	PUBLIC: {
		id: "PUBLIC",
		name: "Mainnet",
		passphrase: "Public Global Stellar Network ; September 2015",
		rpcUrl: "https://mainnet.sorobanrpc.com",
		horizonUrl: "https://horizon.stellar.org",
		explorerUrl: "https://stellar.expert/explorer/public",
		isProduction: true,
	},
	TESTNET: {
		id: "TESTNET",
		name: "Testnet",
		passphrase: "Test SDF Network ; September 2015",
		rpcUrl: "https://soroban-testnet.stellar.org",
		horizonUrl: "https://horizon-testnet.stellar.org",
		explorerUrl: "https://stellar.expert/explorer/testnet",
		isProduction: false,
	},
	FUTURENET: {
		id: "FUTURENET",
		name: "Futurenet",
		passphrase: "Test SDF Future Network ; October 2022",
		rpcUrl: "https://rpc-futurenet.stellar.org",
		horizonUrl: "https://horizon-futurenet.stellar.org",
		explorerUrl: "https://stellar.expert/explorer/futurenet",
		isProduction: false,
	},
	LOCAL: {
		id: "LOCAL",
		name: "Local",
		passphrase: "Standalone Network ; February 2017",
		rpcUrl: "http://localhost:8000/rpc",
		horizonUrl: "http://localhost:8000",
		explorerUrl: "https://stellar.expert/explorer/testnet",
		isProduction: false,
	},
}

const STORAGE_KEY = "stellarNetworkPreference"

interface NetworkContextType {
	network: StellarNetwork
	config: NetworkConfig
	isTestnet: boolean
	isProduction: boolean
	canSwitchNetwork: boolean
	switchNetwork: (network: StellarNetwork) => void
	availableNetworks: StellarNetwork[]
}

const NetworkContext = createContext<NetworkContextType | null>(null)

const isProductionBuild = import.meta.env.MODE === "production"

const getDefaultNetwork = (): StellarNetwork => {
	// In production, always use PUBLIC (mainnet)
	if (isProductionBuild) {
		return "PUBLIC"
	}

	// Check localStorage for saved preference
	const saved = localStorage.getItem(STORAGE_KEY) as StellarNetwork | null
	if (saved && NETWORK_CONFIGS[saved]) {
		return saved
	}

	// Check environment variable
	const envNetwork = import.meta.env.PUBLIC_STELLAR_NETWORK as
		| StellarNetwork
		| undefined
	if (envNetwork && NETWORK_CONFIGS[envNetwork]) {
		return envNetwork
	}

	return "LOCAL"
}

interface NetworkProviderProps {
	children: ReactNode
}

export function NetworkProvider({ children }: NetworkProviderProps) {
	const [network, setNetwork] = useState<StellarNetwork>(getDefaultNetwork)

	// Persist network preference to localStorage
	useEffect(() => {
		if (!isProductionBuild) {
			localStorage.setItem(STORAGE_KEY, network)
		}
	}, [network])

	const switchNetwork = useCallback(
		(newNetwork: StellarNetwork) => {
			// In production, don't allow switching to testnet
			if (isProductionBuild && !NETWORK_CONFIGS[newNetwork].isProduction) {
				console.warn(
					"Cannot switch to non-production network in production build",
				)
				return
			}

			if (network !== newNetwork) {
				setNetwork(newNetwork)
				// Reload the page to apply new network configuration
				window.location.reload()
			}
		},
		[network],
	)

	const config = NETWORK_CONFIGS[network]

	const availableNetworks = useMemo(() => {
		if (isProductionBuild) {
			return ["PUBLIC"] as StellarNetwork[]
		}
		return ["PUBLIC", "TESTNET", "FUTURENET", "LOCAL"] as StellarNetwork[]
	}, [])

	const canSwitchNetwork = !isProductionBuild

	const value = useMemo(
		() => ({
			network,
			config,
			isTestnet:
				network === "TESTNET" || network === "FUTURENET" || network === "LOCAL",
			isProduction: config.isProduction,
			canSwitchNetwork,
			switchNetwork,
			availableNetworks,
		}),
		[network, config, canSwitchNetwork, switchNetwork, availableNetworks],
	)

	return (
		<NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
	)
}

export function useNetwork(): NetworkContextType {
	const context = useContext(NetworkContext)
	if (!context) {
		throw new Error("useNetwork must be used within a NetworkProvider")
	}
	return context
}

// Re-export for convenience
export { NETWORK_CONFIGS, STORAGE_KEY }
