# Scholarship Tranche Disbursement Flow — End-to-End Guide

This document traces the complete lifecycle of a LearnVault scholarship from
proposal approval through final tranche release. It spans the frontend UI, the
backend job runner, and multiple Soroban smart contracts.

Related issue: #772

---

## Overview

A scholarship disbursement is split into **tranches** tied to milestone
completion. A scholar does not receive the full scholarship up front — funds are
held in the `milestone_escrow` contract and released incrementally as each
milestone is approved by a validator.

---

## Sequence Diagram

```
Sponsor / DAO                 Frontend               Backend               Contracts
     │                           │                      │                      │
     │  1. Submit proposal       │                      │                      │
     │──────────────────────────>│                      │                      │
     │                           │ POST /api/proposals  │                      │
     │                           │─────────────────────>│                      │
     │                           │                      │ scholarship_treasury │
     │                           │                      │  .create_proposal()  │
     │                           │                      │─────────────────────>│
     │                           │                      │   proposal stored    │
     │                           │                      │<─────────────────────│
     │                           │                      │                      │
     │  2. GOV holders vote      │                      │                      │
     │──────────────────────────>│                      │                      │
     │                           │ POST /api/proposals/{id}/vote               │
     │                           │─────────────────────>│                      │
     │                           │                      │ .vote_on_proposal()  │
     │                           │                      │─────────────────────>│
     │                           │                      │  vote recorded       │
     │                           │                      │<─────────────────────│
     │                           │                      │                      │
     │  3. Proposal passes       │                      │                      │
     │     (quorum + majority)   │                      │                      │
     │                           │                      │ [cron] finalize_job  │
     │                           │                      │─────────────────────>│
     │                           │                      │  .finalize_proposal()│
     │                           │                      │─────────────────────>│
     │                           │                      │  ProposalExecuted    │
     │                           │                      │  event emitted       │
     │                           │                      │<─────────────────────│
     │                           │                      │                      │
     │  4. Escrow created        │                      │                      │
     │                           │                      │  milestone_escrow    │
     │                           │                      │  .initialize()       │
     │                           │                      │─────────────────────>│
     │                           │                      │  USDC locked in      │
     │                           │                      │  escrow contract     │
     │                           │                      │<─────────────────────│
     │                           │                      │                      │
     │  5. Scholar submits work  │                      │                      │
     │<──────────────────────────│                      │                      │
     │                           │ POST /api/milestones │                      │
     │                           │─────────────────────>│                      │
     │                           │                      │ course_milestone     │
     │                           │                      │  .submit_milestone() │
     │                           │                      │─────────────────────>│
     │                           │                      │  Pending state set   │
     │                           │                      │<─────────────────────│
     │                           │                      │                      │
     │  6. Validator approves    │                      │                      │
     │──────────────────────────>│                      │                      │
     │                           │ POST /api/milestones/{id}/verify            │
     │                           │─────────────────────>│                      │
     │                           │                      │ course_milestone     │
     │                           │                      │  .verify_milestone() │
     │                           │                      │─────────────────────>│
     │                           │                      │  LRN minted          │
     │                           │                      │  MilestoneCompleted  │
     │                           │                      │  event emitted       │
     │                           │                      │<─────────────────────│
     │                           │                      │                      │
     │  7. Tranche released      │                      │                      │
     │                           │                      │ [event listener]     │
     │                           │                      │  milestone_escrow    │
     │                           │                      │  .release_tranche()  │
     │                           │                      │─────────────────────>│
     │                           │                      │  USDC sent to        │
     │                           │                      │  scholar wallet      │
     │                           │                      │<─────────────────────│
     │  Scholar receives USDC    │                      │                      │
     │<──────────────────────────│                      │                      │
```

---

## Step-by-Step Contract Call Order

### Step 1 — Proposal Submitted

**Contract**: `scholarship_treasury`  
**Function**: `create_proposal(applicant, amount, program_name, program_url, program_description, start_date, milestone_titles, milestone_dates)`  
**Who
calls it**: Backend API on behalf of the applicant after form submission.  
**Effect**: A `Proposal` struct is stored in persistent contract storage with
`executed: false`, `yes_votes: 0`, `no_votes: 0`, and a
`deadline_ledger = current_ledger + PROPOSAL_DEADLINE_LEDGERS` (≈7 days).

### Step 2 — Governance Vote

**Contract**: `scholarship_treasury`  
**Function**: `vote_on_proposal(voter, proposal_id, approve: bool)`  
**Who calls it**: GOV token holders via the DAO UI. Each caller signs the
transaction with their wallet.  
**Effect**: Votes are weighted by the voter's GOV balance. A `VoteCast` entry is
written to prevent double-voting. `yes_votes` or `no_votes` is incremented
atomically.

### Step 3 — Proposal Finalization

**Contract**: `scholarship_treasury`  
**Function**: `finalize_proposal(admin, proposal_id)`  
**Who calls it**: Backend cron job (`finalize_proposals_job`) that runs once per
ledger window after the proposal deadline passes.  
**Condition**: Current ledger ≥ `proposal.deadline_ledger`.  
**Effect**:

- If `yes_votes / (yes_votes + no_votes) ≥ APPROVAL_BPS / 10_000` and total
  votes ≥ `QUORUM`: proposal marked `Approved`,
  `ProposalExecuted { passed: true }` event emitted.
