# Requirements Document

## Introduction

This feature upgrades the LearnVault DAO governance system from equal-weight voting to weighted voting, where each voter's influence is proportional to their GOV token balance captured at a snapshot block when the proposal is created. The change affects the `governance_token` contract (snapshot storage), the `scholarship_treasury` contract (proposal creation, vote tally, lock-period enforcement), and the DAO proposal frontend view (voting power breakdown display).

Currently, `get_voting_power` reads the live token balance at vote time, which allows balance manipulation between proposal creation and vote casting. This feature closes that window by recording a per-voter snapshot at proposal creation and using that frozen value for all vote weight calculations.

## Glossary

- **GOV**: The LearnVault Governance Token (SEP-41 fungible token, 7 decimals) minted by the `GovernanceToken` contract.
- **GovernanceToken**: The Soroban smart contract that manages GOV balances, delegation, and — after this feature — balance snapshots.
- **ScholarshipTreasury**: The Soroban smart contract that manages proposals, voting, quorum, and fund disbursement.
- **Proposal**: A scholarship funding request submitted to the ScholarshipTreasury, identified by a `proposal_id` (u32).
- **Snapshot_Ledger**: The ledger sequence number recorded at the moment a Proposal is created; used as the reference point for all voting-power lookups on that Proposal.
- **Snapshot_Balance**: The GOV balance (including delegated power) of an address as of the Snapshot_Ledger for a specific Proposal.
- **Voting_Power**: The effective vote weight of an address for a given Proposal, equal to its Snapshot_Balance.
- **Lock_Period**: A mandatory minimum number of ledgers that must elapse between a voter's last GOV transfer/receipt and the moment they may create a new Proposal, preventing last-minute balance inflation.
- **Lock_Period_Ledgers**: The configurable length of the Lock_Period, measured in ledger sequence numbers (default: 17,280 ledgers ≈ 1 day at ~6 s/ledger).
- **Quorum**: The minimum total Voting_Power that must participate in a vote for the result to be valid, stored in the ScholarshipTreasury.
- **Approval_BPS**: Basis-points threshold (0–10,000) of yes-votes required for a Proposal to pass.
- **DAO_Proposal_View**: The frontend page that displays a Proposal's details, vote tallies, and per-voter Voting_Power breakdown.
- **Voter**: Any address that holds GOV tokens and casts a vote on a Proposal.
- **Proposer**: The address that calls `submit_proposal` on the ScholarshipTreasury.
- **Admin**: The privileged address stored in both contracts that may perform administrative operations.

---

## Requirements

### Requirement 1: Balance Snapshot at Proposal Creation

**User Story:** As a GOV token holder, I want my voting power to be locked at the moment a proposal is created, so that no one can game the vote by acquiring tokens after the proposal is live.

#### Acceptance Criteria

1. WHEN `submit_proposal` is called on the ScholarshipTreasury, THE ScholarshipTreasury SHALL record the current ledger sequence number as the `snapshot_ledger` field of the new Proposal.
2. WHEN `submit_proposal` is called, THE ScholarshipTreasury SHALL store the Snapshot_Balance for the Proposer's address — defined as the Proposer's GOV token balance at the `snapshot_ledger` — under the key `(proposal_id, proposer)` in persistent storage.
3. THE ScholarshipTreasury SHALL expose a `get_snapshot_balance(proposal_id: u32, voter: Address) -> i128` read function that returns the stored Snapshot_Balance for a given Proposal and address, or `0` if no snapshot exists for that address.
4. WHEN `get_snapshot_balance` is called for an address that has not yet had its balance snapshotted for the given Proposal, THE ScholarshipTreasury SHALL return `0`.
5. WHEN a voter casts their first vote on a Proposal, THE ScholarshipTreasury SHALL record that voter's Snapshot_Balance (their GOV balance at `snapshot_ledger`) under the key `(proposal_id, voter)` in persistent storage before tallying the vote.

---

### Requirement 2: Lazy Voter Snapshot on First Vote

**User Story:** As a GOV token holder, I want my balance to be captured the first time I vote on a proposal, so that my voting power reflects my holdings at proposal creation time without requiring upfront enumeration of all holders.

#### Acceptance Criteria

1. WHEN `vote` is called on the ScholarshipTreasury for a given `proposal_id` and `voter`, IF no Snapshot_Balance exists for `(proposal_id, voter)`, THEN THE ScholarshipTreasury SHALL call `GovernanceToken.balance_at(voter, snapshot_ledger)` to retrieve the Snapshot_Balance and store it under `(proposal_id, voter)`.
2. WHEN `vote` is called and a Snapshot_Balance already exists for `(proposal_id, voter)`, THE ScholarshipTreasury SHALL use the stored Snapshot_Balance as the vote weight without querying the GovernanceToken again.
3. THE GovernanceToken SHALL expose a `balance_at(account: Address, ledger: u32) -> i128` function that returns the GOV balance of `account` at the specified ledger sequence number, where `ledger` is the `snapshot_ledger` of the Proposal being voted on.
4. IF `balance_at` is called with a `ledger` value for which no balance-change entry exists at or before that ledger for `account`, THEN THE GovernanceToken SHALL return `0`.
5. IF `balance_at` is called with a `ledger` value greater than the current ledger sequence, THEN THE GovernanceToken SHALL return `0`.
6. IF `GovernanceToken.balance_at` returns an error or is unavailable when called during `vote`, THEN THE ScholarshipTreasury SHALL revert the `vote` transaction with an appropriate error code.

