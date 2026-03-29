# Security Policy

LearnVault takes security seriously. We appreciate the work of security
researchers and contributors who help keep the platform and its users safe.
Please read this policy before submitting a report.

---

## Supported Versions

Only the versions listed below receive security fixes. If you find a
vulnerability in an unsupported version, please verify it is still present in a
supported version before reporting.

| Version | Status | Security fixes |
|---------|--------|---------------|
| `main` branch (Testnet v1) | ✅ Active development | ✅ Yes |
| Previous commits / tags | Superseded | ❌ No — please test against `main` |
| Mainnet | 🔜 Not yet deployed | N/A |

---

## Scope

### In scope

We are interested in vulnerabilities that could harm users, funds, or the
integrity of the LearnVault protocol:

**Smart contracts** (`contracts/`)
- Reentrancy attacks on any contract
- Integer overflow / underflow in arithmetic operations
- Access control bypass (calling admin-only functions without authorization)
- Logic that allows unauthorized withdrawal from `scholarship_treasury`
- Exploits against `milestone_escrow` that release funds without meeting conditions
- Governance manipulation via `governance_token` (vote inflation, double-voting)
- Sybil or replay attacks on `scholar_nft` minting
- Timelock bypass in `upgrade_timelock_vault`
- Allowlist circumvention in `fungible-allowlist`

**Frontend / dApp**
- Cross-site scripting (XSS) that could execute arbitrary code in a user's browser
- Wallet-draining UI — any page or component that causes a wallet to sign a transaction the user did not explicitly intend
- Phishing vectors hosted on the official domain
- Insecure handling of private keys or seed phrases

**Protocol logic**
- Any flow that allows a learner, mentor, or third party to extract funds from the treasury without meeting the stated course-completion criteria

### Out of scope

The following are **not** in scope. Please do not submit reports for:

- Vulnerabilities in third-party libraries or upstream dependencies — report these directly to the relevant project
- Issues that require physical access to a user's device
- Theoretical vulnerabilities with no working proof of concept
- Rate-limiting or brute-force issues on read-only public endpoints
- Social engineering attacks targeting LearnVault team members
- Spam or content-policy violations
- Clickjacking on pages without sensitive actions
- Missing security headers on informational/marketing pages

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Use one of the following private channels:

### Option 1 — GitHub Private Security Advisory (preferred)

1. Go to the [LearnVault security advisories page](https://github.com/bakeronchain/learnvault/security/advisories/new).
2. Click **"Report a vulnerability"**.
3. Fill in the template with as much detail as possible.

GitHub keeps the report private and notifies the maintainers immediately.

### Option 2 — Email

Send your report to **security@learnvault.xyz**.

Encrypt sensitive reports with our PGP key if possible (key available on
request via the email address above).

### What to include in your report

Please provide as much of the following as you can:

- **Description** — what the vulnerability is and why it is exploitable
- **Affected component** — contract name, frontend route, or API endpoint
- **Proof of concept** — steps to reproduce, test script, or transaction hash on
  a testnet demonstrating the issue
- **Impact assessment** — what an attacker could achieve (e.g. drain treasury,
  mint arbitrary NFTs)
- **Suggested fix** (optional but appreciated)

---

## Response Timeline

| Milestone | Target time |
|-----------|-------------|
| Acknowledgement of receipt | Within **48 hours** |
| Initial severity assessment | Within **7 days** |
| Fix timeline communicated | Within **14 days** of acknowledgement |
| Patch released (critical/high) | Best effort, typically within **14 days** of confirmation |
| Patch released (medium/low) | Included in the next scheduled release |

We will keep you updated throughout the process. If you have not received an
acknowledgement within 48 hours, please follow up at **security@learnvault.xyz**.

---

## Disclosure Policy

LearnVault follows **coordinated disclosure**:

- Please **do not publish or share** details of a vulnerability before a fix has
  been released.
- Once a fix is deployed we will coordinate a public disclosure date with you.
  The default embargo period is **90 days** from the initial report, or sooner
  if both parties agree.
- We will credit you in the release notes and changelog unless you prefer to
  remain anonymous.
- We will not pursue legal action against researchers who act in good faith and
  follow this policy.

---

## Recognition

Responsibly disclosed vulnerabilities will be credited in the project's release
notes. If you would like to be acknowledged:

- Tell us your preferred name / handle in the report.
- We will list you under **"Security"** in the relevant release or CHANGELOG
  entry.

We do not currently operate a paid bug bounty programme, but we are grateful for
every responsible disclosure and aim to recognize the effort publicly.

---

## Contact

| Channel | Address |
|---------|---------|
| Security reports (preferred) | [GitHub Private Advisory](https://github.com/bakeronchain/learnvault/security/advisories/new) |
| Security email | security@learnvault.xyz |
| General enquiries | hello@learnvault.xyz |
