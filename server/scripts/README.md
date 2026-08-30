# Server scripts

One-off and operational scripts. Each has an npm alias in `server/package.json`;
run them from the `server/` directory so `.env` is picked up.

| Script | npm alias | Purpose |
| --- | --- | --- |
| `migrate.ts` | `npm run migrate` / `npm run migrate:rollback` | Apply or revert SQL migrations |
| `verify-migrations.ts` | `npm run migrate:verify` | Check applied migrations against the files on disk |
| `seed.ts` | `npm run db:seed` | Seed development data |
| `seed-swahili-course.ts` | `npm run seed:swahili-course` | Seed the Swahili course content |
| `backfill-scholar-balances.ts` | `npm run db:backfill:balances` | Rebuild scholar LRN balances from on-chain events |
| `generate-openapi.ts` | `npm run docs:generate` | Regenerate `docs/openapi.yaml` |
| `query-analysis.ts` | `npm run db:query:analyze` | Report slow queries from `pg_stat_statements` |
| `upload-nft-images.ts` | — | Upload credential badge art to IPFS |

---

## Scholar balance backfill

`backfill-scholar-balances.ts` populates `scholar_balances.lrn_balance` — the
table behind `GET /api/scholars/leaderboard` — by replaying `learn_token`
`lrn_mint` and `lrn_burned` events.

It runs the same pipeline as the live indexer, so it is **safe to re-run** and
safe to run **while the poller is running**: every delta is keyed by its Soroban
event id and applied in the same statement that journals it, so a replayed event
is skipped rather than counted twice.

### Prerequisites

Migration `035_scholar_balance_indexer.sql` applied, plus these in `server/.env`:

```
DATABASE_URL=postgres://...
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
LEARN_TOKEN_CONTRACT_ID=C...
STARTING_LEDGER=460000000   # default --from
```

### Usage

```bash
cd server

# Catch up from STARTING_LEDGER to the chain head and advance the live checkpoint
npm run db:backfill:balances

# Replay an explicit range (leaves the live indexer checkpoint alone)
npm run db:backfill:balances -- --from 460000000 --to 460100000

# Recompute every balance from the journal — no network access needed
npm run db:backfill:balances -- --rebuild
```

| Flag | Effect |
| --- | --- |
| `--from <ledger>` | First ledger to replay. Defaults to `STARTING_LEDGER`, else `1`. |
| `--to <ledger>` | Last ledger to replay. Defaults to the chain head. Passing it suppresses the checkpoint write so a historical repair cannot rewind the poller. |
| `--rebuild` | Recompute `scholar_balances.lrn_balance` as `SUM(delta)` over the journal. On its own, skips the chain read entirely. |

### RPC retention

Soroban RPC nodes retain only a recent window of events (roughly 24 hours on the
public endpoints). A `--from` older than that window is clamped to the oldest
retained ledger and the gap is logged as a warning — recovering earlier history
requires an archival event source.

This is why balances are journalled in `lrn_balance_events` rather than derived
on the fly: the journal is durable, so `--rebuild` can always reconstruct
`scholar_balances` exactly without going back to the network.

### Recovering from a bad balance

1. `npm run db:backfill:balances -- --rebuild` — fixes anything edited out of
   band, since the journal is the source of truth.
2. If the journal itself has a gap (a negative balance in the logs is the usual
   symptom), replay the missing range with `--from`/`--to`, then `--rebuild`.
