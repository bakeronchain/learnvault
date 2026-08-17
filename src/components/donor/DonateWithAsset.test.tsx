import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { DonateWithAsset } from "./DonateWithAsset"

// Mock the wallet hook
vi.mock("../../hooks/useWallet", () => ({
	useWallet: () => ({
		address: "GABC1234567890ABCDEF",
		signTransaction: vi.fn(),
		balances: [],
		isConnected: true,
	}),
}))

// Mock the toast hook
vi.mock("../Toast/ToastProvider", () => ({
	useToast: () => ({
		showSuccess: vi.fn(),
		showError: vi.fn(),
		showInfo: vi.fn(),
	}),
}))

describe("DonateWithAsset", () => {
	it("renders the donate form heading", () => {
		render(<DonateWithAsset />)
		expect(screen.getByText("Donate Any Asset")).toBeDefined()
	})

	it("renders amount input label", () => {
		render(<DonateWithAsset />)
		expect(screen.getByText("Amount to Send")).toBeDefined()
	})

	it("renders slippage tolerance controls", () => {
		render(<DonateWithAsset />)
		expect(screen.getByText("Slippage Tolerance")).toBeDefined()
	})

	it("renders quick select section", () => {
		render(<DonateWithAsset />)
		expect(screen.getByText("Quick Select")).toBeDefined()
	})

	it("renders donation currency section", () => {
		render(<DonateWithAsset />)
		expect(screen.getByText("Donation Currency")).toBeDefined()
	})
})
