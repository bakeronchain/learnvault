import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { render } from "../test/setup"
import { FAQSection } from "./FAQSection"

describe("FAQSection Component", () => {
	it("renders the help center header correctly", () => {
		render(<FAQSection />)

		expect(screen.getByText("Help Center")).toBeInTheDocument()
		expect(screen.getByText(/Got questions\? We've got/i)).toBeInTheDocument()
		expect(
			screen.getByPlaceholderText(/Search by keywords/i),
		).toBeInTheDocument()
	})

	it("renders the list of FAQs", () => {
		render(<FAQSection />)

		// Check some of our questions exist
		expect(
			screen.getByText("What is Soroban and how does it integrate with LearnVault?"),
		).toBeInTheDocument()
		expect(
			screen.getByText("Which Web3 wallets are supported on LearnVault?"),
		).toBeInTheDocument()
	})

	it("can filter FAQ items by search keywords", () => {
		render(<FAQSection />)

		const searchInput = screen.getByPlaceholderText(/Search by keywords/i)

		// Search for "freighter" (Web3 wallets tag/word)
		fireEvent.change(searchInput, { target: { value: "freighter" } })

		// The freighter question should remain
		expect(
			screen.getByText("Which Web3 wallets are supported on LearnVault?"),
		).toBeInTheDocument()

		// Soroban question should NOT be visible
		expect(
			screen.queryByText(
				"What is Soroban and how does it integrate with LearnVault?",
			),
		).not.toBeInTheDocument()
	})

	it("can filter FAQ items by category tabs", () => {
		render(<FAQSection />)

		// Click on "Soroban" tab
		const sorobanTab = screen.getByRole("button", { name: /Soroban/i })
		fireEvent.click(sorobanTab)

		// Soroban question should be there
		expect(
			screen.getByText("What is Soroban and how does it integrate with LearnVault?"),
		).toBeInTheDocument()

		// Web3 Wallets question should NOT be there
		expect(
			screen.queryByText("Which Web3 wallets are supported on LearnVault?"),
		).not.toBeInTheDocument()
	})

	it("expands and collapses accordions on click", async () => {
		render(<FAQSection />)

		const questionText =
			"What is Soroban and how does it integrate with LearnVault?"
		const questionButton = screen.getByRole("button", { name: new RegExp(questionText, "i") })

		// Answer shouldn't be visible initially (not rendered or height 0 inside accordion)
		expect(screen.queryByText(/native, high-performance smart contract platform/i)).not.toBeInTheDocument()

		// Click to expand
		fireEvent.click(questionButton)

		// Answer should now be visible in the DOM
		expect(await screen.findByText(/native, high-performance smart contract platform/i)).toBeInTheDocument()
	})

	it("can submit helpful feedback on individual FAQ items", async () => {
		render(<FAQSection />)

		// First, expand the accordion to make the helpfulness buttons visible
		const questionText =
			"What is Soroban and how does it integrate with LearnVault?"
		const questionButton = screen.getByRole("button", { name: new RegExp(questionText, "i") })
		fireEvent.click(questionButton)

		// Click Thumbs Up button
		const thumbsUpButton = await screen.findByRole("button", { name: /yes/i })
		fireEvent.click(thumbsUpButton)

		// The thank you message should show up
		expect(await screen.findByText("Thank you!")).toBeInTheDocument()
	})
})
