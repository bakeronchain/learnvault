import { Address, nativeToScVal, type xdr } from "@stellar/stellar-sdk"

type WalletSignTransaction = (
	xdr: string,
	opts?: { networkPassphrase?: string },
) => Promise<unknown>

/**
 * sha256 via the browser's Web Crypto API. Used for both the evidence hash
 * (`sha256(cid)`) and the commit-reveal commitment -- the arbitration
 * contract never receives evidence text or a raw vote before reveal, only
 * hashes.
 */
async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		bytes.slice().buffer as ArrayBuffer,
	)
	return new Uint8Array(digest)
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
	const total = parts.reduce((sum, part) => sum + part.length, 0)
	const out = new Uint8Array(total)
	let offset = 0
	for (const part of parts) {
		out.set(part, offset)
		offset += part.length
	}
	return out
}

function u64BeBytes(value: bigint): Uint8Array {
	const bytes = new Uint8Array(8)
	const view = new DataView(bytes.buffer)
	view.setBigUint64(0, value, false)
	return bytes
}

/** A fresh, cryptographically random 32-byte salt for one commit-reveal vote. */
export function generateSalt(): Uint8Array {
	const salt = new Uint8Array(32)
	crypto.getRandomValues(salt)
	return salt
}

/** `sha256(utf8(ipfsCid))` -- the only evidence reference ever written on-chain. */
export async function hashEvidenceCid(ipfsCid: string): Promise<Uint8Array> {
	return sha256(new TextEncoder().encode(ipfsCid))
}

/**
 * `sha256(dispute_id (8 bytes, big-endian) ++ vote_byte (0/1) ++ salt (32 bytes))`,
 * matching `milestone_arbitration::compute_commitment` exactly. Store the
 * salt locally (or let the juror re-derive it) -- it is required again at
 * reveal time, and a lost salt means a lost vote.
 */
export async function computeVoteCommitment(
	disputeId: bigint,
	vote: boolean,
	salt: Uint8Array,
): Promise<Uint8Array> {
	const voteByte = new Uint8Array([vote ? 1 : 0])
	return sha256(concatBytes(u64BeBytes(disputeId), voteByte, salt))
}

export function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
}

export function hexToBytes(hex: string): Uint8Array {
	const clean = hex.startsWith("0x") ? hex.slice(2) : hex
	const bytes = new Uint8Array(clean.length / 2)
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
	}
	return bytes
}

async function submit(options: {
	contractId: string
	methodName: string
	sourceAddress: string
	signTransaction: WalletSignTransaction
	args: xdr.ScVal[]
}): Promise<string> {
	const { invokeContractMethod } = await import("../util/sorobanAdmin")
	return invokeContractMethod({
		contractId: options.contractId,
		methodName: options.methodName,
		sourceAddress: options.sourceAddress,
		signTransaction: options.signTransaction,
		args: options.args,
	})
}

/** Stake LRN to join the eligible-juror pool (`join_panel`). */
export async function submitJoinPanel(options: {
	contractId: string
	jurorAddress: string
	stakeAmount: string
	signTransaction: WalletSignTransaction
}): Promise<string> {
	return submit({
		contractId: options.contractId,
		methodName: "join_panel",
		sourceAddress: options.jurorAddress,
		signTransaction: options.signTransaction,
		args: [
			new Address(options.jurorAddress).toScVal(),
			nativeToScVal(options.stakeAmount, { type: "i128" }),
		],
	})
}

/**
 * Escalate a rejected milestone (`open_dispute`). `evidenceHash` and
 * `rejectedAtSeconds` come from the caller so the UI stays in full control
 * of what evidence CID the hash corresponds to and which rejection is being
 * disputed.
 */
export async function submitOpenDispute(options: {
	contractId: string
	scholarAddress: string
	proposalId: number
	milestoneId: number
	evidenceHash: Uint8Array
	rejectedAtSeconds: bigint
	signTransaction: WalletSignTransaction
}): Promise<string> {
	return submit({
		contractId: options.contractId,
		methodName: "open_dispute",
		sourceAddress: options.scholarAddress,
		signTransaction: options.signTransaction,
		args: [
			new Address(options.scholarAddress).toScVal(),
			nativeToScVal(options.proposalId, { type: "u32" }),
			nativeToScVal(options.milestoneId, { type: "u32" }),
			nativeToScVal(Buffer.from(options.evidenceHash), { type: "bytes" }),
			nativeToScVal(options.rejectedAtSeconds, { type: "u64" }),
		],
	})
}

/** Submit a blind commitment for a dispute this address was drawn to judge. */
export async function submitCommitVote(options: {
	contractId: string
	disputeId: bigint
	jurorAddress: string
	commitment: Uint8Array
	signTransaction: WalletSignTransaction
}): Promise<string> {
	return submit({
		contractId: options.contractId,
		methodName: "commit_vote",
		sourceAddress: options.jurorAddress,
		signTransaction: options.signTransaction,
		args: [
			nativeToScVal(options.disputeId, { type: "u64" }),
			new Address(options.jurorAddress).toScVal(),
			nativeToScVal(Buffer.from(options.commitment), { type: "bytes" }),
		],
	})
}

/** Reveal a previously committed vote. Must match the commitment exactly. */
export async function submitRevealVote(options: {
	contractId: string
	disputeId: bigint
	jurorAddress: string
	vote: boolean
	salt: Uint8Array
	signTransaction: WalletSignTransaction
}): Promise<string> {
	return submit({
		contractId: options.contractId,
		methodName: "reveal_vote",
		sourceAddress: options.jurorAddress,
		signTransaction: options.signTransaction,
		args: [
			nativeToScVal(options.disputeId, { type: "u64" }),
			new Address(options.jurorAddress).toScVal(),
			nativeToScVal(options.vote, { type: "bool" }),
			nativeToScVal(Buffer.from(options.salt), { type: "bytes" }),
		],
	})
}
