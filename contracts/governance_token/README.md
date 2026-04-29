# GovernanceToken Contract

Transferable GOV token used for proposal voting and delegated voting power.

## Authority and Trust Assumptions

- `initialize(admin)` requires `admin` authorization and can run once.
- Stored `ADMIN` can mint, burn for administration, pause/unpause, transfer admin
  authority, and upgrade the contract.
- Production `ADMIN` should be the treasury/governance controller or a multisig
  following the documented operations runbook.

## Functions

| Function | Access | Notes |
| --- | --- | --- |
| `initialize(admin)` | Admin auth | Sets token metadata, admin, decimals, and upgrade hash tracking. |
| `mint(to, amount)` | Stored admin | Rejects non-positive amount and uses checked balance/supply/delegation math. |
| `burn(from, amount)` | `from` auth | Burns caller balance and reduces supply. |
| `admin_burn_from(from, amount)` | Stored admin | Administrative burn/slashing path. |
| `set_admin(new_admin)` | Stored admin | Transfers admin authority. |
| `upgrade(new_wasm_hash)` | Stored admin | Replaces current WASM through shared upgrade helper. |
| `pause(admin)`, `unpause(admin)` | Stored admin | Toggles mutating token operations. |
| `transfer(from, to, amount)` | `from` auth | Checked debit/credit transfer. |
| `approve(owner, spender, amount, expiration_ledger)` | `owner` auth | Allows zero to clear allowance; rejects negative amount and past expiration. |
| `transfer_from(spender, from, to, amount)` | `spender` auth | Checks allowance, expiration, pause state, and balances. |
| `delegate(delegator, delegatee)` | `delegator` auth | Moves voting power to delegatee. Self-delegation removes delegation. |
| `undelegate(delegator)` | `delegator` auth | Removes delegation and restores direct voting power. |
| `get_delegate`, `get_voting_power` | Public read | Reads delegation state and effective voting power. |
| `balance`, `allowance`, `total_supply` | Public read | Token accounting views. |
| `decimals`, `name`, `symbol`, `get_version`, `is_paused` | Public read | Metadata, version, and pause state. |

## Audit Focus

- Delegated amount invariants during mint, burn, transfer, delegate, and
  undelegate.
- Pause coverage across mutating token paths.
- Allowance expiration and negative amount rejection.
- Supply and voting power overflow/underflow protection.
