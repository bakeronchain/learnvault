# C4 Level 1: System Context Diagram

This document describes the high-level system context for the **LearnVault** platform. It illustrates the primary actors, the core system boundaries, and external dependencies.

## Diagram

```mermaid
graph TD
    %% Define Actors
    Learner[/"Learner / Scholar<br>(User)"/]
    Donor[/"Donor / Sponsor<br>(User)"/]

    %% Define Core System
    subgraph LearnVaultSystem ["LearnVault Platform"]
        WebApp["LearnVault Web App<br>(React Frontend & Express Backend)"]
    end

    %% Define External Systems
    Stellar["Stellar Network<br>(Soroban Smart Contracts & Ledger)"]
    IPFS["IPFS Storage<br>(Decentralized Assets & Metadata)"]

    %% Define Relationships
    Learner -->|1. Enroll & study courses<br>2. Complete quizzes<br>3. Submit milestone evidence| WebApp
    Learner -->|4. Signs transactions / claims awards| Stellar
    
    Donor -->|1. View scholarship proposals<br>2. Commit USDC funds<br>3. Vote on allocations| WebApp
    Donor -->|4. Signs transaction signatures| Stellar

    WebApp -->|5. Index contract events<br>6. Query token balances & escrows| Stellar
    WebApp -->|7. Pin milestone evidence & NFT metadata| IPFS
    WebApp -->|8. Fetch course assets & lesson markdown| IPFS

    Stellar -.->|9. Emits contract events| WebApp
    IPFS -.->|10. Serves static media & verified proof assets| WebApp
    
    classDef actor fill:#1c7ed6,stroke:#1098ad,stroke-width:2px,color:#fff;
    classDef system fill:#2b8a3e,stroke:#2f9e44,stroke-width:2px,color:#fff;
    classDef external fill:#e67e22,stroke:#d35400,stroke-width:2px,color:#fff;

    class Learner,Donor actor;
    class WebApp system;
    class Stellar,IPFS external;
```

## System Boundaries & Roles

### Actors (Users)
*   **Learner / Scholar**: Completes courses, completes quizzes, submits milestone completion reports for review, earns reputation tokens (LRN), and receives scholarship distributions.
*   **Donor / Sponsor**: Funds scholarships with USDC, receives governance voting tokens (GOV), and votes on student scholarship proposals and milestone reviews.

### Core System
*   **LearnVault Web App**: The central user interface and coordinating API backend. It handles learner progress, course catalogs, quiz validation, and triggers the on-chain operations.

### External Systems
*   **Stellar Network**: The secure layer of execution. Soroban smart contracts track the reputation tokens (LRN), manage scholarship escrow accounts, distribute tranches on milestone verification, and govern proposal votes.
*   **IPFS (InterPlanetary File System)**: Decentralized storage for lesson content, course media cover assets, submitted milestone evidence files, and the metadata definitions for scholar credential NFTs.
