import { rpc as StellarRpc } from "@stellar/stellar-sdk"
import { pool } from "../db/index"
import { createNotification } from "../db/notifications-store"
import { invalidateApiResponseCacheType } from "../lib/api-response-cache"
import {
	SOROBAN_RPC_URL,
	INDEXER_CONFIG,
	getPollingTargets,
} from "../lib/event-config"
import { leaderboardEmitter } from "../lib/leaderboard-emitter"
import { logger } from "../lib/logger"
import { getRpcCache, CacheKey } from "../lib/rpc-cache"
import { deliverNotificationChannels } from "./notification-delivery.service"

const log = logger.child({ module: "indexer" })

const rpc = new StellarRpc.Server(SOROBAN_RPC_URL)

export interface IndexedEvent {
	contract: string
	event_type: string
	data: Record<string, unknown>
	ledger_sequence: string // RPC returns string, DB bigint
	tx_hash?: string
	event_index?: number
}

export interface WebhookHorizonEvent {
	id: string
	type: string
	contract: string
	topic: string
	ledger: string | number
	value?: Record<string, unknown>
}

/**
 * Extract transaction hash from event ID or data
 * Event ID format: "<ledger_sequence>-<tx_hash>-<event_index>"
 */
function extractTxHash(eventId: string): string | undefined {
	// Event IDs are typically formatted as: "0000428575-250fd482f34ac0d5387a77e62ae696126f22cb09377b8038cd1cf011c62dcbd-0"
	const parts = eventId.split("-")
	if (parts.length >= 2) {
		return parts[1]
	}
	return undefined
}

/**
 * Extract event index from event ID
 */
function extractEventIndex(eventId: string): number | undefined {
	const parts = eventId.split("-")
	if (parts.length >= 3) {
		const index = Number.parseInt(parts[2], 10)
		if (!Number.isNaN(index)) {
			return index
		}
	}
	return undefined
}

function affectsLeaderboard(topic: string): boolean {
	const t = topic.toLowerCase()
	return (
		(t.includes("learntoken") && t.includes("mint")) ||
		(t.includes("coursemilestone") && t.includes("milestonecomplete")) ||
		(t.includes("scholarnft") && t.includes("minted"))
	)
}

function affectsTreasuryStats(topic: string): boolean {
	const t = topic.toLowerCase()
	return (
		(t.includes("scholarshiptreasury") &&
			(t.includes("deposit") ||
				t.includes("proposalcreated") ||
				t.includes("votecastevent"))) ||
		(t.includes("milestoneescrow") && t.includes("fundsdisbursed"))
	)
}

/**
 * Invalidate RPC cache entries that are stale after a new event is indexed.
 * We only invalidate keys we can derive from the event data — everything else
 * expires naturally via TTL.
 */
async function invalidateCacheForEvent(
	topic: string,
	data: Record<string, unknown>,
): Promise<void> {
	const cache = getRpcCache()
	const value = (
		data.value && typeof data.value === "object" ? data.value : {}
	) as Record<string, unknown>
	const addr =
		typeof data.address === "string"
			? data.address
			: typeof value.address === "string"
				? value.address
				: null

	switch (topic) {
		case "LearnToken_Mint":
			if (addr) {
				await cache.invalidate(CacheKey.learnBalance(addr))
				await cache.invalidate(CacheKey.votingPower(addr))
			}
			break
		case "CourseMilestone_MilestoneComplete":
			if (addr) {
				const courseId =
					typeof data.courseId === "string"
						? Number(data.courseId)
						: typeof value.courseId === "string"
							? Number(value.courseId)
							: null
				if (courseId !== null && !isNaN(courseId)) {
					await cache.invalidate(CacheKey.enrollment(addr, courseId))
				}
			}
			break
		case "ScholarshipTreasury_Deposit":
			// Deposit mints governance tokens — invalidate gov balance + voting power
			if (addr) {
				await cache.invalidate(CacheKey.govBalance(addr))
				await cache.invalidate(CacheKey.votingPower(addr))
			}
			break
		case "ScholarshipTreasury_VoteCastEvent": {
			const voter =
				typeof data.voter === "string"
					? data.voter
					: typeof value.voter === "string"
						? value.voter
						: null
			if (voter) {
				await cache.invalidate(CacheKey.votingPower(voter))
			}
			break
		}
		case "ScholarNFT::minted": {
			const tokenId =
				typeof data.token_id === "string"
					? Number(data.token_id)
					: typeof value.token_id === "string"
						? Number(value.token_id)
						: null
			const owner =
				typeof data.owner === "string"
					? data.owner
					: typeof value.owner === "string"
						? value.owner
						: null
			if (tokenId !== null && !isNaN(tokenId)) {
				await cache.invalidate(CacheKey.verifyCredential(tokenId))
			}
			if (owner) {
				await cache.invalidate(CacheKey.verifyAddress(owner))
			}
			break
		}
		case "ScholarNFT::revoked": {
			const tokenId =
				typeof data.token_id === "string"
					? Number(data.token_id)
					: typeof value.token_id === "string"
						? Number(value.token_id)
						: null
			if (tokenId !== null && !isNaN(tokenId)) {
				const res = await pool.query(
					"SELECT scholar_address FROM scholar_nfts WHERE token_id = $1",
					[tokenId],
				)
				const scholar = res.rows[0]?.scholar_address
				await cache.invalidate(CacheKey.verifyCredential(tokenId))
				if (scholar) {
					await cache.invalidate(CacheKey.verifyAddress(scholar))
				}
			}
			break
		}
		default:
			break
	}
}