- Otherwise: `Rejected`, `ProposalExecuted { passed: false }` event emitted.

### Step 4 — Escrow Initialization

**Contract**: `milestone_escrow`  
**Function**: `initialize(admin, scholar, usdc_token, total_amount, milestone_count)`  
**Who
calls it**: Backend job triggered by the `ProposalExecuted` event (passed =
true).  
**Effect**: The `scholarship_treasury` transfers the approved USDC amount into
the `milestone_escrow` contract. Funds are now locked — they cannot be withdrawn
except through `release_tranche` or `cancel_escrow`.

### Step 5 — Scholar Submits Milestone Evidence

**Contract**: `course_milestone`  
**Function**: `submit_milestone(learner, course_id, milestone_id, evidence_uri)`  
**Who
calls it**: Scholar via the LearnVault UI after completing work.  
**Effect**: `MilestoneState` set to `Pending`. A `MilestoneSubmission` record is
stored with the evidence URI and timestamp. No funds move.

### Step 6 — Validator Approves Milestone

**Contract**: `course_milestone`  
**Function**: `verify_milestone(admin, learner, course_id, milestone_id, tokens_amount)`  
**Who
calls it**: Validator committee member via the Admin panel.  
**Effect**:

- `MilestoneState` transitions `Pending → Approved`.
- LRN (`tokens_amount`) minted to the scholar's wallet via `LearnToken.mint()`.
- `MilestoneCompleted` event emitted on-chain.

### Step 7 — Tranche Released

**Contract**: `milestone_escrow`  
**Function**: `release_tranche(admin, scholar, milestone_id)`  
**Who calls it**: Backend event listener picks up the `MilestoneCompleted` event
and triggers this call.  
**Effect**: `total_amount / milestone_count` USDC is transferred from the escrow
contract to the scholar's wallet address. A `TrancheReleased` event is emitted.
Once all milestones are approved, the escrow is fully drained.

---

## Backend Jobs Involved

| Job                      | Trigger                                                | Action                                                                     |
| ------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `finalize_proposals_job` | Cron, runs every ledger window after proposal deadline | Calls `scholarship_treasury.finalize_proposal()` for all expired proposals |
| `escrow_init_job`        | `ProposalExecuted { passed: true }` event              | Calls `milestone_escrow.initialize()` and transfers USDC into escrow       |
| `tranche_release_job`    | `MilestoneCompleted` event from `course_milestone`     | Calls `milestone_escrow.release_tranche()` for the corresponding milestone |

All jobs authenticate with the admin key. They are idempotent: if called twice
for the same proposal or milestone, the contract's `executed` flags and
`Approved` state checks prevent double execution.

---

## What the Scholar Sees in the UI

| Stage                  | UI state                                                             |
| ---------------------- | -------------------------------------------------------------------- |
| Application submitted  | "Under review" badge on `ScholarMilestones` page                     |
| Proposal open for vote | "Voting in progress — X days remaining"                              |
| Proposal approved      | "Scholarship approved — funds secured in escrow"                     |
| Milestone submitted    | "Awaiting validator review" with a pending spinner                   |
| Milestone approved     | "Milestone complete — tranche released" with USDC amount and tx link |
| All milestones done    | Scholarship marked complete; `ScholarNFT` minted as credential       |

---

## Error Scenarios and Recovery

### Proposal rejected

The escrow is never created. The applicant can submit a new proposal after
addressing the feedback. USDC stays in the treasury.

### Validator rejects a milestone submission

`course_milestone.reject_milestone()` is called. `MilestoneState` returns to
`NotStarted`. The submission record is deleted. The scholar can resubmit with
corrected evidence. No funds move and no LRN is minted.

### Escrow initialization fails (backend job error)

The backend `escrow_init_job` retries with exponential back-off (max 5
attempts). If all retries fail, an alert is raised for manual intervention. The
treasury USDC is not at risk — it stays in the `scholarship_treasury` until the
escrow transfer is explicitly called.

### Tranche release fails

If `milestone_escrow.release_tranche()` reverts (e.g., the escrow contract ran
out of USDC due to a bug), the `tranche_release_job` raises an alert. The admin
can call `cancel_escrow()` to return remaining funds to the treasury and
re-disburse manually via a corrective proposal.

### Proposal deadline passes with no quorum

`finalize_proposal` marks the proposal as `Rejected`. No escrow is created. The
applicant may resubmit. Token holders who did not vote are not penalized in V1.

---

## Related Contracts

| Contract               | Path                                        | Role in flow                          |
| ---------------------- | ------------------------------------------- | ------------------------------------- |
| `scholarship_treasury` | `contracts/scholarship_treasury/src/lib.rs` | Proposal creation, voting, execution  |
| `milestone_escrow`     | `contracts/milestone_escrow/src/lib.rs`     | USDC custody and tranche release      |
| `course_milestone`     | `contracts/course_milestone/src/lib.rs`     | Milestone submission and verification |
| `learn_token`          | `contracts/learn_token/src/lib.rs`          | LRN minting on milestone approval     |
| `scholar_nft`          | `contracts/scholar_nft/src/lib.rs`          | Credential NFT on full completion     |
