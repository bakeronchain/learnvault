# UpgradeTimelockVault Contract

Stores queued upgrade hashes behind a timelock. The vault is an isolated control
plane for upgrade preparation; it does not update target contracts directly.

## Authority and Trust Assumptions

- `initialize(admin)` requires `admin` authorization and can run once.
- Stored `ADMIN` sets timelock duration, queues upgrade hashes, executes ready
  proposals, and cancels queued proposals.
- The admin should be the governance executor or production multisig.

## Functions

| Function | Access | Notes |
| --- | --- | --- |
| `initialize(admin)` | Admin auth | Stores admin and default 48-hour timelock. |
| `set_timelock_duration(duration_seconds)` | Stored admin | Rejects zero duration. |
| `queue_upgrade(contract_address, new_wasm_hash)` | Stored admin | Stores one queued hash per target contract. |
| `execute_upgrade(contract_address)` | Stored admin | Requires elapsed timelock, removes proposal, and returns hash. |
| `cancel_upgrade(contract_address)` | Stored admin | Removes queued proposal before or after readiness. |
| `get_upgrade_proposal(contract_address)` | Public read | Returns queued proposal if present. |
| `is_upgrade_ready(contract_address)` | Public read | Checks whether current ledger timestamp has reached execution time. |
| `get_timelock_duration`, `get_admin` | Public read | Configuration views. |

## Audit Focus

- Timelock duration and timestamp math cannot overflow.
- Only the stored admin can queue, execute, cancel, or change duration.
- `execute_upgrade` cannot be used by an arbitrary caller to consume queued
  proposals.
- Operations emit enough data for monitoring.
