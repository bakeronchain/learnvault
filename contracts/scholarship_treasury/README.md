# ScholarshipTreasury Contract

Custodies donor USDC, mints GOV rewards, manages scholarship proposals, records
votes, and disburses approved funding.

## Authority and Trust Assumptions

- `initialize(...)` requires `admin` authorization and can run once.
- Stored `ADMIN` controls quorum/approval parameters, pause state, proposal
  cancellation, minimum proposal balance, and upgrades.
- Configured governance contract is trusted for GOV minting and voting power.
- Configured USDC token is trusted to follow Soroban token transfer semantics.

## Functions

| Function | Access | Notes |
| --- | --- | --- |
| `initialize(admin, usdc_token, governance_contract, quorum_threshold, approval_bps)` | Admin auth | Stores config and validates quorum/approval values. |
| `deposit(donor, amount)` | `donor` auth | Transfers USDC in, mints GOV, and updates checked accounting. |
| `disburse(recipient, amount)` | Governance contract auth | Sends funds out with checked state updates before token transfer. |
| `submit_proposal(...)` | Applicant auth | Requires amount, exactly 3 milestone titles/dates, and minimum GOV/LRN threshold. |
| `vote(voter, proposal_id, support)` | `voter` auth | Uses current voting power, rejects duplicate/closed/cancelled/executed proposals. |
| `execute_proposal(proposal_id)` | Public after deadline | Marks proposal executed before approved disbursement. |
| `finalize_proposal(admin, proposal_id)` | Stored admin | Stores approved/rejected status after deadline. |
| `cancel_proposal(proposal_id)` | Stored admin | Cancels pending proposal before voting closes. |
| `set_quorum`, `set_approval_bps` | Stored admin | Updates governance thresholds. |
| `set_min_lrn_to_propose`, `clear_min_lrn_to_propose` | Stored admin | Manages applicant threshold. |
| `pause`, `unpause` | Stored admin | Toggles mutating treasury workflows. |
| `upgrade(new_wasm_hash)` | Stored admin | Replaces current WASM through shared upgrade helper. |
| `get_*` views | Public read | Balances, counts, proposal lists/status, config, version, and pause state. |

## Audit Focus

- Treasury funds can only leave through governance-authorized or approved
  proposal execution paths.
- Proposal execution cannot be reentered before `executed` is stored.
- Vote totals, proposal IDs, disbursement totals, donor totals, and GOV issued
  totals use checked arithmetic.
- Quorum and approval basis-point semantics match governance intent.
