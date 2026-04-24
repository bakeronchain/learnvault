# LearnVault Glossary

A plain-English reference for the key terms, tokens, and contracts used
throughout LearnVault. If you are new to blockchain or to this project, start
here.

---

## Tokens

### LRN (LearnToken)

LearnVault's soulbound reputation token. LRN is minted to a learner's wallet
each time they complete a verified course milestone. Because it is soulbound, it
cannot be sold or transferred — your LRN balance is a tamper-proof measure of
how much you have actually learned on the platform.

### GOV (GovernanceToken)

The governance token that grants voting power in the LearnVault DAO. Donors
receive GOV proportional to their treasury contributions, and top learners earn
GOV when they hit milestone thresholds. GOV is transferable and is used
exclusively to vote on scholarship proposals and protocol changes.

### Soulbound

A property that makes a token non-transferable — it is permanently tied to the
wallet that received it. Soulbound tokens cannot be sold, traded, or moved to
another address, which makes them trustworthy indicators of personal achievement
or identity rather than purchased assets.

---

## Stellar & Soroban Concepts

### SEP-41

Stellar's standard interface for fungible tokens, roughly equivalent to
Ethereum's ERC-20. Both LRN and GOV implement SEP-41, which means any Stellar
wallet or tool that understands this standard can display and interact with
them.

### Soroban

Stellar's smart contract platform. LearnVault's on-chain logic — milestone
tracking, token minting, treasury management, and DAO voting — is implemented as
Soroban smart contracts written in Rust and deployed on the Stellar network.

### Friendbot

Stellar's testnet faucet. Friendbot funds a new testnet account with free test
XLM so developers can experiment with transactions and contract calls without
spending real money. If you are setting up a local development environment,
Friendbot is the first thing you will use.

### Horizon

Stellar's REST API server for querying on-chain data. Through Horizon you can
look up account balances, transaction history, and contract state. LearnVault's
frontend uses Horizon to display learner progress and treasury balances in real
time.

---

## Smart Contracts

### CourseMilestone

The contract that tracks learner progress within each skill track. When a
learner completes a checkpoint and a validator confirms it, CourseMilestone
triggers the LRN mint. It is the bridge between off-chain learning activity and
on-chain reputation.

### ScholarshipTreasury

The contract that holds all community-donated USDC and manages DAO vote
execution. Funds can only leave the treasury when a scholarship proposal passes
the required quorum and approval threshold. Every deposit and withdrawal is
recorded on-chain for full transparency.

### MilestoneEscrow

The contract that holds approved scholarship funds and releases them in tranches
as the scholar hits agreed milestones. If a scholar goes inactive for 30 days,
any unspent funds automatically return to the treasury, protecting donor
contributions.

### ScholarNFT

A soulbound credential NFT minted to a scholar's wallet when they successfully
complete a funded program. It serves as a permanent, on-chain proof of
achievement that can be shared with employers, DAOs, and other ecosystem
participants. Because it is soulbound, it cannot be faked or transferred.

---

## Governance & DAO

### DAO (Decentralized Autonomous Organization)

The community-driven governance structure through which LearnVault is managed.
Instead of a single authority deciding how funds are allocated, GOV token
holders collectively vote on scholarship proposals, eligibility thresholds, and
protocol upgrades.

### Validator Committee

In the current V1 phase, a trusted multi-sig group responsible for verifying
that scholars have genuinely completed their milestones. The committee reviews
submitted proof and signs off before the next tranche of funds is released. In
V2 this role transitions to oracle-based verification.

### Quorum

The minimum level of vote participation required for a proposal to be considered
valid. If not enough GOV holders cast votes during the 7-day voting window, the
proposal does not pass regardless of the yes/no ratio. This prevents low-turnout
decisions from committing treasury funds.

### Tranche

A portion of scholarship funds released upon the completion of one milestone.
Rather than disbursing the full approved amount at once, MilestoneEscrow splits
it into tranches so that scholars are funded incrementally and accountability is
maintained at every step.
