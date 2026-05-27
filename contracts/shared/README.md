# Shared Upgrade Helper Crate

## Purpose and Role

`shared` is a reusable Rust crate, not a deployable Soroban contract. It
provides the common upgrade helper used by multiple LearnVault contracts to
track and emit upgrade metadata consistently.

## Key Functions

| Function | Parameters | Access | Description |
| --- | --- | --- | --- |
| `upgrade::init` | `env` | callable by host contract code | Seeds the tracked managed WASM hash with a zero hash during contract initialization. |
| `upgrade::apply` | `env`, `admin`, `new_wasm_hash` | caller must enforce admin auth | Updates the current contract WASM and emits a structured upgrade event. |
| `upgrade::current_hash` | `env` | internal/helper read | Returns the last tracked managed WASM hash. |
| `upgrade::testutils::upload_upgrade_target` | `env` | test-only helper | Uploads the bundled fixture WASM for upgrade tests. |

## Authorization Model

- The crate does not perform its own access control.
- Each consuming contract must authenticate and authorize its admin before
  calling `upgrade::apply`.
- `testutils` is only compiled for tests or when the `testutils` feature is
  enabled.

## State Variables

| Storage Key | Meaning |
| --- | --- |
| `WASMHASH` | The last managed WASM hash tracked by the helper for upgrade events. |

## Events Emitted

- `contract_upgraded` with `ContractUpgraded { old_hash, new_hash, upgraded_by }`

## Deploy with Stellar CLI

This crate is linked into deployable contracts and is not deployed by itself.
To use it, deploy one of the contracts that depends on `learnvault-shared`, such
as `learn_token`, `governance_token`, or `scholarship_treasury`.

## Run Tests

This crate is exercised through consumer contract tests and upgrade test
helpers. From the repository root you can run:

```bash
cargo test -p learnvault-shared --features testutils
```
