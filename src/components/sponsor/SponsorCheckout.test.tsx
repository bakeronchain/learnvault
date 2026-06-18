import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { render } from "../../test/setup"
import { SponsorCheckout } from "./SponsorCheckout"

describe("SponsorCheckout Component", () => {
	it("renders the sponsorship portal headers and checkout panels", () => {
		render(<SponsorCheckout />)

		expect(screen.getByText("Sponsorship Gateway")).toBeInTheDocument()
		expect(screen.getByText(/Sponsor/i)).toBeInTheDocument()
		expect(screen.getByPlaceholderText(/Paste student addresses here/i)).toBeInTheDocument()
		expect(screen.getByText("2. Checkout Summary")).toBeInTheDocument()
	})

	it("validates Stellar public keys starting with G and exactly 56 chars", async () => {
		render(<SponsorCheckout />)

		const textarea = screen.getByPlaceholderText(/Paste student addresses here/i)

		// Type an invalid address (too short)
		fireEvent.change(textarea, { target: { value: "GBR123" } })

		expect(screen.getByText("Failed: Invalid length (6/56 characters)")).toBeInTheDocument()

		// Type an invalid prefix address
		fireEvent.change(textarea, { target: { value: "ABR1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO123456" } })
		expect(screen.getByText("Failed: Must start with capital 'G'")).toBeInTheDocument()

		// Type a valid address
		fireEvent.change(textarea, { target: { value: "GDCB7T43EX74M36DRE66TWRK3V66S6BOU5M64R33X3QYRE2YQ6677WRK" } })
		expect(screen.queryByText(/Failed:/i)).not.toBeInTheDocument()
		expect(screen.getByText("Passed")).toBeInTheDocument()
	})

	it("computes subtotal volume and estimated gas fees in real-time", () => {
		render(<SponsorCheckout />)

		const textarea = screen.getByPlaceholderText(/Paste student addresses here/i)

		// Insert two valid addresses
		fireEvent.change(textarea, {
			target: {
				value: "GDCB7T43EX74M36DRE66TWRK3V66S6BOU5M64R33X3QYRE2YQ6677WRK\nGBR75X63EX74M36DRE66TWRK3V66S6BOU5M64R33X3QYRE2YQ6677WRK",
			},
		})

		// Validate count matches
		expect(screen.getByText("2 Valid")).toBeInTheDocument()

		// 2 students * 25 USDC = 50 USDC subtotal
		expect(screen.getByText("50 USDC")).toBeInTheDocument()

		// 2 students * 0.05 XLM = 0.10 XLM gas fee
		expect(screen.getByText("0.10 XLM")).toBeInTheDocument()
	})

	it("authorizes checkout and shows a comprehensive success receipt panel", async () => {
		render(<SponsorCheckout />)

		const textarea = screen.getByPlaceholderText(/Paste student addresses here/i)

		// Insert valid address
		fireEvent.change(textarea, {
			target: {
				value: "GDCB7T43EX74M36DRE66TWRK3V66S6BOU5M64R33X3QYRE2YQ6677WRK",
			},
		})

		const authorizeButton = screen.getByRole("button", { name: /Authorize & Fund/i })
		expect(authorizeButton).toBeEnabled()

		// Click Authorize
		fireEvent.click(authorizeButton)

		// Should show loading status first
		expect(screen.getByText(/Signing Blockchain Payload/i)).toBeInTheDocument()

		// Wait for receipt transition
		expect(await screen.findByText("Sponsorship Transaction Completed")).toBeInTheDocument()
		expect(await screen.findByText("Invoice Receipt")).toBeInTheDocument()
		expect(await screen.findByText("Stellar Transaction Hash")).toBeInTheDocument()
	})
})
