# Third-Party Audit Firm Checklist

## Before Kickoff

- Provide repository commit hash and branch under review.
- Provide deployed contract IDs, network, and WASM hashes if already deployed.
- Provide threat model, audit scope, and admin authority map.
- Provide architecture and contract interaction docs.
- Provide build, test, and scanner command results.
- Provide known issues, accepted risks, and intended launch timeline.

## Contract Review Checklist

- Confirm all initialization paths require intended admin authorization.
- Confirm every privileged function authenticates the correct stored authority.
- Confirm admin transfer cannot be hijacked, renounced accidentally, or pointed
  to an unintended address without authorization.
- Confirm token accounting uses checked arithmetic for balances, supply,
  allowances, votes, counters, tranche state, and proposal IDs.
- Confirm zero, negative, expired, duplicate, out-of-range, and already-finalized
  inputs are rejected consistently.
- Confirm cross-contract token calls cannot observe exploitable stale state.
- Confirm pause behavior covers all intended mutating paths.
- Confirm upgrade functions preserve storage compatibility and only accept
  authorized WASM replacement.
- Confirm events are sufficient for off-chain monitoring and incident response.
- Confirm read methods cannot panic unexpectedly on missing optional state.

## Contract-Specific Focus

- `LearnToken`: soulbound enforcement, mint authority, total supply accounting.
- `GovernanceToken`: transfer/allowance semantics, delegation invariants,
  voting power, pause coverage.
- `CourseMilestone`: course registry bounds, milestone verification authority,
  duplicate completion prevention.
- `ScholarshipTreasury`: deposits, proposal voting, quorum/approval math,
  disbursement custody, cancellation/finalization.
- `MilestoneEscrow`: escrow creation authority, tranche math, inactivity
  reclaim, final-tranche rounding.
- `ScholarNFT`: soulbound credential semantics, revocation, token ID overflow,
  admin transfer.
- `UpgradeTimelockVault`: timelock enforcement, queue/execute/cancel authority,
  timestamp overflow.
- `FungibleAllowlist`: initialization, admin rotation, allowlist state changes.

## Output Requested

- Executive summary with launch readiness recommendation.
- Finding table with severity, affected files/functions, exploitability, impact,
  and remediation.
- Verification notes for remediated findings.
- Residual risks and recommended follow-up work.
- Final reviewed commit hash and audit date.
