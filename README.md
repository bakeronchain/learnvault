# LearnVault — Official Documentation

[![Contracts CI](https://github.com/robertocarlous/learnvault/actions/workflows/contracts-ci.yml/badge.svg)](https://github.com/robertocarlous/learnvault/actions/workflows/contracts-ci.yml)
[![Frontend CI](https://github.com/bakeronchain/learnvault/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/bakeronchain/learnvault/actions/workflows/frontend-ci.yml)

> **Learning is the proof of work. The community is the bank.**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Problem Statement](#problem-statement)
3. [Solution](#solution)
4. [Platform Architecture](#platform-architecture)
5. [Smart Contract System](#smart-contract-system)
6. [User Roles](#user-roles)
7. [The Earn Loop](#the-earn-loop)
8. [Scholarship DAO](#scholarship-dao)
9. [Governance](#governance)
10. [Tech Stack](#tech-stack)
11. [Roadmap](#roadmap)
12. [Contributing](#contributing)
13. [Contact](#contact)

---

## Introduction

**LearnVault** is a decentralized learn-and-earn platform where education meets
opportunity. Learners earn reputation tokens by completing skill tracks, while
donors and sponsors fund a community treasury governed by DAO voting. The best
learners get funded to go further — no gatekeepers, no bureaucracy, just proof
of effort and community belief.

LearnVault is designed specifically with African learners in mind — a generation
of ambitious builders who have the talent and drive but lack access to the
financial resources that would take their skills to the next level. By combining
blockchain-powered credentials, on-chain reputation, and decentralized
scholarship funding, LearnVault creates a self-sustaining education ecosystem
that rewards effort and amplifies potential.

---

## Problem Statement

Access to quality tech education across Africa is not limited by lack of
ambition — it is limited by lack of opportunity. Three core problems define the
gap:

**Funding Barriers** — Bootcamps, courses, and developer tools cost money that
most learners in emerging markets simply do not have. Scholarship systems that
exist are slow, opaque, and often inaccessible.

**Credential Trust Gap** — Traditional certificates are easy to fake and hard to
verify. Employers and DAOs have no reliable way to assess a candidate's real
on-chain track record.

**Broken Incentive Systems** — Existing learn-to-earn platforms flood learners
with worthless tokens for clicking through slides. There is no real connection
between learning effort and financial reward.

LearnVault addresses all three problems in a single, cohesive platform.

---

## Solution

LearnVault creates a three-pillar ecosystem:

**1. Learn** — Learners enroll in skill tracks covering Web3 development, smart
contract engineering, DeFi, frontend development, and more. Every verified
milestone they complete earns them LearnTokens — soulbound, non-transferable
reputation tokens that live on-chain.

**2. Earn** — LearnTokens are proof of real effort. They unlock governance
rights, scholarship eligibility, and platform reputation. High-achieving
learners convert a portion of their LearnTokens into Governance Tokens, giving
them a voice in the DAO.

**3. Get Funded** — Learners with sufficient on-chain reputation can submit
scholarship proposals to the community treasury. Governance token holders vote
on proposals. Approved scholars receive milestone-based disbursements in
stablecoins — real, stable value delivered directly to their wallets.

---

## Platform Architecture

```
┌─────────────────────────────────────────────────────┐
│                     LEARNVAULT                       │
│                                                     │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐     │
│   │  LEARN   │───▶│   EARN   │───▶│ GET FUNDED│    │
│   │          │    │          │    │           │     │
│   │ Courses  │    │ LRN      │    │ Scholarship│    │
│   │ Quizzes  │    │ Tokens   │    │ Proposals │     │
│   │ Projects │    │ (Soulbound│   │ DAO Vote  │     │
│   │          │    │ ERC20)   │    │ Escrow    │     │
│   └──────────┘    └──────────┘    └──────────┘     │
│                                                     │
│   ┌─────────────────────────────────────────┐       │
│   │           COMMUNITY TREASURY             │       │
│   │   Funded by Donors · Governed by DAO    │       │
│   └─────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────┘
```

---

## Smart Contract System

LearnVault is powered by six core smart contracts:

### `LearnToken.sol`

A **soulbound ERC20** token that is minted to learners upon verified milestone
completion. Non-transferable by design — it represents real effort, not
speculation. Your LearnToken balance is your on-chain academic reputation score.

### `GovernanceToken.sol`

A **transferable ERC20** distributed to donors upon treasury contribution and
earned by top learners at milestone thresholds. Used exclusively for DAO voting
on scholarship proposals.

### `CourseMilestone.sol`

Tracks learner progress per course. Each course has defined checkpoints verified
by a trusted multi-sig validator (transitioning to oracle-based verification in
V2). On successful verification, this contract triggers LearnToken minting.

### `ScholarshipTreasury.sol`

Holds all donor funds in stablecoins (USDC). Funds can only be released upon
successful proposal execution through the governance system. Tracks total
contributions per donor. Transparent and auditable by anyone.

### `MilestoneEscrow.sol`

Manages approved scholarship disbursements in tranches. Funds are released as
scholars hit agreed milestones. If a scholar is inactive for 30 days, unspent
funds automatically return to the treasury.

### `ScholarNFT.sol`

Mints a **soulbound ERC721 credential** to scholars who complete their funded
programs. Non-transferable, tamper-proof, and permanently verifiable on-chain.
Shareable with employers, DAOs, and the broader ecosystem.

---

## User Roles

### Learner

- Connects wallet and enrolls in skill tracks
- Completes lessons, quizzes, and projects
- Earns soulbound LearnTokens per milestone
- Builds on-chain reputation score
- Submits scholarship proposals when eligible
- Receives milestone-based funding upon approval
- Earns ScholarNFT credential upon program completion

### Donor / Sponsor

- Deposits stablecoins (USDC) into the community treasury
- Receives Governance Tokens proportional to contribution
- Votes on scholarship proposals
- Tracks the impact of their contributions transparently on-chain
- Can set optional focus areas (e.g., only fund Web3 developers)

### DAO Voter / Community Member

- Any Governance Token holder can vote on proposals
- Votes are weighted by token balance
- Voting window: 7 days per proposal
- Quorum and threshold parameters set by DAO governance

---

## The Earn Loop

LearnVault's flywheel is designed so that effort compounds over time:

```
Complete Lesson
       │
       ▼
Earn LearnTokens (LRN)
       │
       ▼
Complete Full Track ──▶ Convert LRN to Governance Tokens
       │
       ▼
Submit Scholarship Proposal
       │
       ▼
Community Votes YES
       │
       ▼
Milestone-Based Funding Released
       │
       ▼
Complete Funded Program
       │
       ▼
Mint ScholarNFT Credential
       │
       ▼
Higher Reputation ──▶ Larger Future Proposals ──▶ Loop Continues
```

The more you learn, the more power and opportunity you unlock. Wealth is not the
barrier — effort is the currency.

---

## Scholarship DAO

The Scholarship DAO is the heart of LearnVault's funding mechanism.

### Eligibility to Apply

A learner must hold a minimum LearnToken balance (set by governance) before
submitting a proposal. This ensures only learners with a verified track record
can access treasury funds.

### Proposal Contents

Each scholarship proposal includes:

- Learning goal and intended program or bootcamp
- Amount requested in USDC
- Timeline and milestone plan
- On-chain reputation score (LRN balance)
- Wallet address for disbursement

### Voting

Governance token holders vote YES or NO within a 7-day window. A proposal passes
if it meets the required quorum and approval threshold. Failed proposals can be
resubmitted after 30 days.

### Disbursement

Approved funds are locked in `MilestoneEscrow.sol` and released in tranches as
the scholar completes agreed milestones. Progress is reported by the scholar and
confirmed by a community-elected validator committee (transitioning to oracle
verification in V2).

### Accountability

Scholars who abandon funded programs without communication are flagged on-chain.
Repeated abandonment affects future proposal eligibility. Unspent funds always
return to the treasury.

---

## Governance

LearnVault's DAO governance covers:

- Scholarship eligibility thresholds (minimum LRN to apply)
- Voting quorum and approval thresholds
- Treasury allocation limits per proposal
- Adding new course tracks to the platform
- Protocol upgrades and parameter changes

Governance evolves over time. In V1, the founding team holds a multi-sig with
community governance as an advisory layer. In V2, full on-chain governance
transfers to token holders.

---

## Tech Stack

| Layer              | Technology                                     |
| ------------------ | ---------------------------------------------- |
| Blockchain         | Stellar (primary), EVM-compatible L2 (planned) |
| Smart Contracts    | Solidity / Stellar Soroban                     |
| Frontend           | Next.js, TypeScript, TailwindCSS               |
| Wallet Integration | Freighter (Stellar), MetaMask                  |
| Storage            | IPFS (course content + proposal docs)          |
| Stablecoin         | USDC                                           |
| Backend            | Node.js, PostgreSQL                            |
| Deployment         | Docker                                         |

---

## Roadmap

### V1 — MVP (Current Phase)

- Core smart contracts (LearnToken, GovernanceToken, Treasury, ProposalManager)
- Basic course completion tracker
- Scholarship proposal submission and voting
- Learner and donor dashboards

### V2 — Growth

- MilestoneEscrow and automated tranche disbursements
- ScholarNFT credential system
- Oracle-based milestone verification
- Expanded course catalog (Web3, DeFi, Smart Contracts, ZK basics)
- Mobile-responsive frontend
- Community leaderboard

### V3 — Scale

- Full on-chain governance transition
- Cross-chain support (Arbitrum, Base)
- Corporate sponsor portal with targeted funding
- ZK-powered credential proofs (prove achievement without revealing identity)
- API for third-party integrations

---

## Contributing

LearnVault is an open-source project and welcomes contributions from developers,
educators, designers, and community builders. If you believe in decentralized
education and want to help build the infrastructure for the next generation of
African builders, we would love to have you.

To contribute:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request with a clear description of your changes
4. Join the community discussion in our Discord

All contributors are recognized on-chain and in our official documentation.

---

## Contact

For partnerships, sponsorships, grant inquiries, or general questions about
LearnVault, please reach out through our official channels.

- **GitHub**: github.com/learnvault
- **Twitter/X**: @LearnVaultDAO
- **Discord**: discord.gg/learnvault
- **Email**: hello@learnvault.xyz

---

_LearnVault — Built for African learners. Powered by community. Governed by
effort._
