# Smart Contract Interactions & Security Model

This document maps the runtime interaction sequences for core blockchain transactions in **LearnVault** and details the administrative security and authority model.

---

## Key Transaction Flows

### 1. Milestone Completion → LRN Mint
Tracks how a learner completes a course unit, receives off-chain audit verification, and earns non-transferable reputation tokens on-chain.

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Scholar / Learner
    participant WebApp as Web App (React)
    participant API as Express API
    participant DB as PostgreSQL
    participant CM as CourseMilestone (Soroban)
    participant LT as LearnToken (Soroban)

    Learner->>WebApp: Submit milestone completion report (evidence + IPFS link)
    WebApp->>API: POST /api/milestones/submissions
    API->>DB: Save submission with status 'pending'
    Note over API,DB: Validator audits submission...
    API->>DB: Save audit decision ('approved')
    API->>CM: Invoke verify_milestone(learner_address, course_id, milestone_id)
    Note over CM: Authenticates Admin signature
    CM->>LT: Invoke mint(learner_address, lrn_amount)
    Note over LT: Checks that caller is CourseMilestone
    LT-->>CM: Mint complete
    CM-->>API: Emit MilestoneVerified event
    API->>DB: Mark report status as 'approved'
    API-->>WebApp: Complete and update UI
    WebApp-->>Learner: Show reputation (LRN) balance increase
```

---

### 2. Donor Deposit → GOV Token → Vote → Escrow Tranche Release
Details the full lifecycle of a funded scholarship program from USDC deposit, voting, proposal approval, and escrow tranche release.

```mermaid
sequenceDiagram
    autonumber
    actor Donor
    actor Scholar
    participant WebApp as Web App (React)
    participant API as Express API
    participant ST as ScholarshipTreasury (Soroban)
    participant GT as GovernanceToken (Soroban)
    participant ME as MilestoneEscrow (Soroban)

    %% Donor commits funds
    Donor->>WebApp: Deposit USDC into Treasury
    WebApp->>ST: Invoke deposit(donor_address, usdc_amount)
    ST->>GT: Invoke mint(donor_address, gov_amount)
    Note over GT: Mints 1:1 voting power tokens
    GT-->>Donor: Transfer GOV tokens to wallet

    %% Proposal & voting
    Scholar->>WebApp: Submit scholarship proposal
    WebApp->>API: POST /api/proposals (title, syllabus, USDC request)
    Note over Donor, WebApp: Voting window opens
    Donor->>WebApp: Vote on proposal using GOV
    WebApp->>ST: Invoke cast_vote(proposal_id, support_boolean)
    Note over ST: Queries voter's GOV balance for voting weight
    
    %% Proposal Passes & Escrow Created
    Note over ST: Vote passes deadline...
    API->>ST: Invoke approve_and_create_escrow(proposal_id, scholar_address)
    ST->>ME: Deploy & initialize MilestoneEscrow(scholar, total_usdc)
    ST-->>ME: Transfer approved USDC funds
    
    %% Tranche release
    Scholar->>WebApp: Request milestone disbursement
    API->>ME: Invoke release_tranche(milestone_id)
    Note over ME: Checks that off-chain audit verified milestone
    ME-->>Scholar: Disburse USDC tranche to scholar wallet
```

---

### 3. Scholar NFT Issuance
Issued automatically as a Soulbound credential upon complete verification of all milestones within a funded scholarship program.

```mermaid
sequenceDiagram
    autonumber
    actor Scholar
    participant API as Express API
    participant ME as MilestoneEscrow (Soroban)
    participant SN as ScholarNFT (Soroban)

    Scholar->>ME: Claim final milestone tranche
    ME->>SN: Invoke mint_credential(scholar_address, course_id, metadata_ipfs_uri)
    Note over SN: Enforces that caller is authorized MilestoneEscrow
    SN-->>Scholar: Transfer Soulbound NFT (Token ID registered)
    SN-->>API: Emit ScholarNFTMinted event
    API->>Scholar: Expose NFT in digital profile
```

---

## Admin Authority Model

To guarantee the security of funds and system configurations, the LearnVault Soroban smart contracts enforce a rigid two-phased authority model:

### V1 Multi-Sig Authority (Bootstrap Phase)
In the initial release (V1), administrative authority is centralized under the founding team's multi-sig wallet:

*   **Authentication Check**: Critical admin functions (such as `add_course` in `CourseMilestone` or `upgrade` in all core contracts) are guarded by Soroban's native `require_auth()` signature verification.
*   **Signature Verification**: The contracts store the authorized `admin` address. During execution, `require_auth()` checks that the transaction caller matches this address, resolving signatures through whatever N-of-M multi-signature rule the admin account enforces.
*   **Upgrade Capability**: Admin keys can call `upgrade(new_wasm_hash)` to replace contract executable bytes in-place. Storage configurations are preserved.

### V2 Decentralized Governance (DAO Phase)
Once the platform stabilizes, upgrade keys and administrative roles will be securely transferred to a decentralized governance contract:

1.  **Ownership Handover**: The stored contract `admin` addresses are updated from the founding multi-sig to the address of the `ScholarshipTreasury` or a dedicated DAO Governor contract.
2.  **DAO Enforced Actions**: Any subsequent configuration change or contract upgrade can *only* execute if it passes a formal GOV token holder vote and traverses the mandatory `UpgradeTimelockVault` timelock period (default 48 hours), neutralizing unauthorized administrator risks.

---

## Deployed Contract Addresses

Below are the official contract hash allocations deployed per environment.

### Testnet Addresses

| Contract | Soroban Contract ID | Description |
| :--- | :--- | :--- |
| **`LearnToken`** | `CB2X...3K5P` *(Placeholder)* | Soulbound LRN reputation tracker |
| **`GovernanceToken`** | `CD5W...7M8A` *(Placeholder)* | Transferable GOV voting token |
| **`CourseMilestone`** | `CA9X...1J2B` *(Placeholder)* | Off-chain checkpoint registrar |
| **`ScholarshipTreasury`** | `CC4K...9R3F` *(Placeholder)* | Fund escrow creator & DAO vault |
| **`MilestoneEscrow`** | `CB8Y...2T6V` *(Placeholder)* | Relays USD disbursements |
| **`ScholarNFT`** | `CD2U...4M1Z` *(Placeholder)* | Soulbound achievement credentials |
| **`UpgradeTimelockVault`** | `CA1L...5H9Q` *(Placeholder)* | Secures V2 upgrade timelines |

### Mainnet Addresses

> [!WARNING]
> No mainnet deployment has been performed yet. Contract hashes will be updated here during the production release window.

| Contract | Soroban Contract ID | Status |
| :--- | :--- | :--- |
| **`LearnToken`** | — | Pending Release |
| **`GovernanceToken`** | — | Pending Release |
| **`CourseMilestone`** | — | Pending Release |
| **`ScholarshipTreasury`** | — | Pending Release |
| **`MilestoneEscrow`** | — | Pending Release |
| **`ScholarNFT`** | — | Pending Release |
| **`UpgradeTimelockVault`** | — | Pending Release |
