# Contract Event Schemas

This document lists on-chain events emitted by our contracts and the schema for each event payload. It covers the nine main contracts so the backend event indexer can parse and index events consistently.

## Summary
- Covered contracts: `learn_token`, `governance_token`, `course_milestone`, `scholar_nft`, `fungible-allowlist`, `milestone_escrow`, `scholarship_treasury`, `upgrade_timelock_vault`, `shared` (upgrade helper).

---

## `governance_token`

- Event name: `GOVMinted`
  - Event data fields and types: `{ to: Address, amount: i128 }`
  - When the event is emitted: When new governance tokens are minted to a recipient (e.g., donor reward or conversion from LRN).
  - Example event payload:

    ```json
    { "to": "GABCDE...", "amount": 100000000 }
    ```

- Event name: `GOVBurned`
  - Event data fields and types: `{ from: Address, amount: i128 }`
  - When the event is emitted: When governance tokens are burned (e.g., penalties or supply adjustments).
  - Example event payload:

    ```json
    { "from": "GABCDE...", "amount": 50000000 }
    ```

- Event name: `GOVPaused`
  - Event data fields and types: `{ admin: Address }`
  - When the event is emitted: When the token contract is paused by an admin.
  - Example event payload:

    ```json
    { "admin": "GADMIN..." }
    ```

- Event name: `GOVUnpaused`
  - Event data fields and types: `{ admin: Address }`
  - When the event is emitted: When the token contract is unpaused by an admin.
  - Example event payload:

    ```json
    { "admin": "GADMIN..." }
    ```

- Event name: `GOVTransferred`
  - Event data fields and types: `{ from: Address, to: Address, amount: i128 }`
  - When the event is emitted: On token transfers between accounts.
  - Example event payload:

    ```json
    { "from": "GFROM...", "to": "GTO...", "amount": 25000000 }
    ```

- Event name: `GOVApproved`
  - Event data fields and types: `{ owner: Address, spender: Address, amount: i128 }`
  - When the event is emitted: When an allowance approval is recorded.
  - Example event payload:

    ```json
    { "owner": "GOWNER...", "spender": "GSPENDER...", "amount": 100000000 }
    ```

See source: contracts/governance_token/src/lib.rs for emit locations.

---

## `learn_token`

- Event name: `lrn_mint` (topic-based)
  - Event data fields and types: topic `("lrn_mint", to: Address)`, payload `{ amount: i128 }`
  - When the event is emitted: When the contract mints LearnTokens to a learner after milestone verification.
  - Example event payload:

    ```json
    { "to": "GLEARNER...", "amount": 75000000 }
    ```

- Event name: `set_admin` (topic-based)
  - Event data fields and types: topic `("set_admin",)`, payload `{ new_admin: Address }`
  - When the event is emitted: When the contract admin role is changed.
  - Example event payload:

    ```json
    { "new_admin": "GNEWADMIN..." }
    ```

See source: contracts/learn_token/src/lib.rs

---

## `course_milestone`

- Event name: `Submitted`
  - Event data fields and types: `{ learner: Address, course_id: String, evidence_uri: String, milestone_id: u32 }`
  - When the event is emitted: When a learner submits evidence for a milestone (before verification).
  - Example event payload:

    ```json
    { "learner": "GLEARNER...", "course_id": "rust-101", "evidence_uri": "ipfs://Qm...", "milestone_id": 2 }
    ```

- Event name: `Enrolled`
  - Event data fields and types: `{ learner: Address, course_id: String }`
  - When the event is emitted: When a learner enrolls in a course.
  - Example event payload:

    ```json
    { "learner": "GLEARNER...", "course_id": "rust-101" }
    ```

- Event name: `MilestoneCompleted`
  - Event data fields and types: `{ learner: Address, course_id: String, milestone_id: u32, lrn_reward: i128 }`
  - When the event is emitted: When a milestone is verified and LearnTokens are awarded.
  - Example event payload:

    ```json
    { "learner": "GLEARNER...", "course_id": "rust-101", "milestone_id": 2, "lrn_reward": 50000000 }
    ```