---

### Requirement 3: Historical Balance Recording in GovernanceToken

**User Story:** As a system, I need the GovernanceToken to record balance checkpoints on every balance-changing operation, so that historical balances can be retrieved for snapshot voting.

#### Acceptance Criteria

1. WHEN `mint`, `transfer`, `transfer_from`, `burn`, or `admin_burn_from` is called on the GovernanceToken and the operation results in a net change to an address's balance, THE GovernanceToken SHALL write a checkpoint entry `(address, ledger_sequence) -> new_balance` to persistent storage before the function returns. Operations that result in no net balance change (e.g., a transfer from an address to itself) SHALL NOT write a checkpoint.
2. THE GovernanceToken SHALL store checkpoints using a storage key of the form `Checkpoint(Address, u32)` where the `u32` is the ledger sequence number at the time of the balance change.
3. WHEN multiple balance-changing operations occur for the same address within the same ledger, THE GovernanceToken SHALL overwrite the checkpoint for that ledger with the final balance after all operations in that ledger.
4. WHEN a checkpoint entry is created or updated, THE GovernanceToken SHALL extend the TTL of that entry to at least `DAY_IN_LEDGERS × 365` ledgers from the current ledger.
5. WHEN `balance_at(account, ledger)` is called, THE GovernanceToken SHALL return the checkpoint value stored at `Checkpoint(account, ledger)` if it exists, or `0` if no checkpoint exists at or before that ledger for `account`.

---

### Requirement 4: Weighted Vote Tally

**User Story:** As a DAO participant, I want each vote to count proportionally to the voter's GOV balance at snapshot time, so that larger stakeholders have appropriately greater influence on outcomes.

#### Acceptance Criteria

1. WHEN `vote` is called on the ScholarshipTreasury with `support = true`, THE ScholarshipTreasury SHALL add the voter's Snapshot_Balance to `proposal.yes_votes`.
2. WHEN `vote` is called on the ScholarshipTreasury with `support = false`, THE ScholarshipTreasury SHALL add the voter's Snapshot_Balance to `proposal.no_votes`.
3. WHEN a voter's Snapshot_Balance is `0`, THE ScholarshipTreasury SHALL record the vote with weight `0`, increment neither `yes_votes` nor `no_votes` by a non-zero amount, and emit a `VoteCastEvent` with `weight = 0`.
4. THE ScholarshipTreasury SHALL use only the Snapshot_Balance — not the voter's live GOV balance — when tallying votes for a Proposal.
5. WHEN `execute_proposal` or `finalize_proposal` is called, THE ScholarshipTreasury SHALL pass the Proposal only if `(yes_votes + no_votes) >= quorum_threshold` AND `yes_votes * 10_000 / (yes_votes + no_votes) >= approval_bps`; otherwise the Proposal SHALL be rejected.
6. WHEN `vote` is called by an address that has already voted on the given Proposal, THE ScholarshipTreasury SHALL reject the call with error `AlreadyVoted` and SHALL NOT modify `yes_votes`, `no_votes`, or the stored Snapshot_Balance.
7. WHEN `vote` is called on a Proposal whose status is not `Active` (e.g., cancelled, executed, or past its voting deadline), THE ScholarshipTreasury SHALL reject the call with error `ProposalNotActive`.

---

### Requirement 5: Lock Period Before Proposal Submission

**User Story:** As a DAO member, I want a mandatory lock period between a user's last token transfer and their ability to create a proposal, so that users cannot inflate their snapshot balance by acquiring tokens immediately before submitting.

#### Acceptance Criteria

