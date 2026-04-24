# Contract Upgrade Procedure

This runbook describes how to upgrade LearnVault Soroban contracts safely, from
proposal to verification.

## When to Initiate an Upgrade

Start an upgrade only when at least one of these is true:

- Critical bug or vulnerability requires a patch.
- New protocol feature requires contract logic changes.
- Gas/performance improvements materially reduce operating cost.
- Governance-approved parameter/model changes cannot be done off-chain.
- Dependency/runtime changes require a rebuild for compatibility.

## Governance Proposal Flow

1. Draft a proposal containing:
   - Target contract(s)
   - Rationale and risk assessment
   - Link to reviewed code diff
   - Expected WASM hash(es)
   - Rollback plan
2. Post proposal to governance forum/channel for discussion period.
3. Submit proposal on-chain (or through governance process used by the DAO).
4. Keep proposal open for voting until quorum window closes.

## Timelock Vault Model

The timelock is the delay layer between successful governance vote and execution:

- Approved upgrades are queued with an execution timestamp.
- Execution before the delay window is blocked.
- Delay gives the community time to audit final payload/WASM hash.
- Emergency cancellation should remain available to governance/admin per policy.

For LearnVault, treat treasury and escrow upgrades as high-risk and require full
timelock delay unless emergency mode is explicitly invoked.

## Required Approvals and Quorum

Define and enforce these before execution:

- **Quorum**: minimum governance voting power participating.
- **Threshold**: percentage of cast votes required for approval.
- **Signer policy**: multisig requirement for final execution transaction.

Recommended production baseline:

- Quorum >= 20% of active voting power
- Approval threshold >= 60%
- Executor account guarded by multisig (for example, 2-of-3 or 3-of-5)

## Deploy New WASM

1. Build the contract artifact:

```bash
cargo build --target wasm32v1-none --release
```

2. Run full tests before installation:

```bash
cargo test --workspace
```

3. Install WASM to Soroban and capture returned hash:

```bash
stellar contract install \
  --network <testnet|mainnet> \
  --source <EXECUTOR_ALIAS> \
  --wasm target/wasm32v1-none/release/<contract>.wasm
```

4. Verify hash matches governance-approved payload.
5. Queue upgrade execution through governance timelock flow.

## Execute Upgrade

After timelock expires, invoke the contract upgrade:

```bash
stellar contract invoke \
  --network <testnet|mainnet> \
  --source <EXECUTOR_ALIAS> \
  --id <CONTRACT_ID> \
  -- \
  upgrade \
  --new_wasm_hash <WASM_HASH>
```

## Verify Upgrade Applied

Immediately validate:

1. Transaction status is `SUCCESS`.
2. Contract emits expected upgrade event(s), including hash reference.
3. Soroban system event `executable_update` exists for the transaction.
4. Read-only smoke checks succeed for key methods.
5. Cross-contract flows still pass integration tests.

Recommended post-upgrade checks:

- `cargo test --workspace`
- Backend integration tests touching upgraded contract paths
- Frontend critical-path smoke tests (enroll, milestone, governance, treasury)

## Emergency Upgrade Procedure

Use emergency mode only for severe incidents (active exploit, funds at risk,
protocol outage).

1. Trigger incident declaration and freeze high-risk operations if possible.
2. Use admin multisig to bypass timelock per emergency governance policy.
3. Install and execute the patched WASM immediately.
4. Publish incident note with:
   - Why bypass was required
   - Exact hash deployed
   - Time of execution
   - Follow-up remediation plan
5. Open a retroactive governance report and security postmortem.

## Rollback

If regression is detected:

1. Reinstall last known-good WASM (if needed).
2. Invoke `upgrade` with previous trusted hash.
3. Re-run verification and smoke tests.
4. Keep incident log updated until full recovery is confirmed.
