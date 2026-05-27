# GovernanceToken Contract

## Purpose and Role

`governance_token` mints and manages the transferable GOV token used for voting
power in LearnVault governance. It supports balances, allowances, transfers, and
delegated voting.

## Key Functions

| Function | Parameters | Access | Description |
| --- | --- | --- | --- |
| `initialize` | `admin` | `admin` auth | Sets metadata, admin, decimals, and upgrade tracking. |
| `mint` | `to`, `amount` | stored admin | Mints GOV and updates delegated voting power if needed. |
| `burn` | `from`, `amount` | `from` auth | Burns a holder's own tokens. |
| `admin_burn_from` | `from`, `amount` | stored admin | Administrative burn path. |
| `set_admin` | `new_admin` | stored admin | Transfers admin control. |
| `pause` / `unpause` | `admin` | stored admin | Pauses or resumes state-mutating token actions. |
| `transfer` | `from`, `to`, `amount` | `from` auth | Moves tokens between accounts. |
| `approve` | `owner`, `spender`, `amount`, `expiration_ledger` | `owner` auth | Sets allowance with optional expiry. |
| `transfer_from` | `spender`, `from`, `to`, `amount` | `spender` auth | Uses allowance to transfer on behalf of the owner. |
| `delegate` | `delegator`, `delegatee` | `delegator` auth | Assigns voting power to another address. |
| `undelegate` | `delegator` | `delegator` auth | Removes an existing delegation. |
| `get_delegate`, `get_voting_power`, `balance`, `allowance`, `total_supply`, `decimals`, `name`, `symbol`, `is_paused`, `get_version` | query args only | public read | Token, delegation, and metadata views. |
| `upgrade` | `new_wasm_hash` | stored admin | Upgrades the contract WASM through the shared helper. |

## Authorization Model

- `initialize` requires the provided admin address to authorize once.
- Stored admin can mint, admin-burn, pause, unpause, rotate admin, and upgrade.
- Token holders authorize `burn`, `transfer`, `approve`, `delegate`, and
  `undelegate`.
- Approved spenders authorize `transfer_from`.
- Read methods are public.

## State Variables

| Storage Key | Meaning |
| --- | --- |
| `ADMIN` | Current administrator address. |
| `NAME`, `SYMBOL`, `DECIMALS` | Token metadata. |
| `PAUSED` | Global pause flag. |
| `Balance(account)` | GOV balance for an account. |
| `Allowance(owner, spender)` | Current approved allowance. |
| `TotalSupply` | Total minted minus burned GOV. |
| `Delegate(account)` | Delegation target for an account, if any. |
| `DelegatedAmount(account)` | Voting power delegated to that address by others. |
| `WASMHASH` | Last tracked managed upgrade hash from the shared helper. |

## Events Emitted

- `GOVMinted { to, amount }`
- `GOVBurned { from, amount }`
- `GOVTransferred { from, to, amount }`
- `GOVApproved { owner, spender, amount }`
- `GOVPaused { admin }`
- `GOVUnpaused { admin }`
- `contract_upgraded` from the shared upgrade helper

## Deploy with Stellar CLI

From the repository root:

```bash
stellar contract build --package governance-token
stellar contract deploy \
  --wasm target/wasm32v1-none/release/governance_token.wasm \
  --source <IDENTITY> \
  --network <NETWORK>
```

Initialize after deploy by invoking `initialize(admin)`.

## Run Tests

From the repository root:

```bash
cargo test -p governance-token
```
