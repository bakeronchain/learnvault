#!/usr/bin/env ts-node
/**
 * Backfill `scholar_balances` from historical learn_token mint/burn events.
 *
 * Replays a ledger range through the same exactly-once pipeline the live
 * indexer uses, so it is safe to run repeatedly, against a partly-populated
 * table, or while the poller is running -- events already journalled are
 * skipped instead of double-counted.
 *
 * Usage:
 *   npm run db:backfill:balances                    # chain head backwards, as far as RPC retains
 *   npm run db:backfill:balances -- --from 460000000
 *   npm run db:backfill:balances -- --from 1 --to 460100000
 *   npm run db:backfill:balances -- --rebuild       # recompute from the journal only, no RPC
 *
 * Flags:
 *   --from <ledger>  First ledger to replay. Defaults to STARTING_LEDGER, or 1.
 *   --to <ledger>    Last ledger to replay. Defaults to the current chain head.
 *                    Passing it leaves the live indexer checkpoint untouched, so
 *                    a historical repair cannot rewind the poller.
 *   --rebuild        Recompute every balance as SUM(delta) over the journal
 *                    after replaying. Use on its own to repair balances without
 *                    touching the network.
 *
 * Note on retention: Soroban RPC keeps only a recent window of events (roughly a
 * day on public nodes). A `--from` older than that window is clamped to the
 * oldest retained ledger and the gap is logged; recovering further history needs
 * an archival event source. The journal itself is durable, which is why
 * --rebuild never needs the network.
 */

import path from "node:path"
import dotenv from "dotenv"

dotenv.config({ path: path.resolve(__dirname, "../.env") })

import { rpc } from "@stellar/stellar-sdk"
import { SOROBAN_RPC_URL } from "../src/lib/event-config"
import {
	indexLrnBalanceEvents,
	rebuildScholarBalances,
} from "../src/services/scholar-balance-indexer.service"

interface Args {
	from?: number
	to?: number
	rebuild: boolean
	help: boolean
}

function parseArgs(argv: string[]): Args {
	const args: Args = { rebuild: false, help: false }

	for (let i = 0; i < argv.length; i++) {
		const flag = argv[i]
		switch (flag) {
			case "--from":
			case "--to": {
				const value = Number(argv[++i])
				if (!Number.isInteger(value) || value < 1) {
					throw new Error(`${flag} requires a positive ledger number`)
				}
				if (flag === "--from") args.from = value
				else args.to = value
				break
			}
			case "--rebuild":
				args.rebuild = true
				break
			case "--help":
			case "-h":
				args.help = true
				break
			default:
				throw new Error(`Unknown argument: ${flag}`)
		}
	}

	if (args.from !== undefined && args.to !== undefined && args.to < args.from) {
		throw new Error("--to must be greater than or equal to --from")
	}

	return args
}

const USAGE = `
Backfill scholar_balances from learn_token events.

  --from <ledger>  first ledger to replay (default: STARTING_LEDGER or 1)
  --to <ledger>    last ledger to replay (default: current chain head);
                   passing it leaves the live indexer checkpoint untouched
  --rebuild        recompute balances from the journal after replaying
  --help           show this message
`.trim()

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2))

	if (args.help) {
		console.log(USAGE)
		return
	}

	// --rebuild on its own is a pure database operation: no RPC, no retention
	// limits, and enough to repair balances whenever the journal is intact.
	const replay = !(args.rebuild && args.from === undefined && args.to === undefined)

	if (replay) {
		const configuredStart = Number(process.env.STARTING_LEDGER)
		const from =
			args.from ??
			(Number.isInteger(configuredStart) && configuredStart > 0
				? configuredStart
				: 1)
		const to =
			args.to ?? (await new rpc.Server(SOROBAN_RPC_URL).getLatestLedger()).sequence

		console.log(`Replaying learn_token events from ledger ${from} to ${to}...`)

		const result = await indexLrnBalanceEvents({
			startLedger: from,
			endLedger: to,
			// An explicit --to means this is a historical repair, not a catch-up;
			// advancing the live checkpoint to an old ledger would rewind the poller.
			persistCheckpoint: args.to === undefined,
		})

		console.log(
			`  scanned=${result.scanned} applied=${result.applied} ` +
				`duplicates=${result.duplicates} malformed=${result.malformed} ` +
				`checkpoint=${result.lastLedger}`,
		)
	}

	if (args.rebuild) {
		console.log("Recomputing balances from the journal...")
		const { addresses, zeroed } = await rebuildScholarBalances()
		console.log(`  rebuilt=${addresses} zeroed=${zeroed}`)
	}

	console.log("Backfill complete.")
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Backfill failed:", err)
		process.exit(1)
	})
