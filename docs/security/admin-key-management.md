# Admin Key Management and Upgrade Authority

## Production Admin Baseline

Every production admin address should be a Soroban multisig/custom account with
a documented signer set. Do not use single-signer hot wallets for production
admin or upgrade authority.

Recommended baseline:

- Mainnet launch: 3-of-5 multisig for admin and upgrade execution.
- Testnet/staging: 2-of-3 multisig or explicitly documented deployer account.
- Emergency access: same multisig, with an incident record for any expedited
  execution.
- Signer inventory: owner, device/storage location, backup status, and rotation
  contact documented outside the public repo.

## Contract Authority Map

| Contract | Privileged role | Privileged functions |
| --- | --- | --- |
| `LearnToken` | Stored `ADMIN` | `mint`, `set_admin`, `upgrade` |
| `GovernanceToken` | Stored `ADMIN` | `mint`, `admin_burn_from`, `set_admin`, `pause`, `unpause`, `upgrade` |
| `CourseMilestone` | Stored `ADMIN` | `add_course`, `remove_course`, `set_milestone_reward`, `verify_milestone`, `batch_verify_milestones`, `reject_milestone`, `pause`, `unpause`, `upgrade` |
| `ScholarshipTreasury` | Stored `ADMIN`; configured governance contract | Admin controls configuration, pause, cancellation, and upgrade. Governance authorizes public `disburse`. |
| `MilestoneEscrow` | Stored `ADMIN`; configured treasury | Admin releases/reclaims tranches and upgrades. Treasury creates escrow records. |
| `ScholarNFT` | Stored `ADMIN` | `mint`, `revoke`, `transfer_admin`, `upgrade` |
| `UpgradeTimelockVault` | Stored `ADMIN` | `set_timelock_duration`, `queue_upgrade`, `execute_upgrade`, `cancel_upgrade` |
| `FungibleAllowlist` | Stored `Admin` | `add_to_allowlist`, `remove_from_allowlist`, `set_admin` |

## Upgrade Model

The six core upgradeable contracts call Soroban
`update_current_contract_wasm` through `learnvault_shared::upgrade::apply`.
The stored admin must authorize each upgrade. The emitted
`ContractUpgraded` event records the previous managed hash, the new hash, and
the admin address; Soroban native executable update events remain the canonical
runtime source for exact executable changes.

The `UpgradeTimelockVault` stores queued upgrade hashes and enforces a timelock
before returning the hash for execution. It does not update other contracts by
itself; the authorized executor must call the target contract's `upgrade`
function after vault execution.

## Required Upgrade Procedure

1. Build the WASM artifact from a reviewed commit.
2. Run `cargo test --workspace`, `cargo audit`, and Soroban lint/static checks.
3. Record the target contract, storage compatibility notes, rollback hash, and
   expected new WASM hash.
4. Queue the hash through governance or the timelock vault.
5. Wait the full timelock unless an emergency incident is declared.
6. Execute with the production multisig/custom account.
7. Verify emitted contract and Soroban system events.
8. Run post-upgrade smoke checks on read methods and cross-contract flows.

## Key Rotation

Rotate admin authority when a signer leaves, a device is lost, a signer key is
suspected compromised, or governance changes the signer policy.

Rotation requirements:

- New admin account is created and tested before transfer.
- Current admin authorizes `set_admin` / `transfer_admin`.
- Event logs are captured and linked from the operations record.
- Old signer keys are removed from the multisig policy immediately after
  confirmation.

## Emergency Handling

Emergency upgrades are reserved for active exploit, funds at risk, or protocol
outage. The incident record must include severity, affected contracts, exact
WASM hash, bypass rationale if timelock is skipped, transaction hash, and
follow-up remediation plan.
