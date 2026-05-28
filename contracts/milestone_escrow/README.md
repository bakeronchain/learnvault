# MilestoneEscrow Contract

## Purpose and Role

`milestone_escrow` holds scholarship funds per proposal and releases them in
tranches to the scholar. It also lets an admin reclaim unspent funds after a
configured inactivity window.

## Key Functions

| Function | Parameters | Access | Description |
| --- | --- | --- | --- |
| `initialize` | `admin`, `treasury`, `inactivity_window_seconds` | `admin` auth | Stores the escrow admin, authorized treasury, and reclaim window. |
| `create_escrow` | `proposal_id`, `scholar`, `amount`, `tranches` | configured treasury | Creates and funds a new escrow record for a proposal. |
| `release_tranche` | `proposal_id` | stored escrow admin | Releases the next tranche to the scholar. |
| `reclaim_inactive` | `proposal_id` | stored escrow admin | Returns remaining funds to treasury after inactivity. |
| `get_escrow` | `proposal_id` | public read | Returns escrow details for a proposal. |
| `get_version` | none | public read | Returns the contract version string. |
| `upgrade` | `new_wasm_hash` | stored escrow admin | Upgrades the contract WASM through the shared helper. |

## Authorization Model

- `initialize` requires the provided admin address to authorize once.
- Only the configured `treasury` address can create new escrow records.
- The stored escrow admin can release tranches, reclaim inactive funds, and
  upgrade the contract.
- Read methods are public.

## State Variables

| Storage Key | Meaning |
| --- | --- |
| `CONFIG` | Contract-wide `Config { admin, treasury, inactivity_window }`. |
| `Escrow(proposal_id)` | `EscrowRecord` with scholar, amount, tranche progress, last activity, treasury, and admin. |
| `WASMHASH` | Last tracked managed upgrade hash from the shared helper. |

## Events Emitted

- `EscrowCreated { proposal_id, scholar, total_amount, total_tranches }`
- `released` topic with `TrancheReleased { scholar, proposal_id, amount }`
- `EscrowReclaimed { proposal_id, scholar, amount_reclaimed }`
- `contract_upgraded` from the shared upgrade helper

## Deploy with Stellar CLI

From the repository root:

```bash
stellar contract build --package milestone-escrow
stellar contract deploy \
  --wasm target/wasm32v1-none/release/milestone_escrow.wasm \
  --source <IDENTITY> \
  --network <NETWORK>
```

Initialize after deploy by invoking
`initialize(admin, treasury, inactivity_window_seconds)`.

## Run Tests

From the repository root:

```bash
cargo test -p milestone-escrow
```
