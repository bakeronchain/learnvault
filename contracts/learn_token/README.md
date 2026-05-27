# LearnToken Contract

## Purpose and Role

`learn_token` implements the soulbound LRN token. It represents learner
reputation earned from verified milestones and intentionally cannot be traded or
approved for transfer.

## Key Functions

| Function | Parameters | Access | Description |
| --- | --- | --- | --- |
| `initialize` | `admin` | `admin` auth | Sets token metadata, admin, decimals, and upgrade tracking. |
| `mint` | `to`, `amount` | stored admin | Mints LRN for a learner after verified progress. |
| `set_admin` | `new_admin` | stored admin | Transfers admin control. |
| `transfer`, `transfer_from`, `approve` | token args | always rejects | Reverts because LRN is soulbound. |
| `allowance` | `from`, `spender` | public read | Always returns `0`. |
| `balance` | `account` | public read | Returns a learner balance. |
| `total_supply` | none | public read | Returns minted LRN supply. |
| `reputation_score` | `account` | public read | Returns `balance / 100`. |
| `decimals`, `name`, `symbol`, `get_version` | none | public read | Metadata and version helpers. |
| `upgrade` | `new_wasm_hash` | stored admin | Upgrades the contract WASM through the shared helper. |

## Authorization Model

- `initialize` requires the provided admin address to authorize once.
- Stored admin can mint, rotate admin, and upgrade.
- No holder can transfer, approve, or delegate LRN because the token is
  soulbound.
- Read methods are public.

## State Variables

| Storage Key | Meaning |
| --- | --- |
| `ADMIN` | Current administrator address. |
| `NAME`, `SYMBOL`, `DECIMALS` | Token metadata. |
| `Balance(account)` | LRN balance for an account. |
| `TotalSupply` | Total minted LRN. |
| `WASMHASH` | Last tracked managed upgrade hash from the shared helper. |

## Events Emitted

- `lrn_mint` with topic data `(to)` and payload `amount`
- `set_admin` with payload `new_admin`
- `contract_upgraded` from the shared upgrade helper

## Deploy with Stellar CLI

From the repository root:

```bash
stellar contract build --package learn-token
stellar contract deploy \
  --wasm target/wasm32v1-none/release/learn_token.wasm \
  --source <IDENTITY> \
  --network <NETWORK>
```

Initialize after deploy by invoking `initialize(admin)`.

## Run Tests

From the repository root:

```bash
cargo test -p learn-token
```
