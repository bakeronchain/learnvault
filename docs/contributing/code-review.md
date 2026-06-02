# Code Review Guidelines

> These guidelines apply to all pull requests in the LearnVault monorepo — frontend, backend, and smart contracts alike. Smart-contract PRs also have an [extra checklist](#smart-contract-extra-checklist).

---

## 1. What reviewers should check

### Correctness
- Does the code do what the PR description says it does?
- Are edge cases handled (empty inputs, zero values, integer overflow, concurrent access)?
- Are error paths tested, not just the happy path?
- Does new behaviour match the spec / ADR / ticket acceptance criteria?

### Security
- Are inputs validated before use?
- Is authentication/authorisation enforced on every new entry point?
- Are secrets, private keys, and environment variables kept out of source?
- Does the change introduce new attack surfaces (SSRF, injection, privilege escalation)?
- Review the [security checklist](../security/third-party-audit-checklist.md) for anything relevant.

### Performance
- Does the change introduce N+1 queries, unbounded loops, or unnecessary re-renders?
- Are new database queries using the right indexes?
- Do large data sets get paginated?
- Check against [performance budgets](../performance-budget.md) for UI changes.

### Tests
- Is the changed code path covered by at least one test?
- Are tests meaningful (assert on behaviour, not just that code ran)?
- Are mocks realistic and not hiding real failure modes?
- Are any tests skipped/xfailed with a clear expiry comment?

### General code quality
- Is the code readable without needing to read the ticket?
- Are new functions/types documented with a one-line doc comment?
- Is duplicated logic extracted into a shared helper?
- Does the change follow existing conventions in the file (naming, formatting, error handling)?

---

## 2. What authors should include in PR descriptions

A good PR description saves review time. Use this structure:

```
## What
One paragraph — what problem does this solve, or what feature does it add?

## Why
Why now? Link to the issue/ticket: Fixes #NNN

## How
Walk reviewers through the key design decisions. Mention any alternatives considered.

## Testing
How was this tested? List the test cases added and any manual verification steps.

## Screenshots / recordings (UI changes only)
Before / after screenshots or a short screen recording.

## Checklist
- [ ] Tests added or updated
- [ ] Docs updated if behaviour changed
- [ ] No secrets or keys committed
- [ ] (Smart contracts) soroban-sdk version unchanged unless deliberately upgraded
```

> **Rule of thumb:** if a reviewer would have to ask a question, the answer belongs in the description.

---

## 3. How to give constructive feedback

### Label your comments

Use prefixes so authors know the priority and intent of each comment:

| Prefix | Meaning |
|--------|---------|
| `nit:` | Trivial style preference — author may ignore |
| `suggestion:` | Take it or leave it improvement |
| `question:` | Genuine curiosity, not requesting a change |
| `request:` | Please change this — blocking if unaddressed |
| `blocker:` | Must be fixed before merge (same as request, more explicit) |
| `praise:` | Something done well — say it! |

### Tone
- Review the **code**, not the person. "This function is confusing" not "you wrote this badly."
- Explain *why* a change is needed, not just *what* to change.
- If you would accept multiple solutions, say so: "Any of X, Y, or Z works here."
- Acknowledge good work. A PR with only critical comments feels hostile even when it isn't.

### Be specific
Bad: "This is wrong."
Good: "This will panic when `lrn_reward == 0` because `LearnToken::mint` rejects zero amounts — see `contracts/learn_token/src/lib.rs:42`. Guard with `if lrn_reward > 0 { … }`."

---

## 4. Blocking vs. non-blocking comments

| Category | Block merge? | Examples |
|----------|-------------|---------|
| **Correctness bug** | ✅ Yes | Logic error, wrong formula, silent data loss |
| **Security issue** | ✅ Yes | Missing auth check, exposed secret, injection vector |
| **Missing tests** for new code paths | ✅ Yes | No coverage for the changed function |
| **API / interface break** | ✅ Yes | Removing a public function without a deprecation path |
| **Performance regression** | ⚠️ Discuss | Depends on severity; agree on a threshold |
| **Style / naming** | ❌ No (`nit:`) | Variable name preference, comment wording |
| **Refactor opportunity** | ❌ No (`suggestion:`) | Can be filed as a follow-up issue |
| **Questions** | ❌ No | Understanding the code, not requesting a change |

Reviewers must resolve all blocking comments before approving. Non-blocking comments can be addressed in a follow-up PR — the author should acknowledge them and either act or open a tracking issue.

---

## 5. Smart contract extra checklist

Smart contracts are immutable once deployed. Apply additional scrutiny for any change under `contracts/`.

### Before approving a smart contract PR

**Storage & state**
- [ ] New `DataKey` variants are documented and won't collide with existing keys.
- [ ] Persistent storage entries include appropriate TTL bumps (`extend_ttl`).
- [ ] No unbounded `Vec` or `Map` growth that could exhaust ledger entry size limits.

**Arithmetic**
- [ ] All arithmetic uses `checked_add` / `checked_sub` / `checked_mul`; no bare `+`, `-`, `*`.
- [ ] Basis-point calculations (`× 10_000 / total`) guard against division by zero.

**Access control**
- [ ] Every privileged function calls `require_auth()` on the right address.
- [ ] Admin-only functions cannot be called by arbitrary addresses.
- [ ] `initialize` is idempotent-safe (panics if called twice).

**Token operations**
- [ ] Mint/transfer amounts are validated `> 0` before calling the token contract.
- [ ] Zero-reward paths skip mint calls rather than panicking downstream.

**Upgrade path**
- [ ] Any storage schema change is backward-compatible with existing ledger entries, or a migration plan is included.
- [ ] `upgrade` is gated behind admin auth and the timelock where required.

**Events**
- [ ] Every state-changing function emits the appropriate event.
- [ ] Event payloads contain enough context for indexers to reconstruct state without re-reading ledger.

**Tests**
- [ ] Unit tests cover the new logic, quorum edge cases, and rejection paths.
- [ ] Tests compile and pass with `cargo test -p <contract>`.

---

## 6. How to request re-review

### As an author
After addressing feedback:
1. **Resolve** conversations you've fully addressed.
2. Leave a **reply** on conversations where you chose a different approach, explaining why.
3. Re-request review from the original reviewer(s) using the GitHub "Re-request review" button (the refresh icon next to their name).
4. Add a short comment: _"Addressed all blocking comments — please take another look."_

Do **not** dismiss reviewers' changes unilaterally. If you disagree, discuss in the PR thread.

### As a reviewer
- Re-reviews should focus on unresolved threads and any new code added.
- If all blocking issues are fixed, approve even if non-blocking suggestions remain open.
- Use "Approve with comments" only when the outstanding comments are genuinely non-blocking.

### Escalation
If author and reviewer are stuck, either party may request a third reviewer or bring the decision to the next team sync. Do not let a PR stall for more than 3 business days without a comment.
