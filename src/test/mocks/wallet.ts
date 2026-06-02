import { vi } from "vitest"

// Mock types for Stellar Wallets Kit
export interface MockWalletOptions {
	address?: string
	network?: string
	networkPassphrase?: string
	isConnected?: boolean
}

export const createMockWallet = (options: MockWalletOptions = {}) => {
	const {
		address = "GTEST1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO",
		network = "TESTNET",
		networkPassphrase = "Test SDF Network ; September 2015",
		isConnected = true,
	} = options

	return {
		// StellarWalletsKit mock
		StellarWalletsKit: vi.fn().mockImplementation(() => ({
			openModal: vi.fn().mockImplementation(({ onWalletSelected }) => {
				onWalletSelected({
					id: "freighter",
					name: "Freighter",
					icon: "freighter-icon.png",
				})
			}),
			setWallet: vi.fn(),
			getAddress: vi.fn().mockResolvedValue({
				address: isConnected ? address : undefined,
			}),
			getNetwork: vi.fn().mockResolvedValue({
				network,
				networkPassphrase,
			}),
			signTransaction: vi.fn().mockResolvedValue("signed-xdr-mock"),
			disconnect: vi.fn(),
		})),

		// Module exports
		connectWallet: vi.fn(),
		disconnectWallet: vi.fn(),
		fetchBalances: vi.fn().mockResolvedValue({
			xlm: {
				balance: "100.0000000",
				asset_type: "native",
			},
		}),
		wallet: {
			openModal: vi.fn(),
			setWallet: vi.fn(),
			getAddress: vi.fn().mockResolvedValue({
				address: isConnected ? address : undefined,
			}),
			getNetwork: vi.fn().mockResolvedValue({
				network,
				networkPassphrase,
			}),
			signTransaction: vi.fn().mockResolvedValue("signed-xdr-mock"),
			disconnect: vi.fn(),
		},
	}
}

// Default mock wallet instance
export const mockWallet = createMockWallet()

// Mock the entire @creit.tech/stellar-wallets-kit module
export const mockStellarWalletsKit = {
	StellarWalletsKit: mockWallet.StellarWalletsKit,
	sep43Modules: vi.fn().mockReturnValue([]),
}

// Mock wallet utility functions
export const mockWalletUtils = {
	connectWallet: mockWallet.connectWallet,
	disconnectWallet: mockWallet.disconnectWallet,
	fetchBalances: mockWallet.fetchBalances,
	wallet: mockWallet.wallet,
}

// Helper to reset all wallet mocks
export const resetWalletMocks = () => {
	vi.clearAllMocks()
	// Re-create default mocks after clearing
	const freshMock = createMockWallet()
	Object.assign(mockWallet, freshMock)
}
