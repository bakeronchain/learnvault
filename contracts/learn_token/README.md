# LearnToken Contract

Soulbound SEP-41 style LRN reputation token minted to learners after verified
course milestones.

## Authority and Trust Assumptions

- `initialize(admin)` requires `admin` authorization and can run once.
- Stored `ADMIN` can mint, transfer admin authority, and upgrade the contract.
- Production `ADMIN` should be the `CourseMilestone` controller or a multisig
  that only mints from verified milestone flows.

## Functions

| Function | Access | Notes |
| --- | --- | --- |
| `initialize(admin)` | Admin auth | Sets token metadata, admin, decimals, and upgrade hash tracking. |
| `mint(to, amount)` | Stored admin | Rejects non-positive amount and uses checked balance/supply arithmetic. |
| `set_admin(new_admin)` | Stored admin | Transfers admin authority. |
| `upgrade(new_wasm_hash)` | Stored admin | Replaces current WASM through shared upgrade helper. |
| `transfer`, `transfer_from`, `approve` | Always rejected | Enforces soulbound behavior. |
| `allowance` | Public read | Always returns `0`. |
| `balance(account)` | Public read | Returns account LRN balance. |
| `total_supply()` | Public read | Returns total minted LRN. |
| `decimals`, `name`, `symbol`, `get_version` | Public read | Token metadata and version. |
| `reputation_score(account)` | Public read | Integer `balance / 100` score. |

## Audit Focus

- Admin-only minting cannot be bypassed.
- Soulbound methods always revert.
- Balance and total supply cannot overflow.
- Upgrade authority matches production key-management policy.