/**
 * Persist a single indexed event and return whether a new row was inserted.
 */
async function persistIndexedEvent(
	contractId: string,
	topic: string,
	ev: {
		id: string
		type: string
		ledger: string | number
		topic?: unknown
		value?: unknown
	},
): Promise<boolean> {
	const ledger = Number(ev.ledger)
	const txHash = extractTxHash(ev.id)
	const eventIndex = extractEventIndex(ev.id)

	const data = {
		id: ev.id,
		type: ev.type,
		ledger: String(ev.ledger),
		topic: ev.topic ?? topic,
		value: ev.value,
	}

	const result = await pool.query(
		`INSERT INTO events (contract, event_type, data, ledger_sequence, tx_hash, event_index)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (ledger_sequence, tx_hash, event_index) DO NOTHING
		 RETURNING id`,
		[contractId, topic, data, ledger, txHash, eventIndex],
	)

	await invalidateCacheForEvent(topic, data)

	if ((result.rowCount ?? 0) > 0) {
		if (topic === "LearnToken_Mint" || topic === "ScholarNFT::minted") {
			leaderboardEmitter.emitUpdate()
		}

		// When a scholarship proposal is executed on-chain, create the escrow on-chain and record it
		if (topic === "ScholarshipTreasury::proposal_executed") {
			try {
				const value = (ev as any).value ?? {}
				const rawProposalId = value?.proposal_id ?? value?.proposalId ?? value?.proposal ?? null
				const passed = value?.passed === true || value?.passed === "true" || value?.passed === 1 || value?.passed === "1"
				const rawAmount = value?.amount ?? value?.total_amount ?? null

				if (rawProposalId != null && passed) {
					const proposalId = Number(rawProposalId)
					let scholarAddress: string | null = null
					let totalAmountAtomic: bigint | null = null

					// Try DB first: map on-chain proposal_id -> proposals.id
					try {
						const pRes = await pool.query(
							"SELECT author_address, amount FROM proposals WHERE id = $1",
							[proposalId],
						)
						if (pRes.rows.length > 0) {
							scholarAddress = pRes.rows[0].author_address
							if (rawAmount == null) {
								const dbAmount = pRes.rows[0].amount
								if (dbAmount != null) {
									const amtNum = Number(dbAmount)
									totalAmountAtomic = BigInt(Math.floor(amtNum * 10 ** 7))
								}
							}
						}
					} catch (dbErr) {
						log.error({ err: dbErr, proposalId }, "DB lookup for proposal failed")
					}

					// If rawAmount provided in event, prefer it (assume atomic units)
					if (rawAmount != null) {
						try {
							totalAmountAtomic = BigInt(String(rawAmount))
						} catch (_) {
							// ignore parse error
						}
					}

					// Fallback to on-chain read for applicant/amount
					if (!scholarAddress || totalAmountAtomic === null) {
						try {
							const { stellarContractService } = await import("./stellar-contract.service")
							const onChain = await stellarContractService.getProposalOnChain(proposalId)
							if (onChain) {
								if (!scholarAddress && onChain.applicant) scholarAddress = String(onChain.applicant)
								if (totalAmountAtomic === null && onChain.amount) {
									try { totalAmountAtomic = BigInt(String(onChain.amount)) } catch (_) {}
								}
							}
						} catch (chainErr) {
							log.error({ err: chainErr, proposalId }, "on-chain proposal lookup failed")
						}
					}

					if (scholarAddress && totalAmountAtomic !== null) {
						try {
							const { stellarContractService } = await import("./stellar-contract.service")
							const txRes = await stellarContractService.createMilestoneEscrow({
								proposalId,
								scholarAddress,
								totalAmount: totalAmountAtomic.toString(),
								tranches: 3,
							})

							await pool.query(
								`INSERT INTO escrows (proposal_id, scholar_address, total_amount, tranches, tranches_released, contract_escrow_id)
								 VALUES ($1, $2, $3, $4, 0, $5)
								 ON CONFLICT (proposal_id) DO NOTHING`,
								[proposalId, scholarAddress, totalAmountAtomic.toString(), 3, proposalId],
							)

							await pool.query(
								`INSERT INTO platform_events (event_type, data) VALUES ($1, $2::jsonb)`,
								["escrow_created", JSON.stringify({ proposal_id: proposalId, scholar_address: scholarAddress, total_amount: totalAmountAtomic.toString(), tx_hash: txRes.txHash })],
							)
						} catch (err) {
							log.error({ err, proposalId }, "failed to create record after create_escrow")
						}
					} else {
						log.warn({ proposalId }, "insufficient data to create escrow: missing scholar or amount")
					}
				}
			} catch (err) {
				log.error({ err }, "proposal_executed handler failed")
			}
		}

		return true
	}

	return false
}

