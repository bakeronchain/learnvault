# ScholarshipTreasury Contract

## Purpose and Role

`scholarship_treasury` is the core treasury and proposal-management contract. It
accepts donor USDC, mints GOV rewards, stores scholarship proposals, records
votes, and disburses approved funds.

## Key Functions

| Function | Parameters | Access | Description |
| --- | --- | --- | --- |
| `initialize` | `admin`, `usdc_token`, `governance_contract`, `quorum_threshold`, `approval_bps` | `admin` auth | Sets treasury dependencies and governance thresholds. |
| `deposit` | `donor`, `amount` | `donor` auth | Transfers USDC in and mints GOV to the donor. |
| `disburse` | `recipient`, `amount` | governance-controlled auth | Sends treasury funds to a recipient. |
| `submit_proposal` | applicant and proposal metadata fields | applicant auth | Creates a scholarship proposal with milestone data. |
| `vote` | `voter`, `proposal_id`, `support` | `voter` auth | Casts a weighted yes or no vote. |
| `finalize_proposal` | `admin`, `proposal_id` | stored admin | Stores approved or rejected final status after deadline. |
| `execute_proposal` | `proposal_id` | public after deadline | Executes an approved proposal and marks it executed. |
| `cancel_proposal` | `proposal_id` | stored admin | Cancels a pending proposal. |
| `set_quorum` | `new_quorum` | stored admin | Updates the quorum threshold. |
| `set_approval_bps` | `new_bps` | stored admin | Updates the approval basis points requirement. |
| `set_milestone_count` | `count` | stored admin | Updates required proposal milestone count. |
| `set_min_lrn_to_propose` | `admin`, `min_lrn` | stored admin | Sets the minimum LRN needed to submit proposals. |
| `pause` / `unpause` | none | stored admin | Stops or resumes mutating workflows. |
| `get_balance`, `get_total_disbursed`, `get_exchange_rate`, `get_scholars_count`, `get_donors_count`, `get_donor_total`, `get_quorum`, `get_approval_bps`, `get_milestone_count`, `get_min_lrn_to_propose`, `get_proposal`, `get_proposals_by_applicant`, `get_proposals_by_status`, `get_active_proposals`, `get_proposal_count`, `get_finalized_status`, `get_total_gov_issued`, `is_paused`, `get_version` | query args only | public read | Treasury, proposal, and governance read APIs. |
| `upgrade` | `new_wasm_hash` | stored admin | Upgrades the contract WASM through the shared helper. |

## Authorization Model

- `initialize` requires the provided admin address to authorize once.
- Stored admin controls proposal thresholds, milestone count, pause state,
  cancellations, finalization, and upgrades.
- Donors authorize deposits with their own address.
- Applicants authorize their own proposal submission.
- Voters authorize their own votes.
- The linked governance or treasury authority controls `disburse`.
- Read methods are public.

## State Variables

| Storage Key | Meaning |
| --- | --- |
| `ADMIN` | Treasury administrator address. |
| `USDC` | Linked USDC token contract. |
| `GOV` | Linked governance token contract. |
| `TOTAL` | Total treasury balance tracked on-chain. |
| `NEXTPROP` | Next proposal ID counter. |
| `DISBURSED` | Total amount disbursed so far. |
| `SCHOLARS` | Count of scholars funded. |
| `DONORS` | Count of donors recorded. |
| `PAUSED` | Global pause flag. |
| `TOTALGOV` | Total GOV issued from deposits. |
| `MINPROP` | Minimum LRN threshold to submit proposals. |
| `QUORUM` | Voting quorum threshold. |
| `APPBPS` | Approval percentage in basis points. |
| `MSCNT` | Required milestone count per proposal. |
| `Donor(address)` | Total deposited by a donor. |
| `Proposal(id)` | Full scholarship proposal record. |
| `ApplicantProposals(address)` | Proposal IDs submitted by an applicant. |
| `Scholar(address)` | Scholar participation marker. |
| `VoteCast(proposal_id, voter)` | Duplicate-vote guard. |
| `FinalizedProposal(id)` | Final status after admin finalization. |
| `WASMHASH` | Last tracked managed upgrade hash from the shared helper. |

## Events Emitted

- `deposit` with `DepositRecorded { donor, amount }`
- `gov_issued` with `GovIssued { donor, usdc_amount, gov_amount }`
- `disburse` with `DisbursementRecorded { recipient, amount }`
- `proposal` with `ProposalSubmitted { applicant, proposal_id, amount }`
- `vote` with `VoteCastEvent { voter, proposal_id, support, weight }`
- `proposal_executed` with `ProposalExecuted { proposal_id, passed, amount }`
- `proposal_cancelled` with `ProposalCancelled { proposal_id, cancelled_by }`
- `contract_upgraded` from the shared upgrade helper

## Deploy with Stellar CLI

From the repository root:

```bash
stellar contract build --package scholarship-treasury
stellar contract deploy \
  --wasm target/wasm32v1-none/release/scholarship_treasury.wasm \
  --source <IDENTITY> \
  --network <NETWORK>
```

Initialize after deploy with:
`initialize(admin, usdc_token, governance_contract, quorum_threshold, approval_bps)`.

## Run Tests

From the repository root:

```bash
cargo test -p scholarship-treasury
```
