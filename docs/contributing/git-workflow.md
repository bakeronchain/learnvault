# Git Workflow

This document describes the branching model, commit conventions, PR process, and release strategy used across the LearnVault monorepo.

---

## 1. Branch naming conventions

All branches must be created from an up-to-date `main`.

```
<type>/<short-description>
```

| Type | When to use | Example |
|------|-------------|---------|
| `feat/` | New user-facing feature | `feat/batch-verify-milestones` |
| `fix/` | Bug fix | `fix/proposal-status-quorum` |
| `docs/` | Documentation only | `docs/contributing-guide` |
| `refactor/` | Code restructure, no behaviour change | `refactor/extract-checked-math` |
| `test/` | Adding or updating tests | `test/governance-e2e` |
| `chore/` | Tooling, deps, CI, config | `chore/bump-soroban-sdk-23` |
| `security/` | Security-related fix or hardening | `security/input-validation-treasury` |
| `release/` | Release preparation | `release/v1.2.0` |

**Rules**
- Use lowercase and hyphens — no underscores, no spaces.
- Keep descriptions short (3–5 words).
- Include the issue number when one exists: `fix/591-security-audit-prep`.

---

## 2. Commit message format (Conventional Commits)

LearnVault follows [Conventional Commits v1.0](https://www.conventionalcommits.org/).

```
<type>(<scope>): <short summary>

[optional body — wrap at 72 chars]

[optional footer(s): BREAKING CHANGE, Fixes #NNN, Co-authored-by: …]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature (triggers minor version bump) |
| `fix` | Bug fix (triggers patch version bump) |
| `docs` | Documentation changes only |
| `style` | Formatting, whitespace — no logic change |
| `refactor` | Restructuring without behaviour change |
| `test` | Adding or updating tests |
| `chore` | Build system, CI, dependency updates |
| `perf` | Performance improvement |
| `security` | Security fix or hardening |
| `revert` | Reverts a previous commit |

### Scopes (common)

`treasury`, `milestone`, `governance`, `learn-token`, `scholar-nft`, `frontend`, `api`, `e2e`, `docs`, `ci`

### Examples

```
feat(milestone): add batch_verify_milestones endpoint

Allows admins to approve multiple milestone submissions in a single
atomic transaction, reducing ledger round-trips for large cohorts.

Fixes #732
```

```
fix(treasury): proposal_status now applies quorum + approval_bps

The helper was returning Approved based on yes > no alone, while
finalize_proposal and execute_proposal both require quorum and a
configurable approval threshold.

BREAKING CHANGE: get_proposals_by_status(Approved) may return fewer
results on existing deployments until proposals are re-finalized.
```

```
chore(ci): pin soroban-sdk to 23.1.0 across all contracts
```

### Rules
- Summary line: imperative mood, ≤ 72 characters, no trailing period.
- Body: explain *why*, not *what* (the diff shows what).
- `BREAKING CHANGE:` footer triggers a major version bump and must describe the migration path.
- Reference issues with `Fixes #NNN` or `Closes #NNN` in the footer.

---

## 3. PR process and review checklist

### Opening a PR

1. Push your branch to `origin` and open a PR against `main`.
2. Fill in the [PR description template](code-review.md#2-what-authors-should-include-in-pr-descriptions).
3. Assign at least one reviewer. Smart contract changes require a second reviewer.
4. Link the related issue in the description (`Fixes #NNN`).
5. Ensure all CI checks pass before requesting review.

### Review checklist (author self-check before requesting review)

- [ ] Branch is up to date with `main` (`git fetch upstream && git rebase upstream/main`).
- [ ] CI is green (lint, type-check, unit tests, e2e smoke tests).
- [ ] No `console.log`, `dbg!()`, or temporary debug code left in.
- [ ] No secrets, `.env` values, or private keys committed.
- [ ] New public functions/types have doc comments.
- [ ] CHANGELOG or ADR updated if behaviour or architecture changed.
- [ ] (Smart contracts) `cargo test -p <contract>` passes locally.
- [ ] (Smart contracts) Storage schema changes are backward-compatible.

### Merging

- PRs require **at least one approving review**. Smart contract PRs require **two**.
- All blocking review comments must be resolved before merging.
- Use **Squash and merge** for feature/fix branches (see §4).
- Delete the source branch after merge.

---

## 4. When to squash vs. merge commits

| Scenario | Strategy | Reason |
|----------|----------|--------|
| Feature branch (typical) | **Squash and merge** | Keeps `main` history linear and readable; individual WIP commits are noise |
| Long-lived integration branch (e.g., `release/`) | **Merge commit** | Preserves the branch history for audit purposes |
| Reverting a previous squashed commit | **Revert commit** | Creates a clean, attributable rollback on `main` |
| Merging `main` into a long-lived branch | **Merge commit** (no fast-forward) | Keeps branch ancestry legible |

**Squash message format:** when squashing, replace the auto-generated commit message with a single Conventional Commit that describes the whole PR.

---

## 5. Release tagging strategy

LearnVault uses [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`).

| Version bump | Trigger |
|--------------|---------|
| `PATCH` (e.g. `1.0.1`) | `fix:` or `perf:` commits only |
| `MINOR` (e.g. `1.1.0`) | At least one `feat:` commit |
| `MAJOR` (e.g. `2.0.0`) | Any commit with `BREAKING CHANGE:` footer |

### Release process

```bash
# 1. Create a release branch from main
git checkout -b release/v1.2.0 upstream/main

# 2. Bump version in package.json / Cargo.toml / contract get_version()
# 3. Update CHANGELOG.md (use git log --oneline since last tag)
# 4. Open a PR: release/v1.2.0 → main
# 5. After merge, tag on main:
git tag -a v1.2.0 -m "chore(release): v1.2.0"
git push upstream v1.2.0
```

- Tags are **annotated** (`-a`), not lightweight.
- Smart contract deployments are documented in [contract-upgrades.md](../contract-upgrades.md) with the tag, WASM hash, and deployment transaction.
- GitHub Releases are created from the tag with the relevant CHANGELOG section as the body.

---

## 6. Stale branch cleanup policy

| Branch state | Action | Timeline |
|-------------|--------|----------|
| Merged PR | Delete immediately (GitHub auto-delete is enabled) | On merge |
| Open PR, no activity | Author pings reviewer; reviewer pings author | After 7 days |
| Open PR, still no activity | Branch is labelled `stale`; author has 7 more days to respond | After 14 days total |
| Stale, no response | PR is closed; branch is deleted | After 21 days total |
| Open PR, author requests hold | Label `on-hold`; exempt from stale policy | Manually reviewed monthly |

Run the cleanup query to find stale branches:

```bash
# Branches with no commits in the last 30 days, not merged into main
git fetch --prune upstream
git for-each-ref --sort=committerdate refs/remotes/upstream \
  --format='%(committerdate:short) %(refname:short)' \
  | awk -v cutoff="$(date -d '30 days ago' +%Y-%m-%d 2>/dev/null || date -v-30d +%Y-%m-%d)" \
    '$1 < cutoff && $2 !~ /HEAD|main|release/' \
  | column -t
```
