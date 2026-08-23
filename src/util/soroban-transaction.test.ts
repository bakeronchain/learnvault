import {
	rpc,
	Transaction,
	TransactionBuilder,
	type xdr,
} from "@stellar/stellar-sdk"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
	prepareAndConfirmTransaction,
	SorobanTransactionError,
} from "./soroban-transaction"

vi.mock("@stellar/stellar-sdk", async () => ({
	...(await vi.importActual("@stellar/stellar-sdk")),
	rpc: { Server: vi.fn() },
	Transaction: vi.fn(),
	TransactionBuilder: vi.fn(),
}))

describe("prepareAndConfirmTransaction #1017", () => {
	const server = {
		getAccount: vi.fn(),
		prepareTransaction: vi.fn(),
		sendTransaction: vi.fn(),
		getTransaction: vi.fn(),
	}
	const builder = {
		addOperation: vi.fn().mockReturnThis(),
		setTimeout: vi.fn().mockReturnThis(),
		build: vi.fn().mockReturnValue({ toXDR: () => "built-xdr" }),
	}
	const signTransaction = vi.fn()
	const options = {
		operation: {} as xdr.Operation,
		address: "G".padEnd(56, "A"),
		networkPassphrase: "Test SDF Network ; September 2015",
		rpcUrl: "https://soroban-testnet.stellar.org",
		signTransaction,
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(rpc.Server).mockImplementation(function () {
			return server as never
		})
		vi.mocked(TransactionBuilder).mockImplementation(function () {
			return builder as never
		})
		vi.mocked(Transaction).mockImplementation(function () {
			return {} as never
		})
		server.getAccount.mockResolvedValue({})
		server.prepareTransaction.mockResolvedValue({
			toXDR: () => "prepared-xdr",
		})
		server.sendTransaction.mockResolvedValue({
			status: "PENDING",
			hash: "a".repeat(64),
		})
		server.getTransaction.mockResolvedValue({ status: "SUCCESS" })
	})

	it("firma el XDR preparado y espera confirmación on-chain", async () => {
		signTransaction.mockResolvedValue({ signedTxXdr: "signed-xdr" })

		const result = await prepareAndConfirmTransaction(options)

		expect(signTransaction).toHaveBeenCalledWith("prepared-xdr", {
			networkPassphrase: options.networkPassphrase,
		})
		expect(Transaction).toHaveBeenCalledWith(
			"signed-xdr",
			options.networkPassphrase,
		)
		expect(server.getTransaction).toHaveBeenCalledWith("a".repeat(64))
		expect(result).toBe("a".repeat(64))
	})

	it("rechaza enviar una transacción sin firma de Freighter", async () => {
		signTransaction.mockResolvedValue({ signedTxXdr: "" })

		await expect(prepareAndConfirmTransaction(options)).rejects.toThrow(
			"Wallet signature required",
		)
		expect(server.sendTransaction).not.toHaveBeenCalled()
		expect(SorobanTransactionError).toBeDefined()
	})
})
