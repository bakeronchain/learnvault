import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PasskeySignup from "./PasskeySignup"

const mockRegister = vi.fn()
let mockState: {
	isRegistering: boolean
	isPasskeySupported: boolean
	error: string | null
}

vi.mock("../hooks/usePasskeyWallet", () => ({
	usePasskeyWallet: () => ({
		register: mockRegister,
		...mockState,
	}),
}))

describe("PasskeySignup", () => {
	beforeEach(() => {
		mockRegister.mockReset()
		mockState = { isRegistering: false, isPasskeySupported: true, error: null }
	})

	it("renders nothing when the browser doesn't support passkeys", () => {
		mockState.isPasskeySupported = false
		render(<PasskeySignup />)

		expect(
			screen.queryByRole("button", { name: /continue with face id/i }),
		).not.toBeInTheDocument()
	})

	it("calls register() and the onSuccess callback when clicked", async () => {
		mockRegister.mockResolvedValue("CNEWWALLET")
		const onSuccess = vi.fn()
		const user = userEvent.setup()

		render(<PasskeySignup onSuccess={onSuccess} />)

		await user.click(
			screen.getByRole("button", { name: /continue with face id/i }),
		)

		await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("CNEWWALLET"))
	})

	it("shows a busy label and disables the button while registering", () => {
		mockState.isRegistering = true
		render(<PasskeySignup />)

		const button = screen.getByRole("button", { name: /creating your wallet/i })
		expect(button).toBeDisabled()
	})

	it("surfaces the hook's error message", () => {
		mockState.error = "Passkeys aren't supported in this browser"
		render(<PasskeySignup />)

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Passkeys aren't supported in this browser",
		)
	})

	it("does not call onSuccess when register() rejects", async () => {
		mockRegister.mockRejectedValue(new Error("deploy failed"))
		const onSuccess = vi.fn()
		const user = userEvent.setup()

		render(<PasskeySignup onSuccess={onSuccess} />)
		await user.click(
			screen.getByRole("button", { name: /continue with face id/i }),
		)

		await waitFor(() => expect(mockRegister).toHaveBeenCalled())
		expect(onSuccess).not.toHaveBeenCalled()
	})
})
