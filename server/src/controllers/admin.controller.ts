import { type Request, type Response } from "express"
import { pool } from "../db/index"

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet"
const STELLAR_SECRET_KEY = process.env.STELLAR_SECRET_KEY ?? ""
const LEARN_TOKEN_CONTRACT_ID = process.env.LEARN_TOKEN_CONTRACT_ID ?? ""
const SCHOLARSHIP_TREASURY_CONTRACT_ID =
	process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID ?? ""
const DEFAULT_VALIDATOR_REVIEW_QUEUE_THRESHOLD = 25

function toFiniteNumber(value: unknown): number {
	const numeric = Number(value)
	return Number.isFinite(numeric) ? numeric : 0
}

function getValidatorReviewQueueThreshold(): number {
	const envValue = Number.parseInt(
		process.env.VALIDATOR_REVIEW_QUEUE_THRESHOLD ?? "",
		10,
	)

	if (Number.isFinite(envValue) && envValue > 0) {
		return envValue
	}

	return DEFAULT_VALIDATOR_REVIEW_QUEUE_THRESHOLD
}

async function queryContractI128(
	contractId: string,
	method: string,
): Promise<string> {
	if (!contractId || !STELLAR_SECRET_KEY) return "0"

	try {
		const {
			Keypair,
			Contract,
			TransactionBuilder,
			Networks,
			BASE_FEE,
			rpc,
			scValToNative,
		} = await import("@stellar/stellar-sdk")

		const server = new rpc.Server(
			STELLAR_NETWORK === "mainnet"
				? "https://soroban-rpc.stellar.org"
				: "https://soroban-testnet.stellar.org",
		)

		const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY)
		const account = await server.getAccount(keypair.publicKey())
		const contract = new Contract(contractId)

		const tx = new TransactionBuilder(account, {
			fee: BASE_FEE,
			networkPassphrase:
				STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
		})
			.addOperation(contract.call(method))
			.setTimeout(30)
			.build()

		const simulation = await server.simulateTransaction(tx)
		if (rpc.Api.isSimulationError(simulation) || !simulation.result?.retval) {
			return "0"
		}

		const value = scValToNative(simulation.result.retval)
		if (typeof value === "bigint") return value.toString()
		if (typeof value === "number") return Math.trunc(value).toString()
		if (typeof value === "string") return value
		return "0"
	} catch (err) {
		console.warn(`[admin] Failed to query contract method ${method}:`, err)
		return "0"
	}
}

export async function getAdminStats(
	_req: Request,
	res: Response,
): Promise<void> {
	try {
		const statsResult = await pool.query(
			`SELECT
         (SELECT COUNT(*)::int FROM milestone_reports WHERE status = 'pending') AS pending_milestones,
         (SELECT COUNT(*)::int FROM milestone_audit_log WHERE decision = 'approved' AND decided_at::date = CURRENT_DATE) AS approved_milestones_today,
         (SELECT COUNT(*)::int FROM milestone_audit_log WHERE decision = 'rejected' AND decided_at::date = CURRENT_DATE) AS rejected_milestones_today,
         (SELECT COUNT(DISTINCT scholar_address)::int FROM milestone_reports) AS total_scholars,
         (SELECT COUNT(*)::int FROM proposals WHERE status = 'pending') AS open_proposals`,
		)

		const row = statsResult.rows[0] ?? {}

		const [totalLrnMinted, treasuryBalanceUsdc] = await Promise.all([
			queryContractI128(LEARN_TOKEN_CONTRACT_ID, "total_supply"),
			queryContractI128(SCHOLARSHIP_TREASURY_CONTRACT_ID, "treasury_balance"),
		])

		res.status(200).json({
			pending_milestones: Number(row.pending_milestones ?? 0),
			approved_milestones_today: Number(row.approved_milestones_today ?? 0),
			rejected_milestones_today: Number(row.rejected_milestones_today ?? 0),
			total_scholars: Number(row.total_scholars ?? 0),
			total_lrn_minted: totalLrnMinted,
			open_proposals: Number(row.open_proposals ?? 0),
			treasury_balance_usdc: treasuryBalanceUsdc,
		})
	} catch (err) {
		console.error("[admin] getAdminStats error:", err)
		res.status(500).json({ error: "Failed to fetch admin stats" })
	}
}

