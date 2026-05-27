# Stellar Admin Governance

## Feasibility Assessment

Soroban multi-signature admin control is feasible for LearnVault without
rewriting every contract entrypoint.

The current contracts store the admin as a Soroban `Address` and authorize
critical actions with `require_auth()` on that address. Because a Soroban
`Address` can be either a Stellar account or a contract account, the same
authorization path can be upgraded to a multi-sig contract account by setting
the stored admin address to a governance contract address.

That means the main migration work is operational and deployment-focused:

- deploy a Soroban contract account for admin authorization
- transfer contract admin ownership from the current G-account to that C-account
- update clients and runbooks to build and submit auth entries for the account
  contract

## Recommended Roles And Thresholds

Use a single contract-account admin with policy checks for these roles:

- `ops_signer`: routine milestone approvals and low-risk admin actions
- `treasury_signer`: fund movement and disbursement actions
- `upgrade_signer`: contract upgrade actions
- `break_glass_signer`: emergency pause or recovery path

Recommended thresholds:

- milestone approval and routine maintenance: `2-of-3`
- minting and treasury disbursement: `2-of-3`
- admin transfer and contract upgrade: `3-of-5`
- break-glass emergency recovery: `3-of-5` with dedicated cold signer inclusion

## Contract Impact

No contract storage type change is required if the admin remains a Soroban
`Address`.

Contracts already following this pattern are multi-sig compatible:

- `contracts/learn_token/src/lib.rs`
- `contracts/course_milestone/src/lib.rs`
- `contracts/scholarship_treasury/src/lib.rs`
- `contracts/milestone_escrow/src/lib.rs`
- `contracts/upgrade_timelock_vault/src/lib.rs`

The production rollout should verify each admin-only function after the admin
address is switched to the contract account.

## Production Key Management

- Keep signer keys in separate custody domains.
- Use hardware-backed signing for `upgrade_signer` and `break_glass_signer`.
- Never reuse CI/CD secrets as human operator keys.
- Rotate signer assignments on a fixed calendar and after personnel changes.
- Require written approval for threshold or signer-set changes.
- Forward `admin_operation_audit_log` entries to centralized monitoring.