- Event name: `CourseCompleted`
  - Event data fields and types: `{ learner: Address, course_id: String }`
  - When the event is emitted: When a learner completes all course milestones.
  - Example event payload:

    ```json
    { "learner": "GLEARNER...", "course_id": "rust-101" }
    ```

See source: contracts/course_milestone/src/lib.rs

---

## `scholar_nft`

- Event name: `Minted`
  - Event data fields and types: `{ token_id: u64, owner: Address }`
  - When the event is emitted: When a ScholarNFT credential is minted to a scholar.
  - Example event payload:

    ```json
    { "token_id": 42, "owner": "GSCHOLAR..." }
    ```

- Event name: `TransferAttempt`
  - Event data fields and types: `{ from: Address, to: Address, token_id: u64 }`
  - When the event is emitted: When a transfer is attempted (soulbound transfers may be rejected); recorded for auditing.
  - Example event payload:

    ```json
    { "from": "GFROM...", "to": "GTO...", "token_id": 42 }
    ```

- Event name: `Initialized`
  - Event data fields and types: `{ admin: Address }`
  - When the event is emitted: When the contract is initialized and admin set.
  - Example event payload:

    ```json
    { "admin": "GADMIN..." }
    ```

- Event name: `Revoked`
  - Event data fields and types: `{ token_id: u64, reason: String }`
  - When the event is emitted: When a credential is revoked by admin.
  - Example event payload:

    ```json
    { "token_id": 42, "reason": "violation_of_terms" }
    ```

- Event name: `AdminChanged`
  - Event data fields and types: `{ old_admin: Address, new_admin: Address }`
  - When the event is emitted: When the contract admin role changes.
  - Example event payload:

    ```json
    { "old_admin": "GOLD...", "new_admin": "GNEW..." }
    ```

See source: contracts/scholar_nft/src/lib.rs

---

## `fungible-allowlist`

- Events: None emitted by this contract (no `publish` or typed `.publish(&env)` calls found).
  - When the event is emitted: N/A — this crate does not publish on-chain events.
  - Example event payload: N/A

See source: contracts/fungible-allowlist/src/

---

## `milestone_escrow`

- Event name: `EscrowCreated`
  - Event data fields and types: `{ proposal_id: u32, scholar: Address, total_amount: i128, total_tranches: u32 }`
  - When the event is emitted: When an approved proposal results in a new escrow with tranches created for a scholar.
  - Example event payload:

    ```json
    { "proposal_id": 7, "scholar": "GSCHOLAR...", "total_amount": 1000000000, "total_tranches": 4 }
    ```

- Event name: `TrancheReleased`
  - Event data fields and types: `{ proposal_id: u32, scholar: Address, amount: i128, tranche_index: u32 }`
  - When the event is emitted: When a tranche of funds is released to a scholar after milestone verification.
  - Example event payload:

    ```json
    { "proposal_id": 7, "scholar": "GSCHOLAR...", "amount": 250000000, "tranche_index": 1 }
    ```

- Event name: `EscrowReclaimed`
  - Event data fields and types: `{ proposal_id: u32, scholar: Address, amount_reclaimed: i128 }`
  - When the event is emitted: When unspent escrow funds are reclaimed (e.g., timeout or cancellation).
  - Example event payload:

    ```json
    { "proposal_id": 7, "scholar": "GSCHOLAR...", "amount_reclaimed": 500000000 }
    ```

See source: contracts/milestone_escrow/src/lib.rs

---

## `scholarship_treasury`

- Event name: `ProposalSubmitted`
  - Event data fields and types: `{ applicant: Address, proposal_id: u32, amount: i128 }`
  - When the event is emitted: When a learner submits a scholarship proposal to the treasury.
  - Example event payload:

    ```json
    { "applicant": "GAPPLICANT...", "proposal_id": 12, "amount": 500000000 }
    ```

- Event name: `ProposalExecuted`
  - Event data fields and types: `{ proposal_id: u32, passed: bool, amount: i128 }`
  - When the event is emitted: When a proposal execution completes (approved and funds transferred or marked executed).
  - Example event payload:

    ```json
    { "proposal_id": 12, "passed": true, "amount": 500000000 }
    ```

