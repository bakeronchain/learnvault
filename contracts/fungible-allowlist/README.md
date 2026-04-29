# FungibleAllowlist Contract

Small admin-managed allowlist helper for fungible-token related access control.

## Authority and Trust Assumptions

- `initialize(admin)` requires `admin` authorization and can run once.
- Stored `Admin` can add/remove accounts and transfer admin authority.
- Enumeration is intentionally off-chain via events/indexers; `get_allowlist`
  returns an empty vector.

## Functions

| Function | Access | Notes |
| --- | --- | --- |
| `initialize(admin)` | Admin auth | Stores initial admin. |
| `add_to_allowlist(admin, account)` | Stored admin | Marks account allowed. |
| `remove_from_allowlist(admin, account)` | Stored admin | Marks account not allowed. |
| `set_admin(admin, new_admin)` | Stored admin | Transfers admin authority. |
| `is_allowed(account)` | Public read | Returns current account flag. |
| `get_allowlist()` | Public read | Returns empty vector; use off-chain event indexing for enumeration. |

## Audit Focus

- Initialization and admin rotation cannot be hijacked.
- Only stored admin can mutate account flags.
- Integrators understand that on-chain enumeration is not implemented.
