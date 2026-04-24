import { vi } from "vitest"

// Mock contract method responses
export const createMockContractMethod = <T = any>(returnValue: T) => {
	return vi.fn().mockResolvedValue({ result: returnValue })
}

export const createMockContractMethodError = (error: any) => {
	return vi.fn().mockResolvedValue({ result: { isErr: () => true, ...error } })
}

// Common contract method mocks
export const mockContractMethods = {
	// Token contract methods
	balance: createMockContractMethod(1000n),
	mint: createMockContractMethod(undefined),
	transfer: createMockContractMethod(undefined),
	approve: createMockContractMethod(undefined),
	allowance: createMockContractMethod(500n),

	// Governance contract methods
	vote: createMockContractMethod(undefined),
	getProposal: createMockContractMethod({
		title: "Test Proposal",
		description: "Test Description",
		yes_votes: 100n,
		no_votes: 50n,
	}),
	getVotingPower: createMockContractMethod(1000n),

	// Scholarship contract methods
	apply: createMockContractMethod(undefined),
	getApplication: createMockContractMethod({
		applicant: "GTEST1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO",
		status: "pending",
	}),
	withdraw: createMockContractMethod(undefined),

	// Guess the number contract methods
	guess: createMockContractMethod({ correct: true, reward: 100n }),
	getGameState: createMockContractMethod({
		number: 42,
		reward_pool: 1000n,
	}),
}

// Contract client factory
export const createMockContractClient = (
	contractName: string,
	methods: Record<string, any>,
) => {
	const mockClient: Record<string, any> = {}

	Object.entries(methods).forEach(([methodName, mockFn]) => {
		mockClient[methodName] = mockFn
	})

	return mockClient
}

// Pre-configured contract mocks
export const mockContracts = {
	learnToken: createMockContractClient("learn_token", {
		balance: mockContractMethods.balance,
		mint: mockContractMethods.mint,
		transfer: mockContractMethods.transfer,
		approve: mockContractMethods.approve,
		allowance: mockContractMethods.allowance,
	}),

	governanceToken: createMockContractClient("governance_token", {
		vote: mockContractMethods.vote,
		getProposal: mockContractMethods.getProposal,
		getVotingPower: mockContractMethods.getVotingPower,
	}),

	scholarshipTreasury: createMockContractClient("scholarship_treasury", {
		apply: mockContractMethods.apply,
		getApplication: mockContractMethods.getApplication,
		withdraw: mockContractMethods.withdraw,
		vote: createMockContractMethod(undefined),
		cast_vote: createMockContractMethod(undefined),
		get_active_proposals: createMockContractMethod([]),
		get_proposals_by_status: createMockContractMethod([]),
		has_voted: createMockContractMethod(false),
	}),

	guessTheNumber: createMockContractClient("guess_the_number", {
		guess: mockContractMethods.guess,
		getGameState: mockContractMethods.getGameState,
	}),
}

// Dynamic import mock for contract clients
export const mockContractImports: Record<string, any> = {
	"../contracts/learn_token": mockContracts.learnToken,
	"../contracts/governance_token": mockContracts.governanceToken,
	"../contracts/scholarship_treasury": mockContracts.scholarshipTreasury,
	"../contracts/guess_the_number": mockContracts.guessTheNumber,
}

// Helper to mock contract imports in tests
export const mockContractImport = (
	contractPath: string,
	customMethods?: Record<string, any>,
) => {
	const baseMock = mockContractImports[contractPath] || {}
	const customMock = customMethods
		? createMockContractClient(contractPath, customMethods)
		: {}

	return {
		default: { ...baseMock, ...customMock },
	}
}

// Helper to reset all contract mocks
export const resetContractMocks = () => {
	vi.clearAllMocks()

	// Re-create default mocks after clearing
	Object.values(mockContractMethods).forEach((mockFn) => {
		if (typeof mockFn.mockReset === "function") {
			mockFn.mockReset()
		}
	})
}

// Helper to setup contract mocks for a specific contract
export const setupContractMock = (
	contractName: string,
	customMethods?: Record<string, any>,
) => {
	const contractPath = `../contracts/${contractName}`
	const mock = mockContractImport(contractPath, customMethods)

	vi.doMock(contractPath, () => mock)

	return mock
}
