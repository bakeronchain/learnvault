import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useOnlineStatus } from "../hooks/useOnlineStatus"
import { OfflineIndicator } from "./OfflineIndicator"

vi.mock("../hooks/useOnlineStatus", () => ({
	useOnlineStatus: vi.fn().mockReturnValue({
		isOnline: true,
		wasOffline: false,
		checkOnline: vi.fn(),
	}),
}))

const mockUseOnlineStatus = vi.mocked(useOnlineStatus)

describe("OfflineIndicator", () => {
	it("renders nothing when online and was not offline", () => {
		mockUseOnlineStatus.mockReturnValue({
			isOnline: true,
			wasOffline: false,
			checkOnline: vi.fn(),
		})
		const { container } = render(<OfflineIndicator />)
		expect(container.firstChild).toBeNull()
	})

	it("shows offline indicator when offline", () => {
		mockUseOnlineStatus.mockReturnValue({
			isOnline: false,
			wasOffline: false,
			checkOnline: vi.fn(),
		})
		render(<OfflineIndicator />)
		expect(screen.getByText(/Offline/)).toBeDefined()
	})

	it("shows back online message during wasOffline period", () => {
		mockUseOnlineStatus.mockReturnValue({
			isOnline: true,
			wasOffline: true,
			checkOnline: vi.fn(),
		})
		render(<OfflineIndicator />)
		expect(screen.getByText(/Back online/)).toBeDefined()
	})
})