/**
 * Process events pushed via the Horizon webhook relay.
 */
export async function processWebhookEvents(
	events: WebhookHorizonEvent[],
): Promise<{ inserted: number; skipped: number }> {
	let inserted = 0
	let skipped = 0
	const contractMaxLedger = new Map<string, number>()

	for (const ev of events) {
		try {
			const ledger = Number(ev.ledger)
			const wasInserted = await persistIndexedEvent(ev.contract, ev.topic, ev)
			if (wasInserted) {
				inserted++
			} else {
				skipped++
			}

			const currentMax = contractMaxLedger.get(ev.contract) ?? 0
			if (ledger > currentMax) {
				contractMaxLedger.set(ev.contract, ledger)
			}
		} catch (err) {
			log.error(
				{ err, eventId: ev.id, contract: ev.contract },
				"Webhook event error",
			)
			skipped++
		}
	}

	for (const [contract, lastLedger] of contractMaxLedger) {
		await updateIndexerState(contract, lastLedger)
	}

	log.info(
		{ inserted, skipped, count: events.length },
		"Webhook events processed",
	)
	return { inserted, skipped }
}

/**
 * Poll and index new events from target contracts
 * @param startLedger - Starting ledger (config or last indexed)
 * @param endLedger - Latest ledger to check
 */
export async function indexEventsBatch(
	startLedger: number,
	endLedger: number,
): Promise<void> {
	const targets = getPollingTargets()
	let inserted = 0
	let skipped = 0

	for (const { contractId, topics } of targets) {
		// Track max ledger for this contract
		let maxLedgerForContract = startLedger

		for (const topic of topics) {
			const filters: StellarRpc.Api.EventFilter[] = [
				{
					type: "contract",
					contractIds: [contractId],
					topics: [[topic]],
				},
			]

			try {
				const response = await rpc.getEvents({
					filters,
					startLedger,
					endLedger,
					limit: 200,
				})

				for (const ev of response.events) {
					const ledger = Number(ev.ledger)
					if (ledger > endLedger) continue

					// Update max ledger for this contract
					if (ledger > maxLedgerForContract) {
						maxLedgerForContract = ledger
					}

					const wasInserted = await persistIndexedEvent(contractId, topic, ev)
					if (wasInserted) {
						inserted++
					} else {
						skipped++
					}
				}
			} catch (err) {
				log.error({ err, contractId, topic }, "Indexer error")
			}
		}

		// Update indexer state with last processed ledger for this contract
		await updateIndexerState(contractId, maxLedgerForContract)
	}

	log.info({ inserted, startLedger, endLedger }, "Events indexed")
}

/**
 * Update indexer state with last processed ledger for a contract
 */
export async function updateIndexerState(
	contract: string,
	lastLedger: number,
): Promise<void> {
	await pool.query(
		`INSERT INTO indexer_state (contract, last_processed_ledger, last_processed_at)
		 VALUES ($1, $2, CURRENT_TIMESTAMP)
		 ON CONFLICT (contract) DO UPDATE SET
			 last_processed_ledger = EXCLUDED.last_processed_ledger,
			 last_processed_at = EXCLUDED.last_processed_at,
			 updated_at = CURRENT_TIMESTAMP`,
		[contract, lastLedger],
	)
}

/**
 * Get last indexed ledger per contract from indexer_state table
 * Falls back to events table max if no state exists
 */
export async function getLastIndexedLedger(contract: string): Promise<number> {
	// First check indexer_state table
	const stateRes = await pool.query(
		"SELECT last_processed_ledger FROM indexer_state WHERE contract = $1",
		[contract],
	)

	if (stateRes.rows.length > 0 && stateRes.rows[0].last_processed_ledger > 0) {
		return Number(stateRes.rows[0].last_processed_ledger)
	}

	// Fallback to events table for backward compatibility
	const eventsRes = await pool.query(
		"SELECT MAX(ledger_sequence) FROM events WHERE contract = $1",
		[contract],
	)

	return (eventsRes.rows[0]?.max as number) || INDEXER_CONFIG.startingLedger
}

/**
 * Get all indexer state entries
 */
export async function getAllIndexerState(): Promise<
	Array<{
		contract: string
		last_processed_ledger: number
		last_processed_at: Date
		updated_at: Date
	}>
> {
	const result = await pool.query(
		"SELECT contract, last_processed_ledger, last_processed_at, updated_at FROM indexer_state ORDER BY contract",
	)
	return result.rows
}
