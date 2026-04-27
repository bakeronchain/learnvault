# Contract Access Control Audit

Issue: `#724`

## Scope

This review covers contract entrypoints under `contracts/**/src/lib.rs` and their corresponding tests.

## Access Control Matrix

### `contracts/course_milestone/src/lib.rs`

- `initialize(admin, ...)`: admin must authorize (`admin.require_auth()`).
- `add_course(admin, ...)`: stored admin only (`require_admin`).
- `remove_course(admin, ...)`: stored admin only (`require_admin`).
- `set_milestone_reward(...)`: stored admin only (`require_stored_admin_auth`).
- `pause(admin)`: stored admin only (`admin.require_auth()` + equality check).
- `unpause(admin)`: stored admin only (`admin.require_auth()` + equality check).
- `complete_milestone(...)`: stored admin only (`require_stored_admin_auth`).
- `verify_milestone(admin, ...)`: stored admin only (`admin.require_auth()` + equality check).
- `batch_verify_milestones(admin, ...)`: stored admin only (`admin.require_auth()` + equality check).
- `reject_milestone(admin, ...)`: stored admin only (`admin.require_auth()` + equality check).
- `upgrade(...)`: stored admin only.

### `contracts/scholarship_treasury/src/lib.rs`

- `initialize(admin, ...)`: admin must authorize (`admin.require_auth()`).
- `set_quorum(...)`: stored admin only (`Self::admin(&env).require_auth()`).
- `set_approval_bps(...)`: stored admin only (`Self::admin(&env).require_auth()`).
- `set_min_lrn_to_propose(admin, ...)`: stored admin only (`admin.require_auth()` + equality check).
- `pause()`: stored admin only (`Self::admin(&env).require_auth()`).
- `unpause()`: stored admin only (`Self::admin(&env).require_auth()`).
- `cancel_proposal(...)`: stored admin only (`Self::admin(&env).require_auth()`).
- `finalize_proposal(admin, ...)`: stored admin only (`admin.require_auth()` + equality check).
- `upgrade(...)`: stored admin only.
- `disburse(...)`: governance contract auth (not admin): `governance.require_auth()`.

### `contracts/scholar_nft/src/lib.rs`

- `initialize(admin)`: admin must authorize.
- `mint(...)`: stored admin only.
- `revoke(...)`: stored admin only.
- `transfer_admin(...)`: stored admin only.
- `upgrade(...)`: stored admin only.

### `contracts/milestone_escrow/src/lib.rs`

- `initialize(admin, ...)`: admin must authorize.
- `create_escrow(...)`: stored treasury contract only (`treasury.require_auth()`).
- `release_tranche(...)`: escrow admin only (`record.admin.require_auth()`).
- `reclaim_inactive(...)`: escrow admin only (`record.admin.require_auth()`).
- `upgrade(...)`: stored admin only.

### `contracts/learn_token/src/lib.rs`

- `initialize(admin)`: **missing `admin.require_auth()` check (high risk)**.
- `mint(...)`: stored admin only.
- `set_admin(...)`: stored admin only.
- `upgrade(...)`: stored admin only.

### `contracts/governance_token/src/lib.rs`

- `initialize(admin)`: **missing `admin.require_auth()` check (high risk)**.
- `mint(...)`: stored admin only.
- `admin_burn_from(...)`: stored admin only.
- `set_admin(...)`: stored admin only.
- `pause(admin)`: stored admin only (`admin.require_auth()` + equality check).
- `unpause(admin)`: stored admin only (`admin.require_auth()` + equality check).
- `upgrade(...)`: stored admin only.

### `contracts/upgrade_timelock_vault/src/lib.rs`

- `initialize(admin)`: **missing `admin.require_auth()` check (high risk)**.
- `set_timelock_duration(...)`: stored admin only.
- `queue_upgrade(...)`: stored admin only.
- `cancel_upgrade(...)`: stored admin only.
- `execute_upgrade(...)`: no caller auth (public execution after timelock).

### `contracts/fungible-allowlist/src/lib.rs`

- `initialize(admin)`: **missing `admin.require_auth()` check (high risk)**.
- `add_to_allowlist(...)`: stored admin only (`admin.require_auth()` + equality check).
- `remove_from_allowlist(...)`: stored admin only (`admin.require_auth()` + equality check).
- `set_admin(...)`: stored admin only (`admin.require_auth()` + equality check).

## Non-Admin Rejection Test Coverage

### Added in this issue

- `contracts/scholarship_treasury/src/test.rs`
  - `pause_only_admin_can_call`
  - `unpause_only_admin_can_call`
  - `set_quorum_only_admin_can_call`
  - `set_approval_bps_only_admin_can_call`
  - `set_min_lrn_to_propose_fails_for_non_admin`
  - `finalize_proposal_fails_for_non_admin`
  - `cancel_proposal_only_admin_can_call`

### Remaining gaps to complete full repo parity

- `course_milestone`: add explicit non-admin rejection tests for all admin mutation paths.
- `milestone_escrow`: add unauthorized caller rejection test for `create_escrow`.
- `governance_token`: add non-admin rejection tests for `admin_burn_from` and `set_admin`.
- `upgrade_timelock_vault`: add non-admin rejection tests for `queue_upgrade` and `cancel_upgrade`.
- `fungible-allowlist`: add non-admin rejection tests for allowlist mutation and `set_admin`.

## Privilege Escalation Review

### High Risk

- Missing auth guard in `initialize` for:
  - `contracts/learn_token/src/lib.rs`
  - `contracts/governance_token/src/lib.rs`
  - `contracts/upgrade_timelock_vault/src/lib.rs`
  - `contracts/fungible-allowlist/src/lib.rs`
- Impact: first caller can potentially initialize contract and seize admin role.

### Medium Risk

- `contracts/upgrade_timelock_vault/src/lib.rs`: `execute_upgrade` is intentionally public after timelock, but can be front-run/griefed operationally by third parties.

### Additional Note

- `contracts/governance_token/src/lib.rs`: `transfer_from` should be reviewed for pause enforcement consistency relative to `transfer`, `mint`, and `burn`.
