# LearnVault Smart Contract Audit Scope

**Status:** Audit preparation
**Prepared for:** Third-party formal security review
**Network/runtime:** Stellar Soroban, Rust `no_std`, Soroban SDK `23.1.0`

## Scope Summary

The current repository contains **8 deployable production contract crates** and
1 shared support crate. The issue text references 9 production contracts, but no
ninth deployable contract is present in the current `contracts/*` workspace.

In scope:

| Contract crate | Contract | Primary responsibility | Upgrade entry point |
| --- | --- | --- | --- |
| `contracts/learn_token` | `LearnToken` | Soulbound LRN reputation token | `upgrade(new_wasm_hash)` |
| `contracts/governance_token` | `GovernanceToken` | Transferable GOV voting token | `upgrade(new_wasm_hash)` |
| `contracts/course_milestone` | `CourseMilestone` | Course enrollment and milestone verification | `upgrade(new_wasm_hash)` |
| `contracts/scholarship_treasury` | `ScholarshipTreasury` | USDC custody, donor rewards, proposal voting, disbursement | `upgrade(new_wasm_hash)` |
| `contracts/milestone_escrow` | `MilestoneEscrow` | Tranche-based scholarship escrow and inactivity reclaim | `upgrade(new_wasm_hash)` |
| `contracts/scholar_nft` | `ScholarNFT` | Soulbound scholarship credential NFT | `upgrade(new_wasm_hash)` |
| `contracts/upgrade_timelock_vault` | `UpgradeTimelockVault` | Timelocked storage for upgrade proposals | Not self-upgradeable |
| `contracts/fungible-allowlist` | `FungibleAllowlist` | Admin-managed allowlist helper | Not self-upgradeable |

Support crate:

| Crate | Purpose | Audit relevance |
| --- | --- | --- |
| `contracts/shared` | Shared managed-upgrade event/hash helpers | Review as part of every upgradeable contract |

Out of scope unless requested separately:

- Frontend and backend application code.
- Deployment account funding and Stellar network operations outside the
  documented admin/upgrade runbooks.
- Test-only mock contracts declared inside `src/test.rs` files.

## Key Trust Assumptions

| Area | Assumption |
| --- | --- |
| Admin accounts | Production admin addresses are controlled by a documented multisig or custom account policy, not by a single hot key. |
| Initialization | Deployment transactions initialize contracts atomically and require the intended admin address to authorize initialization. |
| Upgrade authority | Upgradeable contracts trust their stored admin to approve `upgrade(new_wasm_hash)` calls. |
| Timelock vault | The vault admin is the governance/executor authority and is trusted to queue, execute, or cancel only approved upgrade hashes. |
| External tokens | USDC/XLM/token clients follow Soroban token semantics and revert atomically on failed transfers. |
| Governance token | Voting power returned by `GovernanceToken` is non-negative and derived from balances plus valid delegation state. |
| Indexing | Off-chain services/indexers consume events for proposal, allowlist, credential, and upgrade observability. |
| Metadata | NFT metadata URIs are treated as off-chain content pointers; contracts do not validate URI availability or content integrity. |

## High-Risk Review Areas

- Treasury custody and `ScholarshipTreasury::disburse` / proposal execution.
- Escrow release and inactivity reclaim accounting.
- Admin-only functions across all contracts.
- Upgrade paths and storage compatibility across all upgradeable contracts.
- Token supply, delegated voting power, allowance, and transfer accounting.
- Reentrancy-style risks around cross-contract token calls, even though Soroban
  has a different execution model from EVM.

## Auditor Deliverables Requested

- Confirm no unauthorized caller can initialize, administer, mint, disburse,
  verify, revoke, pause, queue, execute, cancel, or upgrade outside documented
  authority.
- Confirm all value and supply accounting is overflow/underflow safe.
- Confirm state is committed before external token calls where reentrant
  execution would otherwise observe stale contract state.
- Confirm all trust assumptions are acceptable for mainnet deployment.
- Provide prioritized findings with severity, exploit scenario, impacted
  contracts, and recommended remediation.
