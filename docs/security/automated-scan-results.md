# Automated Smart Contract Scan Results

**Date:** 2026-04-25
**Branch:** `591-security-audit-prep`
**Scope:** Rust/Soroban contract workspace under `contracts/*`

## Commands Run

| Check | Command | Result |
| --- | --- | --- |
| Formatting | `rustfmt` via local Rust `1.89.0` toolchain over `contracts/**/*.rs` | Passed |
| Tests | `cargo test --workspace` | Passed: 220 passed, 0 failed, 10 ignored |
| Rust linting | `cargo clippy --workspace --all-targets` | Passed with non-blocking warnings in test code and existing mock/test layout |
| Dependency audit | `cargo-audit audit --no-fetch --stale` | Passed with 0 vulnerabilities and 2 allowed warnings |
| Soroban CLI lint/build | `stellar` CLI lookup | Not run: `stellar` CLI is not installed in this environment |

The standard `cargo fmt` and default Rustup stable toolchain path attempted to
sync the `stable` channel and failed in the sandbox. Formatting, tests, and
Clippy were run by pinning `RUSTUP_TOOLCHAIN=1.89.0-x86_64-unknown-linux-gnu`
and `RUSTC=/home/edoscoba/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin/rustc`.

## Dependency Audit Remediation

Initial `cargo-audit` output reported:

| Advisory | Crate | Prior version | Action |
| --- | --- | --- | --- |
| `RUSTSEC-2026-0009` | `time` | `0.3.41` | Updated to `0.3.47` |
| `RUSTSEC-2026-0097` | `rand` | `0.8.5`, `0.9.2` | Updated to `0.8.6`, `0.9.3` |
| `RUSTSEC-2026-0012` | `keccak` | `0.1.5` | Updated to `0.1.6` |

After lockfile remediation, `cargo-audit audit --no-fetch --stale` exited
successfully with no vulnerabilities.

Remaining allowed warnings:

| Advisory | Crate | Reason |
| --- | --- | --- |
| `RUSTSEC-2024-0388` | `derivative 2.2.0` | Unmaintained transitive dependency through `ark-*` crates used by Soroban host/test dependencies. |
| `RUSTSEC-2024-0436` | `paste 1.0.15` | Unmaintained transitive dependency through `soroban-wasmi` / `ark-*` crates. |

## Clippy Notes

Clippy completed successfully. Warnings were non-blocking and concentrated in
tests/mocks:

- Deprecated `Env::register_contract` in tests.
- Unused imports/variables in test-only modules.
- Duplicated `#[cfg(test)]` in included test files.
- Test helper style warnings such as `bool_assert_comparison`,
  `needless_borrows_for_generic_args`, and `too_many_arguments`.
- `items_after_test_module` in test-only conditional helper modules.

No production contract logic warning was identified as a blocker for audit
preparation.

## Manual Vulnerability Class Review

The implementation pass addressed these classes before final scans:

- **Unauthorized access:** added explicit admin authorization to all deployable
  `initialize` paths that previously accepted an admin without requiring that
  admin's signature.
- **Integer overflow/underflow:** added checked arithmetic for token supply,
  balances, delegation totals, proposal IDs, vote totals, donor/scholar counts,
  tranche accounting, timelock timestamps, and NFT token IDs.
- **Reentrancy/stale state:** reordered treasury/escrow disbursement and
  proposal execution paths so internal state is committed before external token
  transfers where stale state could otherwise matter.
- **Input bounds:** added milestone ID validation against registered course
  configuration and rejected non-positive LRN rewards in verification paths.

## Remaining Environment Gap

Soroban-specific CLI checks should be run in CI or by the audit firm with the
Stellar CLI installed, for example:

```bash
stellar contract build
```

If project-specific Soroban lint commands are introduced later, add them to this
file and CI so the scan record remains reproducible.
