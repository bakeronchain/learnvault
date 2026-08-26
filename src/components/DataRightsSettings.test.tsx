import { userEvent } from "@testing-library/user-event"
import { vi } from "vitest"

import "../i18n"
import { WalletContext } from "../providers/WalletProvider"
import { render, screen, waitFor } from "../test/setup"
import { DataRightsSettings } from "./DataRightsSettings"

const ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"

function renderSettings() {
	return render(
		<WalletContext.Provider
			value={{
				address: ADDRESS,
				balances: {},
				isPending: false,
				isReconnecting: false,
				signTransaction: vi.fn().mockResolvedValue({
					signedTxXdr: "signed-xdr",
					signerAddress: ADDRESS,
				}),
				updateBalances: vi.fn(),
			}}
		>
			<DataRightsSettings />
		</WalletContext.Provider>,
	)
}

describe("DataRightsSettings", () => {
	beforeEach(() => {
		localStorage.setItem("authToken", "token")
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ pending: false }),
		})
	})

	it("discloses permanent on-chain records before deletion confirmation", async () => {
		renderSettings()
		await userEvent.click(
			screen.getByRole("button", { name: /delete account/i }),
		)

		expect(
			screen.getByText(/LRN transfers, minted ScholarNFTs, and treasury/i),
		).toBeInTheDocument()
		const confirmButton = screen.getByRole("button", {
			name: /schedule deletion/i,
		})
		expect(confirmButton).toBeDisabled()

		await userEvent.type(
			screen.getByLabelText(/type DELETE MY ACCOUNT/i),
			"DELETE MY ACCOUNT",
		)
		expect(confirmButton).toBeEnabled()
	})

	it("queues an export and shows its status", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ pending: false }),
			} as Response)
			.mockResolvedValueOnce({
				ok: true,
				status: 202,
				json: async () => ({ id: "job-1", status: "pending" }),
			} as Response)

		renderSettings()
		await userEvent.click(
			screen.getByRole("button", { name: /request export/i }),
		)

		await waitFor(() => {
			expect(screen.getByText(/export queued/i)).toBeInTheDocument()
		})
		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining("/api/me/export"),
			expect.objectContaining({ method: "POST" }),
		)
	})

	it("shows a signed download link when the export is ready", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ pending: false }),
			} as Response)
			.mockResolvedValueOnce({
				ok: true,
				status: 202,
				json: async () => ({
					id: "job-1",
					status: "ready",
					downloadUrl: "/api/me/export/job-1/download?token=signed",
				}),
			} as Response)

		renderSettings()
		await userEvent.click(
			screen.getByRole("button", { name: /request export/i }),
		)

		const download = await screen.findByRole("link", {
			name: /download archive/i,
		})
		expect(download).toHaveAttribute(
			"href",
			"/api/me/export/job-1/download?token=signed",
		)
	})

	it("re-authenticates with the wallet before scheduling deletion", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ pending: false }),
			} as Response)
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({
					transaction: "challenge-xdr",
					networkPassphrase: "Test SDF Network ; September 2015",
				}),
			} as Response)
			.mockResolvedValueOnce({
				ok: true,
				status: 202,
				json: async () => ({ eraseAfter: "2026-09-24T12:00:00.000Z" }),
			} as Response)

		renderSettings()
		await userEvent.click(
			screen.getByRole("button", { name: /delete account/i }),
		)
		await userEvent.type(
			screen.getByLabelText(/type DELETE MY ACCOUNT/i),
			"DELETE MY ACCOUNT",
		)
		await userEvent.click(
			screen.getByRole("button", { name: /schedule deletion/i }),
		)

		expect(
			await screen.findByRole("button", {
				name: /cancel account deletion/i,
			}),
		).toBeInTheDocument()
		expect(fetch).toHaveBeenLastCalledWith(
			expect.stringContaining("/api/me"),
			expect.objectContaining({
				method: "DELETE",
				body: expect.stringContaining("signed-xdr"),
			}),
		)
	})

	it("shows and cancels a pending deletion", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({
					pending: true,
					eraseAfter: "2026-09-24T12:00:00.000Z",
				}),
			} as Response)
			.mockResolvedValueOnce({
				ok: true,
				status: 204,
				json: async () => ({}),
			} as Response)

		renderSettings()
		const cancel = await screen.findByRole("button", {
			name: /cancel account deletion/i,
		})
		await userEvent.click(cancel)

		await waitFor(() => {
			expect(
				screen.queryByRole("button", { name: /cancel account deletion/i }),
			).not.toBeInTheDocument()
		})
	})
})
