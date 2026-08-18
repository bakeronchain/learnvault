/**
 * Deploys per-learner PasskeyWallet smart contract instances
 * (contracts/passkey_wallet) — a secp256r1/WebAuthn smart wallet with no
 * seed phrase. Deployment is sponsored: the platform's funding key pays,
 * the learner signs nothing on-chain to get started.
 */

import crypto from "crypto"
import { pool } from "../db/index"
import { logger } from "../lib/logger"

const log = logger.child({ module: "passkey-wallet" })

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet"
const STELLAR_SECRET_KEY = process.env.STELLAR_SECRET_KEY ?? ""
const PASSKEY_WALLET_WASM_HASH = process.env.PASSKEY_WALLET_WASM_HASH ?? ""

export interface DeployPasskeyWalletParams {
	/** Base64url-encoded WebAuthn credential ID. */
	credentialId: string
	/** Base64url-encoded 65-byte uncompressed SEC1 P-256 public key. */
	publicKey: string
	deviceLabel?: string
}

export interface DeployPasskeyWalletResult {
	contractAddress: string
	txHash: string
}

function decodeBase64Url(value: string, field: string): Buffer {
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(`${field} is required`)
	}
	const buf = Buffer.from(value, "base64url")
	if (buf.length === 0) {
		throw new Error(`${field} is not valid base64url`)
	}
	return buf
}

function validateDeployParams(params: DeployPasskeyWalletParams): {
	credentialIdBytes: Buffer
	publicKeyBytes: Buffer
} {
	const credentialIdBytes = decodeBase64Url(params.credentialId, "credentialId")
	const publicKeyBytes = decodeBase64Url(params.publicKey, "publicKey")

	if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
		throw new Error(
			"publicKey must be a 65-byte uncompressed SEC1 P-256 point (0x04 prefix)",
		)
	}

	return { credentialIdBytes, publicKeyBytes }
}

/**
 * Deploy a new PasskeyWallet instance for a learner and record the
 * credential that controls it. The resulting contract address is the
 * learner's identity going forward — it's what gets stored as their
 * walletAddress everywhere else in LearnVault.
 */
export async function deployPasskeyWallet(
	params: DeployPasskeyWalletParams,
): Promise<DeployPasskeyWalletResult> {
	const { credentialIdBytes, publicKeyBytes } = validateDeployParams(params)

	if (!STELLAR_SECRET_KEY) {
		throw new Error(
			"STELLAR_SECRET_KEY not configured — cannot sponsor deployment",
		)
	}
	if (!PASSKEY_WALLET_WASM_HASH) {
		throw new Error(
			"PASSKEY_WALLET_WASM_HASH not configured — cannot deploy wallet contract",
		)
	}

	const {
		Keypair,
		Address,
		Operation,
		TransactionBuilder,
		Networks,
		BASE_FEE,
		rpc,
		xdr,
	} = await import("@stellar/stellar-sdk")

	const server = new rpc.Server(
		STELLAR_NETWORK === "mainnet"
			? "https://soroban-rpc.stellar.org"
			: "https://soroban-testnet.stellar.org",
	)

	const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY)

	try {
		const account = await server.getAccount(keypair.publicKey())
		const salt = crypto.randomBytes(32)

		const op = Operation.createCustomContract({
			address: new Address(keypair.publicKey()),
			wasmHash: Buffer.from(PASSKEY_WALLET_WASM_HASH, "hex"),
			salt,
			constructorArgs: [
				xdr.ScVal.scvBytes(credentialIdBytes),
				xdr.ScVal.scvBytes(publicKeyBytes),
			],
		})

		const tx = new TransactionBuilder(account, {
			fee: BASE_FEE,
			networkPassphrase:
				STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
		})
			.addOperation(op)
			.setTimeout(30)
			.build()

		const prepared = await server.prepareTransaction(tx)
		prepared.sign(keypair)

		const submitted = await server.sendTransaction(prepared)
		if (submitted.status === "ERROR") {
			throw new Error(
				"Passkey wallet deployment rejected: " +
					JSON.stringify(submitted.errorResult ?? submitted.status),
			)
		}

		const final = await server.pollTransaction(submitted.hash)
		if (final.status !== "SUCCESS") {
			throw new Error(
				`Passkey wallet deployment did not finalize: ${final.status}`,
			)
		}
		if (!final.returnValue) {
			throw new Error(
				"Passkey wallet deployment succeeded but returned no contract address",
			)
		}

		const contractAddress = Address.fromScVal(final.returnValue).toString()

		await pool.query(
			`INSERT INTO passkey_credentials (contract_address, credential_id, public_key, device_label)
			 VALUES ($1, $2, $3, $4)`,
			[
				contractAddress,
				params.credentialId,
				params.publicKey,
				params.deviceLabel ?? null,
			],
		)

		return { contractAddress, txHash: submitted.hash }
	} catch (err) {
		log.error({ err }, "Passkey wallet deployment failed")
		throw new Error(
			"Passkey wallet deployment failed: " +
				(err instanceof Error ? err.message : String(err)),
		)
	}
}