- Event name: `ProposalCancelled`
  - Event data fields and types: `{ proposal_id: u32, cancelled_by: Address }`
  - When the event is emitted: When a proposal is cancelled prior to execution (by proposer or admin).
  - Example event payload:

    ```json
    { "proposal_id": 12, "cancelled_by": "GADMIN..." }
    ```

- Event name: `DepositRecorded`
  - Event data fields and types: `{ donor: Address, amount: i128 }`
  - When the event is emitted: When the treasury receives a donor deposit (USDC -> governance minting flow).
  - Example event payload:

    ```json
    { "donor": "GDONOR...", "amount": 1000000000 }
    ```

- Event name: `DisbursementRecorded`
  - Event data fields and types: `{ recipient: Address, amount: i128 }`
  - When the event is emitted: When funds are disbursed from the treasury to an escrow or recipient.
  - Example event payload:

    ```json
    { "recipient": "GRECIPIENT...", "amount": 250000000 }
    ```

- Event name: `GovIssued`
  - Event data fields and types: `{ donor: Address, usdc_amount: i128, gov_amount: i128 }`
  - When the event is emitted: When governance tokens are issued to a donor following a USDC deposit.
  - Example event payload:

    ```json
    { "donor": "GDONOR...", "usdc_amount": 1000000000, "gov_amount": 1000000 }
    ```

- Event name: `VoteCastEvent`
  - Event data fields and types: `{ voter: Address, proposal_id: u32, support: bool, weight: i128 }`
  - When the event is emitted: When a governance token holder casts a vote on a proposal.
  - Example event payload:

    ```json
    { "voter": "GVOTER...", "proposal_id": 12, "support": true, "weight": 500000 }
    ```

See source: contracts/scholarship_treasury/src/lib.rs

---

## `upgrade_timelock_vault`

- Event name: `UpgradeQueued`
  - Event data fields and types: `{ contract_address: Address, new_wasm_hash: BytesN<32>, queued_at: u64, admin: Address }`
  - When the event is emitted: When an upgrade request is queued for a contract with a timelock.
  - Example event payload:

    ```json
    { "contract_address": "GCONTRACT...", "new_wasm_hash": "0xabc123...", "queued_at": 1710000000, "admin": "GADMIN..." }
    ```

- Event name: `UpgradeExecuted`
  - Event data fields and types: `{ contract_address: Address, new_wasm_hash: BytesN<32>, executed_at: u64 }`
  - When the event is emitted: When a queued upgrade is executed after the timelock expires and authorization passes.
  - Example event payload:

    ```json
    { "contract_address": "GCONTRACT...", "new_wasm_hash": "0xabc123...", "executed_at": 1710003600 }
    ```

- Event name: `UpgradeCancelled`
  - Event data fields and types: `{ contract_address: Address, new_wasm_hash: BytesN<32>, cancelled_at: u64 }`
  - When the event is emitted: When a queued upgrade is cancelled before execution.
  - Example event payload:

    ```json
    { "contract_address": "GCONTRACT...", "new_wasm_hash": "0xabc123...", "cancelled_at": 1710001800 }
    ```

See source: contracts/upgrade_timelock_vault/src/lib.rs

---


## `shared` (upgrade helper)

- Event name: `ContractUpgraded`
  - Event data fields and types: `{ old_hash: BytesN<32>, new_hash: BytesN<32>, upgraded_by: Address }`
  - When the event is emitted: When a contract's WASM is successfully upgraded via the shared upgrade helper.
  - Example event payload:

    ```json
    { "old_hash": "0xold...", "new_hash": "0xnew...", "upgraded_by": "GADMIN..." }
    ```

  - Note: This helper event is published by many contracts via `shared::upgrade::apply(...)`.

See source: contracts/shared/src/upgrade.rs

---

If you want example payloads in a different format or additional clarifications, tell me which format and I will provide them. This document intentionally avoids machine schemas and exact source line references per issue scope.