type ValidatorAnalyticsRow = {
	validator_address: string
	milestones_reviewed: number | string
	average_review_time_seconds: number | string
	approval_rate: number | string
	appeal_reversal_rate: number | string
}

export async function getValidatorAnalytics(
	_req: Request,
	res: Response,
): Promise<void> {
	try {
		const [analyticsResult, pendingQueueResult] = await Promise.all([
			pool.query(
				`WITH decision_windows AS (
					 SELECT
						 a.id,
						 a.report_id,
						 a.validator_address,
						 a.decision,
						 a.decided_at,
						 r.submitted_at,
						 EXTRACT(EPOCH FROM (a.decided_at - r.submitted_at)) AS review_time_seconds,
						 ROW_NUMBER() OVER (PARTITION BY a.report_id ORDER BY a.decided_at ASC, a.id ASC) AS decision_rank_asc,
						 ROW_NUMBER() OVER (PARTITION BY a.report_id ORDER BY a.decided_at DESC, a.id DESC) AS decision_rank_desc
					 FROM milestone_audit_log a
					 JOIN milestone_reports r ON r.id = a.report_id
				 ),
				 initial_decisions AS (
					 SELECT
						 report_id,
						 validator_address AS initial_validator,
						 decision AS initial_decision
					 FROM decision_windows
					 WHERE decision_rank_asc = 1
				 ),
				 final_decisions AS (
					 SELECT report_id, decision AS final_decision
					 FROM decision_windows
					 WHERE decision_rank_desc = 1
				 ),
				 reversal_by_validator AS (
					 SELECT
						 i.initial_validator AS validator_address,
						 COUNT(*) FILTER (WHERE i.initial_decision <> f.final_decision)::int AS reversal_count
					 FROM initial_decisions i
					 JOIN final_decisions f USING (report_id)
					 GROUP BY i.initial_validator
				 ),
				 validator_metrics AS (
					 SELECT
						 d.validator_address,
						 COUNT(DISTINCT d.report_id)::int AS milestones_reviewed,
						 COALESCE(AVG(GREATEST(d.review_time_seconds, 0)), 0)::float8 AS average_review_time_seconds,
						 COUNT(DISTINCT CASE WHEN d.decision = 'approved' THEN d.report_id END)::int AS approved_milestones
					 FROM decision_windows d
					 GROUP BY d.validator_address
				 )
				 SELECT
					 m.validator_address,
					 m.milestones_reviewed,
					 m.average_review_time_seconds,
					 COALESCE(
						 100.0 * m.approved_milestones / NULLIF(m.milestones_reviewed, 0),
						 0
					 )::float8 AS approval_rate,
					 COALESCE(
						 100.0 * COALESCE(r.reversal_count, 0) / NULLIF(m.milestones_reviewed, 0),
						 0
					 )::float8 AS appeal_reversal_rate
				 FROM validator_metrics m
				 LEFT JOIN reversal_by_validator r ON r.validator_address = m.validator_address
				 ORDER BY m.milestones_reviewed DESC, m.validator_address ASC`,
			),
			pool.query(
				`SELECT COUNT(*)::int AS pending_reviews
				 FROM milestone_reports
				 WHERE status = 'pending'`,
			),
		])

		const queueThreshold = getValidatorReviewQueueThreshold()
		const pendingReviews = toFiniteNumber(
			pendingQueueResult.rows[0]?.pending_reviews,
		)
		const rows = analyticsResult.rows as ValidatorAnalyticsRow[]

		res.status(200).json({
			validators: rows.map((row) => ({
				validator_address: row.validator_address,
				milestones_reviewed: toFiniteNumber(row.milestones_reviewed),
				average_review_time_seconds: toFiniteNumber(
					row.average_review_time_seconds,
				),
				approval_rate: toFiniteNumber(row.approval_rate),
				appeal_reversal_rate: toFiniteNumber(row.appeal_reversal_rate),
			})),
			review_queue: {
				pending_reviews: pendingReviews,
				threshold: queueThreshold,
				exceeded: pendingReviews > queueThreshold,
			},
		})
	} catch (err) {
		console.error("[admin] getValidatorAnalytics error:", err)
		res.status(500).json({ error: "Failed to fetch validator analytics" })
	}
}
