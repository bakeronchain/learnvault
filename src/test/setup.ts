import "@testing-library/jest-dom/vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, type RenderOptions } from "@testing-library/react"
import { createElement, type ReactElement, type ReactNode } from "react"
import { afterEach, vi } from "vitest"

// Import our custom mocks
import { mockContracts } from "./mocks/contracts"
import { mockStellarWalletsKit, mockWalletUtils } from "./mocks/wallet"

// ---------------------------------------------------------------------------
// Global Mocks
// ---------------------------------------------------------------------------

// Mock @creit.tech/stellar-wallets-kit
vi.mock("@creit.tech/stellar-wallets-kit", () => mockStellarWalletsKit)

// Mock wallet utility functions
vi.mock("../util/wallet", () => mockWalletUtils)

// Mock contract client imports
vi.mock("../contracts/learn_token", () => ({
	default: mockContracts.learnToken,
}))

vi.mock("../contracts/governance_token", () => ({
	default: mockContracts.governanceToken,
}))

vi.mock("../contracts/scholarship_treasury", () => ({
	default: mockContracts.scholarshipTreasury,
}))

vi.mock("../contracts/guess_the_number", () => ({
	default: mockContracts.guessTheNumber,
}))
// Mock contract client dynamic imports
vi.mock(
	"../contracts/learn_token",
	() => mockContractImports["../contracts/learn_token"],
)
vi.mock(
	"../contracts/governance_token",
	() => mockContractImports["../contracts/governance_token"],
)
vi.mock(
	"../contracts/scholarship_treasury",
	() => mockContractImports["../contracts/scholarship_treasury"],
)
vi.mock(
	"../contracts/guess_the_number",
	() => mockContractImports["../contracts/guess_the_number"],
)

// Mock @stellar/design-system to avoid CSS import issues
vi.mock("@stellar/design-system", () => ({
	Alert: () => null,
	Button: () => null,
	Heading: () => null,
	Icon: {
		Circle: () => null,
		Checkmark: () => null,
		ChevronDown: () => null,
		ChevronUp: () => null,
		Close: () => null,
		Info: () => null,
		Warning: () => null,
		Error: () => null,
	},
	SearchInput: () => null,
	Select: () => null,
	TextArea: () => null,
	TextInput: () => null,
	Toggle: () => null,
}))

// Mock environment variables for contract IDs
vi.mock("../contracts/util", () => ({
	rpcUrl: "http://localhost:8000/rpc",
	stellarNetwork: "TESTNET",
	networkPassphrase: "Test SDF Network ; September 2015",
	horizonUrl: "https://horizon-testnet.stellar.org",
	network: {
		id: "testnet",
		label: "testnet",
		passphrase: "Test SDF Network ; September 2015",
		rpcUrl: "http://localhost:8000/rpc",
		horizonUrl: "https://horizon-testnet.stellar.org",
	},
	labPrefix: () =>
		"https://lab.stellar.org/transaction-dashboard?$=network$id=testnet",
}))

// Mock import.meta.env for contract IDs
const mockEnv = {
	PUBLIC_STELLAR_NETWORK: "TESTNET",
	PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
	PUBLIC_STELLAR_RPC_URL: "http://localhost:8000/rpc",
	PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
	PUBLIC_LEARN_TOKEN_CONTRACT_ID:
		"CLEARN1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO",
	PUBLIC_GOVERNANCE_TOKEN_CONTRACT_ID:
		"CGOV1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO",
	PUBLIC_SCHOLARSHIP_TREASURY_CONTRACT_ID:
		"CSCHOL1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO",
	PUBLIC_GUESS_THE_NUMBER_CONTRACT_ID:
		"CGUESS1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO",
}

// Stub import.meta.env for modules that read contract addresses at load time
vi.stubEnv(
	"PUBLIC_SCHOLARSHIP_TREASURY_CONTRACT",
	mockEnv.PUBLIC_SCHOLARSHIP_TREASURY_CONTRACT_ID,
)
vi.stubEnv(
	"PUBLIC_GOVERNANCE_TOKEN_CONTRACT",
	mockEnv.PUBLIC_GOVERNANCE_TOKEN_CONTRACT_ID,
)

Object.defineProperty(window, "import", {
	value: {
		meta: {
			env: mockEnv,
		},
	},
	writable: true,
})

// Mock import.meta.env directly (for TypeScript compatibility)
vi.mock("../hooks/useContractIds", () => ({
	useContractIds: () => ({
		learnToken: mockEnv.PUBLIC_LEARN_TOKEN_CONTRACT_ID,
		governanceToken: mockEnv.PUBLIC_GOVERNANCE_TOKEN_CONTRACT_ID,
		scholarshipTreasury: mockEnv.PUBLIC_SCHOLARSHIP_TREASURY_CONTRACT_ID,
		guessTheNumber: mockEnv.PUBLIC_GUESS_THE_NUMBER_CONTRACT_ID,
		isDeployed: (id: string | undefined) => Boolean(id),
	}),
}))

// Mock localStorage
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
}
Object.defineProperty(window, "localStorage", {
	value: localStorageMock,
	writable: true,
})

// ---------------------------------------------------------------------------
// Global Test Utilities
// ---------------------------------------------------------------------------

// Create a test query client for each test
const createTestQueryClient = () => {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				gcTime: 0,
			},
			mutations: {
				retry: false,
			},
		},
	})
}

// Mock wallet context value for testing
export const createMockWalletContext = (overrides = {}) => {
	return {
		address: "GTEST1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO",
		balances: {
			xlm: {
				balance: "100.0000000",
				asset_type: "native",
			},
		},
		isPending: false,
		isReconnecting: false,
		network: "TESTNET",
		networkPassphrase: "Test SDF Network ; September 2015",
		signTransaction: vi.fn().mockResolvedValue("signed-xdr-mock"),
		updateBalances: vi.fn().mockResolvedValue(undefined),
		...overrides,
	}
}

// Global render wrapper with providers
interface AllTheProvidersProps {
	children: ReactNode
	walletContext?: any
	queryClient?: QueryClient
}

const AllTheProviders = ({
	children,
	walletContext: _walletContext,
	queryClient,
}: AllTheProvidersProps) => {
	const testQueryClient = queryClient || createTestQueryClient()

	return createElement(
		QueryClientProvider,
		{ client: testQueryClient },
		createElement("div", { "data-testid": "test-wrapper" }, children),
	)
}

// Custom render function with providers
const customRender = (
	ui: ReactElement,
	options: RenderOptions & {
		walletContext?: any
		queryClient?: QueryClient
	} = {},
) => {
	const { walletContext, queryClient, ...renderOptions } = options

	return render(ui, {
		wrapper: ({ children }) =>
			AllTheProviders({ children, walletContext, queryClient }),
		...renderOptions,
	})
}

// Mock notification context
export const mockNotificationContext = {
	addNotification: vi.fn(),
	removeNotification: vi.fn(),
	notifications: [],
}

// Mock subscription hook
vi.mock("../hooks/useSubscription", () => ({
	useSubscription: vi.fn(),
}))

// Re-export testing utilities
export * from "@testing-library/react"
export { customRender as render }
export { createTestQueryClient }
export { mockEnv }

// Global cleanup
afterEach(() => {
	// Clear all mocks
	vi.clearAllMocks()

	// Reset localStorage mock
	localStorageMock.getItem.mockClear()
	localStorageMock.setItem.mockClear()
	localStorageMock.removeItem.mockClear()
	localStorageMock.clear.mockClear()
})
