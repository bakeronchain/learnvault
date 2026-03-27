import { type Request, type Response } from "express"
import { pool } from "../db/index"

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet"
const STELLAR_SECRET_KEY = process.env.STELLAR_SECRET_KEY ?? ""
const LEARN_TOKEN_CONTRACT_ID = process.env.LEARN_TOKEN_CONTRACT_ID ?? ""
const SCHOLARSHIP_TREASURY_CONTRACT_ID =
	process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID ?? ""

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
