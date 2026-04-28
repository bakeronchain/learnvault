# Token Economics

LearnVault uses two tokens because it has two distinct problems to solve:
measuring learning (reputation) and governing scholarship disbursement (voting
power). Conflating them into one token would break both functions.

---

## LRN (LearnToken)

LRN is not a financial asset. It is an on-chain reputation score — a number that
says how much verified learning a wallet has completed inside the LearnVault
system. It cannot be sent, sold, or delegated.

### How it's earned

LRN is minted by the `CourseMilestone` contract when a validator approves a
milestone submission. The amount minted per milestone is set per track by the
admin committee in V1 — there is no global fixed rate. A learner completing a
beginner track will earn less LRN than one completing an advanced engineering
track. Exact amounts per track are configured at course creation time via
`add_course`.

### What it unlocks

| Threshold              | What it enables                                      |
| ---------------------- | ---------------------------------------------------- |
| Configurable per track | Scholarship eligibility — wallet can be nominated    |
| Governance threshold   | Eligibility to participate in DAO votes on proposals |

Reaching these thresholds does not automatically grant anything — it makes the
wallet _eligible_. Scholarship disbursement still requires a passing governance
vote (see GOV below).

### Why it's non-transferable

If LRN could be transferred, the following would happen immediately:

- Wallets with capital but no learning would buy reputation and access
  scholarships meant for real learners
- A secondary market would form around eligibility thresholds, pricing out
  genuine participants
- Sybil attackers could launder reputation across fresh wallets to reset
  eligibility windows

Soulbound design is not ideological — it is the only mechanism that makes the
eligibility threshold meaningful. A score you cannot buy is the only score worth
having.

### Supply model

- **Cap:** None. LRN is uncapped.
- **Minting:** Exclusively by `contracts/course_milestone/` — no other contract
  or admin can mint LRN directly.
- **Burning:** No burn mechanic. LRN balances are permanent records of completed
  work.

---

## GOV (GovernanceToken)

GOV is voting weight in the scholarship DAO. Unlike LRN, it is a transferable
token — deliberately so.

### How it's earned

GOV is minted through two paths:

1. **Donation:** 1 USDC deposited to the treasury mints 1 GOV. Donors get
   governance rights proportional to their contribution.
2. **Learner rewards:** Wallets that cross the top-learner LRN threshold receive
   a GOV distribution as a reward. This gives high-performing learners a voice
   in how scholarship funds are allocated.

### What it does

GOV holders vote on scholarship disbursement proposals. Votes are weighted by
GOV balance. A proposal must reach a quorum and a majority to pass. In V1,
proposal creation is permissioned — only wallets above the LRN governance
threshold or holding minimum GOV can submit proposals.

### Why it IS transferable

Donors need an exit. Locking capital permanently into a governance token with no
liquidity would deter serious donors from participating. Transferability also
creates secondary market price discovery — if GOV trades at a premium, it is a
signal that the community values governance rights, which attracts more donors.
If it trades at a discount, that is honest feedback about protocol health.

Transferability is a feature, not a compromise.

### Supply model

- **Minting:** On USDC deposit and on learner threshold reward distributions.
- **Burning:** ⚠️ Open design question — see callout below.

> ⚠️ **Open design question**
>
> The GOV burn mechanic has not been finalized. Options under consideration
> include burning GOV when a scholarship is disbursed (aligning token supply
> with treasury outflows), burning on governance participation as a spam
> deterrent, or no burn at all. This will be resolved before mainnet. Track the
> discussion in [#139](https://github.com/bakeronchain/learnvault/issues/139).

---

## The Flywheel

The two tokens are designed to reinforce each other through a feedback loop:

```
1. Learner completes milestones → earns LRN
2. LRN crosses threshold → learner becomes scholarship-eligible
3. LRN crosses governance threshold → learner gains DAO voting rights
4. More legitimate voters → better scholarship proposals pass
5. Better outcomes → donors notice → more USDC deposited
6. More USDC → more GOV minted → governance becomes more distributed
7. More distributed governance → more proposals → back to step 4
```

```
   ┌─────────────────────────────────────────────┐
   │                                             │
   ▼                                             │
[Learner earns LRN]                              │
   │                                             │
   ▼                                             │
[Crosses GOV eligibility threshold]              │
   │                                             │
   ▼                                             │
[Participates in DAO votes]                      │
   │                                             │
   ▼                                             │
[Better proposals pass → scholarships disbursed] │
   │                                             │
   ▼                                             │
[Donors attracted → deposit USDC]                │
   │                                             │
   ▼                                             │
[More GOV minted → governance decentralizes] ────┘
```

The loop only holds if LRN remains non-transferable. The moment reputation can
be bought, step one becomes pay-to-win and the rest of the flywheel breaks.

---

## V1 Centralization — Honest Accounting

V1 ships with the following centralized components. None of this is hidden:

- **Milestone approval** is controlled by a validator committee. There is no
  on-chain dispute resolution. A validator can reject a valid submission and
  there is currently no appeal mechanism.
- **Minting permissions** on `contracts/course_milestone/` are set by an admin
  key. The admin can add courses, set milestone counts, and configure LRN
  amounts per track.
- **Scholarship disbursement** requires a multisig in V1. Even if a proposal
  passes governance, the actual USDC transfer goes through a multisig held by
  the core team.
- **Contract upgrades** are not yet governed on-chain. The team can upgrade
  contracts unilaterally.

This is the honest state of V1. It ships this way because the alternative —
launching with incomplete decentralization infrastructure and calling it
trustless — is worse.

### V2 Roadmap

Before admin keys are removed, the following needs to exist:

1. On-chain dispute resolution for milestone rejections
2. Fully on-chain proposal execution without multisig
3. A validator election mechanism governed by GOV holders
4. Time-locked upgrade governance so contract changes require a passing vote

V2 decentralization is not a vague future commitment — it is a prerequisite for
removing the admin keys. Until those components exist, the keys stay and this
document says so plainly.

---

## Contract References

| Contract             | Path                          | Role                               |
| -------------------- | ----------------------------- | ---------------------------------- |
| `CourseMilestone`    | `contracts/course_milestone/` | Milestone approval, LRN minting    |
| `ScholarNFT`         | `contracts/scholar_nft/`      | Soulbound credential on completion |
| Governance (planned) | `contracts/governance/`       | GOV voting, proposal execution     |

---

## Further Reading

- [README](../README.md)
- [Issue #139 — Token economics explainer](https://github.com/bakeronchain/learnvault/issues/139)