1. THE ScholarshipTreasury SHALL store a configurable `lock_period_ledgers` value in the range `[0, 1_051_200]` (default: 17,280) that defines the minimum number of ledgers that must have elapsed since the Proposer's last GOV balance change before a new Proposal may be submitted.
2. WHEN `submit_proposal` is called, THE ScholarshipTreasury SHALL query `GovernanceToken.last_transfer_ledger(proposer)` to retrieve the ledger of the Proposer's most recent balance change.
3. IF the difference between the current ledger sequence and `last_transfer_ledger(proposer)` is less than `lock_period_ledgers`, THEN THE ScholarshipTreasury SHALL reject the call with error `LockPeriodNotElapsed`.
4. THE GovernanceToken SHALL expose a `last_transfer_ledger(account: Address) -> u32` function that returns the ledger sequence number of the most recent balance-changing operation for `account`, or `0` if the account has never held GOV.
5. WHEN `mint`, `transfer`, `transfer_from`, `burn`, or `admin_burn_from` changes an address's balance, THE GovernanceToken SHALL update the `LastTransfer(address)` persistent storage entry to the current ledger sequence number.
6. WHEN `set_lock_period` is called by the Admin with a value in the range `[0, 1_051_200]`, THE ScholarshipTreasury SHALL update `lock_period_ledgers` and apply the new value to all subsequent `submit_proposal` calls without affecting already-submitted Proposals.
7. IF `lock_period_ledgers` is set to `0`, THEN THE ScholarshipTreasury SHALL permit `submit_proposal` calls without enforcing any lock period.
8. IF `set_lock_period` is called by any address other than the Admin, THEN THE ScholarshipTreasury SHALL reject the call with error `Unauthorized`.

---

### Requirement 6: Voting Power Breakdown in DAO Proposal View

**User Story:** As a DAO participant viewing a proposal, I want to see each voter's voting power alongside their vote, so that I can understand the weight distribution of the current tally.

#### Acceptance Criteria

1. THE ScholarshipTreasury SHALL expose a `get_vote_detail(proposal_id: u32, voter: Address) -> Option<VoteDetail>` read function that returns the voter's `support` direction and `weight` (Snapshot_Balance) for a given Proposal.
2. THE `VoteDetail` struct SHALL contain the fields `voter: Address`, `support: bool`, and `weight: i128`.
3. WHEN `get_vote_detail` is called for an address that has not voted on the given Proposal, or for a non-existent `proposal_id`, THE ScholarshipTreasury SHALL return `None`.
4. THE ScholarshipTreasury SHALL expose a `get_proposal_vote_summary(proposal_id: u32) -> ProposalVoteSummary` read function that returns `yes_votes`, `no_votes`, `total_votes`, and `snapshot_ledger` for the Proposal.
5. THE `ProposalVoteSummary` struct SHALL contain the fields `yes_votes: i128`, `no_votes: i128`, `total_votes: i128`, and `snapshot_ledger: u32`, where `total_votes = yes_votes + no_votes` at all times.
6. WHEN `get_proposal_vote_summary` is called for a non-existent `proposal_id`, THE ScholarshipTreasury SHALL return a `ProposalVoteSummary` with all numeric fields set to `0`.
7. WHEN the DAO_Proposal_View frontend component renders a Proposal, it SHALL display each voter's address, vote direction (yes/no), and Voting_Power weight by calling `get_vote_detail` for each address for which a `VoteCastEvent` was emitted on that Proposal.
8. THE DAO_Proposal_View frontend component SHALL display the `ProposalVoteSummary` totals (yes, no, total, snapshot ledger) in the proposal detail panel.

---

### Requirement 7: Snapshot Data Integrity

**User Story:** As a DAO participant, I want the snapshot system to be tamper-proof and consistent, so that voting power cannot be altered after a proposal is created.

#### Acceptance Criteria

1. IF a Snapshot_Balance has been stored for `(proposal_id, voter)`, THEN THE ScholarshipTreasury SHALL NOT overwrite or delete that entry until the Proposal has been executed or cancelled.
2. THE GovernanceToken SHALL NOT allow any external caller to write or modify checkpoint entries directly; checkpoints SHALL only be written as a side-effect of `mint`, `transfer`, `transfer_from`, `burn`, or `admin_burn_from`.
3. WHEN `balance_at(account, ledger)` is called, THE GovernanceToken SHALL return a value equal to the account's GOV balance after all balance-changing operations recorded at or before `ledger`; if no such operations exist, it SHALL return `0`.
4. WHEN a `(proposal_id, voter)` snapshot entry is created, THE ScholarshipTreasury SHALL extend the TTL of that entry to at least `DAY_IN_LEDGERS × 365` ledgers from the current ledger.

---

### Requirement 8: Backward Compatibility and Migration

**User Story:** As a system operator, I want the weighted voting upgrade to be backward compatible with existing proposals, so that in-flight votes are not disrupted.

#### Acceptance Criteria

1. WHEN `vote` is called on a Proposal that was created before the weighted-voting upgrade (i.e., `snapshot_ledger = 0`), THE ScholarshipTreasury SHALL fall back to using the voter's live `get_voting_power` result at the time `vote` is called as the vote weight.
2. THE GovernanceToken upgrade SHALL preserve all existing `Balance(Address)` entries and the `TotalSupply` instance value without modification.
3. WHEN `last_transfer_ledger(account)` is called for an account whose `LastTransfer` entry has not yet been initialized, THE GovernanceToken SHALL return `0` without writing any storage entry, and SHALL NOT overwrite an existing `LastTransfer` entry for that account.
4. THE ScholarshipTreasury upgrade SHALL add the `snapshot_ledger` field to the `Proposal` struct with a default value of `0` for any Proposal deserialized from pre-upgrade storage.
