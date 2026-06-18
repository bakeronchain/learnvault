# FungibleAllowlist Contract

## Purpose and Role

`fungible-allowlist` is a small admin-managed helper contract that stores
whether an address is allowed to participate in token-gated flows. It is meant
to be composed by other contracts rather than hold assets itself.

## Key Functions

| Function | Parameters | Access | Description |
| --- | --- | --- | --- |
| `initialize` | `admin` | `admin` auth | Stores the initial administrator. |
| `add_to_allowlist` | `admin`, `account` | stored admin | Marks an account as allowed. |
| `remove_from_allowlist` | `admin`, `account` | stored admin | Marks an account as not allowed. |
| `set_admin` | `admin`, `new_admin` | stored admin | Rotates admin control. |
| `is_allowed` | `account` | public read | Returns the stored allowlist flag. |
| `get_allowlist` | none | public read | Returns an empty vector; enumeration is intentionally left off-chain. |

## Authorization Model

- `initialize` requires the provided admin address to authorize once.
- Only the stored admin may add, remove, or rotate allowlisted access.
- Read methods are public.

## State Variables

| Storage Key | Meaning |
| --- | --- |
| `Admin` | Current administrator address. |
| `IsAllowed(account)` | Boolean allowlist flag for an account. |

## Events Emitted

- This contract does not emit custom Soroban events today.
- Integrators should rely on transaction history or add event coverage in a
  future revision if indexed change feeds are required.

## Deploy with Stellar CLI

From the repository root:

```bash
stellar contract build --package fungible-allowlist
stellar contract deploy \
  --wasm target/wasm32v1-none/release/fungible_allowlist.wasm \
  --source <IDENTITY> \
  --network <NETWORK>
```

Initialize after deploy by invoking `initialize(admin)`.

## Run Tests

From the repository root:

```bash
cargo test -p fungible-allowlist
```
