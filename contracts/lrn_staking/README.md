# LrnStaking Contract

## Purpose and Role

`lrn_staking` locks LRN for a duration the staker chooses and converts that lock
into **time-weighted governance power**. Weight tracks commitment rather than a
spot balance, so tokens acquired the day before a vote carry almost nothing,
while a maximum-length lock carries the full amount. Locking also removes LRN
from float — which matters for a token that is earned continuously through
learning.

The contract is **standalone**. Nothing here is wired into the live governance
tally; `voting_power` is a read-only view until a follow-up change consumes it.

## Voting Power Formula

```
weight(stake) = amount × (lock_end_ledger − lock_start_ledger) / MAX_LOCK_LEDGERS
voting_power(staker) = Σ weight(stake) over that staker's active stakes
```

- **Multiplication happens before division**, and every step uses checked
  arithmetic — an overflow panics with `ArithmeticOverflow` rather than wrapping.
- **Rounding is down** (integer truncation). Since `lock_duration ≤
  MAX_LOCK_LEDGERS` is enforced on every write path, `weight ≤ amount` always
  holds; `voting_power_never_exceeds_amount` proves this across amounts up to
  `i128::MAX / MAX_LOCK_LEDGERS` and durations up to the maximum.
- A **maximum-length lock yields full weight** (`weight == amount`); the minimum
  lock yields `30/1460 ≈ 2%` of the amount.
- A withdrawn stake contributes **zero**.

Weight does not decay as the lock counts down. A stake keeps the weight of the
commitment it made until it is withdrawn — decay is deliberately out of scope
here and would be a separate, testable change.

## Constants

| Constant | Value | Meaning |
| --- | --- | --- |
| `MIN_LOCK_LEDGERS` | `17_280 × 30` (~30 days) | Shortest accepted lock. Long enough that a lock cannot be opened and closed around a single vote. |
| `MAX_LOCK_LEDGERS` | `17_280 × 365 × 4` (~4 years) | Longest accepted lock, and the denominator of the weight formula. |
| `EMERGENCY_PENALTY_BPS` | `2_000` (20%) | Penalty on early exit, routed to the treasury. |
| `MAX_ACTIVE_STAKES` | `50` | Concurrent active stakes per address, keeping `voting_power` within the CPU budget. |

Durations are expressed in ledgers (~6s each), matching the `DAY_IN_LEDGERS`
convention used across the other contracts.

## Key Functions

| Function | Parameters | Access | Description |
| --- | --- | --- | --- |
| `initialize` | `admin`, `lrn_token`, `treasury` | `admin` auth, once | Stores the config: token to lock and penalty recipient. |
| `stake` | `staker`, `amount`, `lock_duration_ledgers` | `staker` auth | Transfers LRN in, records the lock, returns the new stake id. |
| `unstake` | `stake_id` | stake's `staker` | Returns the full principal, at or after `lock_end_ledger`. |
| `emergency_unstake` | `stake_id` | stake's `staker` | Early exit before `lock_end_ledger`, paying the penalty to the treasury. |
| `extend_lock` | `stake_id`, `new_end_ledger` | stake's `staker` | Pushes the end ledger further out, raising voting power. |
| `voting_power` | `staker` | public read | Time-weighted power summed over active stakes. |
| `stake_voting_power` | `stake_id` | public read | Weight of a single stake, or `0` once withdrawn. |
| `total_staked` | `staker` | public read | Principal currently locked. |
| `get_stake`, `get_active_stakes`, `get_config`, `get_lock_params`, `get_version` | query args only | public read | Stake, index, and configuration views. |
| `upgrade` | `new_wasm_hash` | stored admin | Upgrades the contract WASM through the shared helper. |

## Lock Rules

- **Locks can never be shortened.** `extend_lock` requires `new_end_ledger` to
  be strictly later than the current end *and* strictly in the future, so an
  already-matured lock cannot buy weight without re-committing. The resulting
  duration measured from `lock_start_ledger` must still fit within
  `MAX_LOCK_LEDGERS`.
- **Early exit runs only through the penalized path.** `unstake` panics with
  `LockNotExpired` before maturity; `emergency_unstake` panics with
  `LockAlreadyExpired` at or after it. Exactly one path is open at any ledger.
- **No stake is withdrawn twice.** The stake record is retained forever with
  `withdrawn = true`, so a repeat call on either path panics with
  `AlreadyWithdrawn`. Only the id is dropped from the staker's active index.

## Penalty: Treasury, Not Burn

The emergency-unstake penalty is **routed to the treasury** rather than burned.
LRN is earned by learners rather than bought, so destroying it erases proof of
work that can never be re-minted, and the supply reduction benefits every other
holder diffusely rather than the platform the staker walked away from. Routing
to the treasury recycles the penalty into scholarships and leaves an auditable
on-chain inflow.

The penalty rounds **down**, so the staker is never overcharged and
`amount_returned + penalty == amount` exactly.

## Authorization Model

- `initialize` requires the provided admin address to authorize once.
- `stake` requires the staker to authorize; the token transfer into the contract
  is a sub-invocation of that authorization.
- `unstake`, `emergency_unstake`, and `extend_lock` require the **stake owner**
  recorded at stake time, not the caller — a third party cannot move or unlock
  someone else's position.
- `upgrade` requires the stored admin.
- Read methods are public.

## State Variables

| Storage Key | Meaning |
| --- | --- |
| `CONFIG` | `Config { admin, lrn_token, treasury }`. |
| `NEXTID` | Monotonic stake id counter; ids are never recycled. |
| `Stake(id)` | `Stake { staker, amount, lock_start_ledger, lock_end_ledger, withdrawn }`. Retained after withdrawal. |
| `Active(address)` | Ids of that address's currently active stakes. |
| `WASMHASH` | Last tracked managed upgrade hash from the shared helper. |

Persistent entries are TTL-extended on every touch. A lock left untouched longer
than the entry TTL may need an archival restore before it can be withdrawn,
which Soroban supports and which does not affect the recorded amounts.

## Events Emitted

- `Staked { stake_id, staker, amount, lock_start_ledger, lock_end_ledger }`
- `Unstaked { stake_id, staker, amount_returned, penalty, emergency }` — emitted
  by both withdrawal paths; `emergency` distinguishes them and `penalty` is `0`
  on the matured path.
- `LockExtended { stake_id, staker, old_end_ledger, new_end_ledger }`
- `contract_upgraded` from the shared upgrade helper

## Token Address

The staked token is supplied at `initialize` rather than hard-coded, so the
contract works against any SEP-41 token exposing `transfer`. Note that
`contracts/learn_token` is soulbound today and rejects `transfer`; staking
against it requires a transferable LRN representation, which is part of the
integration follow-up rather than this contract.

## Deploy with Stellar CLI

From the repository root:

```bash
stellar contract build --package lrn-staking
stellar contract deploy \
  --wasm target/wasm32v1-none/release/lrn_staking.wasm \
  --source <IDENTITY> \
  --network <NETWORK>
```

Initialize after deploy by invoking `initialize(admin, lrn_token, treasury)`.

## Run Tests

From the repository root:

```bash
cargo test -p lrn-staking
```
