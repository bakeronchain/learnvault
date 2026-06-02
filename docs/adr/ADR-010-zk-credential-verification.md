# ADR-010: ZK Credential Verification for V3

**Status**: Proposed **Date**: 2026-05-27

## Context

Issue `#756` requires LearnVault V3 to support private credential assertions:

- A learner can prove course completion without revealing full wallet history.
- A learner can prove a reputation threshold is met (`>= N`) without exposing exact score.
- Verification must include replay protection and be practical for Stellar-integrated flows.

## Research: Candidate Libraries

### Option A: `snarkjs` + Circom (recommended for initial rollout)

- Mature JS tooling and good developer ergonomics.
- Easy to prototype from backend and client without Rust toolchain changes.
- Strong ecosystem support for Groth16.
- Trade-off: verification artifact management and proving key ceremony overhead.

### Option B: Halo2-based stack (Rust-first)

- Better long-term for native Rust verifier paths.
- Strong cryptographic flexibility.
- Trade-off: slower onboarding for frontend/backend teams and longer time-to-first proof.

### Option C: Noir (`nargo`) + Barretenberg

- Productive circuit language and modern DX.
- Good proving performance in some scenarios.
- Trade-off: integration complexity with existing TypeScript-heavy services.

## Decision

Adopt a phased approach:

1. **Phase 1 (this PR)**: ship a prototype verification API with proof-integrity and nullifier checks so app integration can proceed.
2. **Phase 2**: replace prototype verifier with Groth16 verifier (`snarkjs`) and fixed public signal schema.
3. **Phase 3**: add on-chain verification path where cost is acceptable; otherwise keep verification off-chain and anchor attestations on-chain.

## Claims Covered

The initial claim schema supports:

- `credentialHash`: hash commitment to completion credential.
- `thresholdMet`: `0|1` flag for threshold proof.
- `nullifierHash`: anti-replay identity nullifier for one-time proof usage.

## Verification Cost Estimate

- **Off-chain verification**: low/acceptable for API latency targets.
- **On-chain verification (Soroban custom verifier)**: expected to be expensive in instruction budget and should be limited to high-value flows.
- **Recommended**: verify off-chain, persist attestation hash, optionally checkpoint on-chain.

## Consequences

- Unblocks frontend/backend integration while cryptography stack is finalized.
- Introduces an explicit migration path to production-grade zk verification.
- Keeps claim schema stable so future verifier swap is implementation-only.
