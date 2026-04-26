# Contract Upgrades

## Scope

The six V1 core contracts are upgradeable in place via Soroban WASM replacement:

- `LearnToken`
- `GovernanceToken`
- `CourseMilestone`
- `ScholarshipTreasury`
- `MilestoneEscrow`
- `ScholarNFT`

Each contract exposes:

```rust
upgrade(new_wasm_hash: BytesN<32>)
```

The function calls Soroban's `update_current_contract_wasm(...)` host function
after authenticating the stored contract admin.

## V1 Upgrade Authority

In V1, the `admin` stored in each contract must be the founding team's Soroban
multi-sig or custom account contract.

That matters because the contracts use `require_auth()` on the stored admin
address. Soroban resolves that authorization through the admin account itself,
so the effective signer policy is whatever N-of-M rule the multi-sig account
enforces.

## V2 Upgrade Authority

In V2, upgrade authority should be transferred from the founding-team multi-sig
to a governance-controlled address or controller contract after the DAO upgrade
flow is live.

## Upgrade Event Model

Each successful upgrade emits:

- A contract event: `ContractUpgraded { old_hash, new_hash, upgraded_by }`
- Soroban's native system event: `executable_update`

Important caveat:

- Soroban contract code cannot directly read its currently installed executable
  hash.
- Because of that limitation, the contract event tracks the last managed upgrade
  hash in contract storage.
- On the first managed upgrade, `old_hash` is the all-zero sentinel value.
- The transaction's native `executable_update` system event remains the
  canonical source for the exact pre-upgrade and post-upgrade executable refs.

## Safe Upgrade Procedure

1. Build the new WASM for the target contract.
2. Verify the diff, tests, and expected storage compatibility.
3. Upload the new WASM to Soroban and record the returned hash.
4. Prepare a transaction that calls `upgrade(new_wasm_hash)` on the target
   contract.
5. Collect the required signatures from the founding-team multi-sig.
6. Submit the transaction.
7. Verify the transaction emitted both `ContractUpgraded` and
   `executable_update`.
8. Run post-upgrade smoke checks against the contract's read methods and any
   affected cross-contract flows.

## Example CLI Flow

The exact command flags vary by environment, but the operational sequence is:

```bash
# 1. Build optimized contract wasm
stellar contract build

# 2. Upload new wasm and capture the returned hash
stellar contract install \
  --network testnet \
  --source <MULTISIG_OR_SIGNER_ALIAS> \
  --wasm target/wasm32v1-none/release/<contract>.wasm

# 3. Invoke the in-place upgrade on the deployed contract
stellar contract invoke \
  --network testnet \
  --source <MULTISIG_OR_SIGNER_ALIAS> \
  --id <DEPLOYED_CONTRACT_ID> \
  -- \
  upgrade \
  --new_wasm_hash <WASM_HASH>
```

## Storage Compatibility Rules

Upgrades do not redeploy or migrate state automatically. The replacement WASM
continues using the same contract instance and persistent storage.

Before executing an upgrade:

- Do not rename or reinterpret existing storage keys unless the new code
  includes an explicit migration path.
- Preserve the meaning and encoding of stored contract types.
- Keep cross-contract interfaces stable unless all dependent contracts and
  clients are upgraded in lockstep.
- Re-run state-persistence tests for any contract whose storage schema changes.

## Rollback Strategy

Soroban upgrades are another WASM replacement. If a bad release is detected:

1. Rebuild or retrieve the last known-good WASM.
2. Upload it again if needed.
3. Execute `upgrade(previous_wasm_hash)` through the same multi-sig flow.

## Operational Notes

- `LearnToken` and `GovernanceToken` upgrades must be coordinated with the
  contracts that call them.
- `ScholarshipTreasury` and `MilestoneEscrow` upgrades are higher risk because
  they custody funds and proposal state.
- For production upgrades, treat `cargo test --workspace` and targeted
  end-to-end validation as mandatory gates, not optional checks.
