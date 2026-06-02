# UpgradeTimelockVault Contract

## Purpose and Role

`upgrade_timelock_vault` queues contract upgrade hashes behind a mandatory
timelock. It separates upgrade scheduling from the target contracts so teams can
review queued upgrades before execution.

## Key Functions

| Function | Parameters | Access | Description |
| --- | --- | --- | --- |
| `initialize` | `admin` | `admin` auth | Sets the admin and default timelock duration. |
| `set_timelock_duration` | `duration_seconds` | stored admin | Changes the timelock duration. |
| `get_timelock_duration` | none | public read | Returns the configured timelock duration. |
| `queue_upgrade` | `contract_address`, `new_wasm_hash` | stored admin | Stores a queued upgrade for a target contract. |
| `execute_upgrade` | `contract_address` | stored admin | Returns the queued WASM hash once the timelock has elapsed. |
| `cancel_upgrade` | `contract_address` | stored admin | Removes a queued upgrade proposal. |
| `get_upgrade_proposal` | `contract_address` | public read | Returns the proposal details for a target contract. |
| `is_upgrade_ready` | `contract_address` | public read | Returns whether the proposal can be executed yet. |
| `get_admin` | none | public read | Returns the configured admin address. |

## Authorization Model

- `initialize` requires the provided admin address to authorize once.
- Stored admin is the only actor allowed to change the timelock or manage queued
  upgrades.
- Read methods are public.

## State Variables

| Storage Key | Meaning |
| --- | --- |
| `CONFIG` | Contract-wide configuration holding `admin` and `timelock_duration`. |
| `UpgradeProposal(contract_address)` | Queued upgrade hash, queue time, and queueing admin for a target contract. |

## Events Emitted

- `upgrade_queued` with `UpgradeQueued { contract_address, new_wasm_hash, queued_at, admin }`
- `upgrade_executed` with `UpgradeExecuted { contract_address, new_wasm_hash, executed_at }`
- `upgrade_cancelled` with `UpgradeCancelled { contract_address, new_wasm_hash, cancelled_at }`

## Deploy with Stellar CLI

From the repository root:

```bash
stellar contract build --package upgrade-timelock-vault
stellar contract deploy \
  --wasm target/wasm32v1-none/release/upgrade_timelock_vault.wasm \
  --source <IDENTITY> \
  --network <NETWORK>
```

Initialize after deploy by invoking `initialize(admin)`.

## Run Tests

From the repository root:

```bash
cargo test -p upgrade-timelock-vault
```
