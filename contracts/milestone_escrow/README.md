# MilestoneEscrow Contract

Manages scholarship funds in proposal-specific escrow records and releases them
in tranches to scholars. Unspent funds can be reclaimed after inactivity.

## Authority and Trust Assumptions

- `initialize(admin, treasury, inactivity_window_seconds)` requires `admin`
  authorization and can run once.
- Configured `treasury` is the only authority that can create escrow records.
- Stored escrow `admin` releases tranches, reclaims inactive balances, and
  upgrades the contract.
- The XLM token client follows Soroban token transfer semantics and reverts
  failed transfers atomically.

## Functions

| Function | Access | Notes |
| --- | --- | --- |
| `initialize(admin, treasury, inactivity_window_seconds)` | Admin auth | Stores admin, treasury, and inactivity window. |
| `create_escrow(proposal_id, scholar, amount, tranches)` | Treasury auth | Creates a unique funded escrow with positive amount and non-zero tranches. |
| `release_tranche(proposal_id)` | Escrow admin | Releases the next tranche with checked accounting and final-tranche rounding. |
| `reclaim_inactive(proposal_id)` | Escrow admin | Returns unspent funds after inactivity window. |
| `get_escrow(proposal_id)` | Public read | Returns escrow record if present. |
| `upgrade(new_wasm_hash)` | Stored admin | Replaces current WASM through shared upgrade helper. |
| `get_version()` | Public read | Contract version. |

## Audit Focus

- Treasury-only escrow creation.
- Tranche math cannot overpay or overflow.
- State is updated before token transfers.
- Inactivity reclaim cannot withdraw before the configured window.
