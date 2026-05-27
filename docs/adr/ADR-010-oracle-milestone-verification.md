# ADR-010: Oracle-Based Milestone Verification

## Status

Accepted

## Context

Milestone approval is currently admin-driven. That works for early operations, but it
does not scale well for GitHub-based evidence where the platform can verify objective
facts such as whether a pull request was merged.

## Decision

LearnVault will support an oracle verifier for course milestones.

The oracle checks GitHub evidence off-chain, derives a deterministic evidence hash from
the merged pull request payload, and submits approval through `oracle_verify_milestone`.
The `course_milestone` contract stores the oracle address, records the evidence hash,
marks the milestone approved, and mints the configured reward.

Manual admin verification remains available only when `manual_fallback_enabled` is true.
This gives maintainers an emergency path if the oracle service is unavailable while still
allowing production deployments to require oracle-only verification.

## Protocol

1. Learner submits milestone evidence with a GitHub pull request URL.
2. Oracle fetches the pull request from the GitHub API.
3. Oracle verifies `merged === true`.
4. Oracle hashes the normalized payload: owner, repo, pull number, merged status, merge commit SHA, merged timestamp, and canonical URL.
5. Oracle signs and submits `oracle_verify_milestone(oracle, learner, course_id, milestone_id, reward, evidence_hash)`.
6. Contract requires oracle authorization, validates pending milestone state, records the evidence hash, approves the milestone, and mints LRN.

## Consequences

- Objective GitHub evidence can be approved without manual admin review.
- On-chain state stores a compact evidence commitment instead of full GitHub metadata.
- The oracle remains a trusted actor, but its decision is auditable against the public GitHub PR payload.
- Manual fallback can be disabled for stricter deployments.
