# ADR-009: Token Economics — LRN Minting Rates and Reputation Rank Thresholds

**Status**: Proposed **Date**: 2026-05-27

## Context

LearnVault uses two on-chain tokens — LRN (LearnToken) for reputation and GOV
(GovernanceToken) for voting weight. The parameters that govern these tokens
(LRN reward amounts per milestone, reputation rank thresholds, and the
GOV-to-USDC minting ratio) were implemented directly in contract code and the
frontend without a written rationale. This ADR documents the current values, the
reasoning behind them, and the process required to change them.

Related issues: #770

## Current Parameter Values

### LRN Minting — Per Milestone

LRN is minted by the `CourseMilestone` contract when a validator calls
`verify_milestone` or `complete_milestone`. The reward amount is configured per
`(course_id, milestone_id)` pair via `set_milestone_reward` and stored in
persistent contract storage under
`DataKey::MilestoneLrn(course_id, milestone_id)`.

There is no single global rate. Amounts are set at course creation time by the
admin committee and reflect the expected effort and learning depth of that
milestone. The guiding principle for V1 is:

| Milestone type (indicative)  | Typical LRN reward |
| ---------------------------- | ------------------ |
| Beginner track milestone     | 1 – 20 LRN         |
| Intermediate track milestone | 20 – 100 LRN       |
| Advanced track milestone     | 100 – 500 LRN      |
| Capstone / final milestone   | 500 – 2 000 LRN    |

These ranges are not enforced by the contract — the admin sets exact amounts.
The ranges above represent the intended operating envelope and the basis for the
reputation rank thresholds below.

Contract reference: `contracts/course_milestone/src/lib.rs` —
`set_milestone_reward`, `verify_milestone`, `complete_milestone`.

### Reputation Rank Thresholds

Thresholds are defined in `src/util/reputationRank.ts` and applied to the
learner's raw LRN balance (7-decimal precision, so 1 LRN displayed = 10 000 000
base units).

| Rank        | LRN balance (displayed) | Label       |
| ----------- | ----------------------- | ----------- |
| newcomer    | 0                       | Newcomer    |
| committed   | 1 – 99                  | Committed   |
| rising_star | 100 – 499               | Rising Star |
| top_scholar | 500 – 1 999             | Top Scholar |
| elite       | 2 000 – 9 999           | Elite       |
| legend      | ≥ 10 000                | Legend      |

Scholarship eligibility and governance participation thresholds are set
separately per track and are not encoded in `reputationRank.ts`. They are
configured on the `scholarship_treasury` and `course_milestone` contracts at
deployment.

### GOV Minting Ratio (Governance Token-to-USDC)

The `scholarship_treasury` contract defines:

```rust
const GOV_PER_USDC: i128 = 100;
```

This constant operates in base units (stroops): for every 1 USDC stroop
deposited, 100 GOV base units are minted. Given that both USDC and GOV use 7
decimal places on Stellar, the human-readable ratio is:

```
1 USDC deposited → 100 GOV minted
```

Contract reference: `contracts/scholarship_treasury/src/lib.rs` — constant
`GOV_PER_USDC`.

> Note: The prose in `docs/token-economics.md` states "1 USDC mints 1 GOV" —
> this is inconsistent with the contract constant. The contract is the source of
> truth. `docs/token-economics.md` should be updated to reflect the 100:1 ratio.

## Economic Rationale

### Why per-milestone LRN (not per-course)

Awarding LRN at each milestone rather than only at course completion creates a
continuous incentive to progress. A learner who completes seven of ten
milestones and then stops still earns reputation — and retains it permanently,
since LRN does not burn. This reduces the dropout cost and keeps partial effort
visible and verifiable on-chain.

### Why the rank thresholds are sized as they are

The thresholds were chosen to map naturally onto the expected LRN accumulation
curve for a learner progressing through the three difficulty tiers:

- A learner who completes one beginner track (~3–5 milestones at 1–20 LRN each)
  reaches **committed** (≥1 LRN).
- Completing two intermediate tracks (~8 milestones at 20–100 LRN each) reaches
  **rising_star** (≥100 LRN).
- Finishing one advanced track (~5 milestones at 100–500 LRN each) combined with
  prior work pushes into **top_scholar** (≥500 LRN).
- **elite** and **legend** require sustained multi-track completion and are
  intentionally hard to reach — they should represent the top percentile of
  active learners on the platform.

The non-transferable nature of LRN means rank cannot be purchased or delegated.
Every rank boundary represents provable, verified on-chain effort.

### Why 100 GOV per 1 USDC

The 100:1 ratio gives governance weight to serious donors without requiring a
minimum deposit that excludes smaller contributors. One USDC of donation buys
100 governance votes, which is enough to be meaningful in proposal votes while
keeping the per-vote cost low enough that broad participation is accessible. The
ratio is also round and easy to communicate to donors.

If GOV ever develops a liquid market, the ratio should be revisited — a high
GOV/USDC spot price combined with a generous mint ratio would allow governance
attacks through direct treasury deposit. This is a known open risk, tracked in
the V2 roadmap.

## Change Process

Changing any parameter in this ADR requires the following steps, depending on
the parameter type:

### Contract constants (`GOV_PER_USDC`, milestone reward values)

1. **Governance proposal** — submit a `parameter_change` proposal to the
   `scholarship_treasury` contract. The proposal must describe the current
   value, the proposed value, and the economic justification.
2. **Community vote** — the proposal must reach quorum and majority approval
   from GOV holders within the deadline window
   (`PROPOSAL_DEADLINE_LEDGERS = 100_800` ledgers, ≈ 7 days at 6 s/ledger).
3. **Admin execution** — in V1, the actual contract parameter update is executed
   by the admin multisig after a passing governance vote. Trustless on-chain
   execution is a V2 milestone.
4. **ADR update** — this document must be updated to reflect the new values and
   the rationale for the change.

### Frontend constants (reputation rank thresholds in `reputationRank.ts`)

1. The frontend thresholds must stay in sync with any contract-level eligibility
   changes. A PR updating `src/util/reputationRank.ts` must link to the
   governance proposal that approved the change.
2. No frontend-only threshold change is permitted without a corresponding
   governance decision.

### Emergency pause

The `CourseMilestone` and `scholarship_treasury` contracts both expose a `pause`
function callable by the admin. In the event of an exploit or parameter
misconfiguration that requires immediate action, the admin can pause minting and
disbursement while a corrective governance vote proceeds. This does not bypass
the change process — it buys time to run it correctly.

## Consequences

- All LRN minting rates and reputation thresholds are now documented and
  auditable without reading contract source code.
- The discrepancy between `docs/token-economics.md` and the contract's
  `GOV_PER_USDC` constant is surfaced and must be resolved.
- Future parameter changes require a governance vote, making economic policy
  changes traceable to on-chain proposals.
- V2 roadmap should include trustless on-chain execution of approved parameter
  changes to remove the admin multisig step.

## Contract References

| Contract              | Path                                        | Relevant symbols                                                 |
| --------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| `LearnToken`          | `contracts/learn_token/src/lib.rs`          | `mint`, `LRNError`                                               |
| `CourseMilestone`     | `contracts/course_milestone/src/lib.rs`     | `set_milestone_reward`, `verify_milestone`, `complete_milestone` |
| `ScholarshipTreasury` | `contracts/scholarship_treasury/src/lib.rs` | `GOV_PER_USDC`, deposit logic                                    |
| Frontend rank util    | `src/util/reputationRank.ts`                | `REPUTATION_TIERS`, `getReputationRankFromLrn`                   |
