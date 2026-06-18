# C4 Level 2: Container Diagram

This document details the containers that make up the **LearnVault** platform. It illustrates the high-level technical architecture, tech stack, and communications protocols.

## Diagram

```mermaid
graph TB
    %% Define Actors
    Learner[/"Learner / Scholar<br>(Browser / Wallet)"/]
    Donor[/"Donor / Sponsor<br>(Browser / Wallet)"/]

    subgraph LearnVaultSystem ["LearnVault Technical Containers"]
        %% Containers
        Frontend["React Web Application<br>(Vite, TypeScript, Tailwind)<br><br>Provides user dashboards, course viewing, quiz taking, proposal creation, and wallet integration."]
        
        Backend["Express Backend API<br>(Node.js, TypeScript)<br><br>Exposes REST APIs, manages course content, orchestrates quiz verification, and monitors on-chain events."]
        
        DB[("PostgreSQL Database<br>(Relational Storage)<br><br>Stores course records, lessons, quizzes, milestone reports, governance proposals, platform event logs, and user profile data.")]
        
        Redis[("Redis Cache<br>(In-Memory Key-Value)<br><br>Caches session states, API endpoints, rate-limiting counters, and event indexer checkpoint offsets.")]
    end

    subgraph ExternalContainers ["External Infrastructure"]
        StellarRpc["Stellar Horizon & RPC Nodes<br>(JSON-RPC & Horizon REST)<br><br>Standard gateway to read ledger states and submit Soroban transactions."]
        
        Contracts["Soroban Smart Contracts<br>(Rust / WASM)<br><br>Core business logic for LearnToken, GovernanceToken, MilestoneEscrow, and ScholarshipTreasury."]
        
        IPFS["IPFS Storage Node / Gateway<br>(Decentralized storage)<br><br>Hosts course media assets, markdown, milestone evidence, and ScholarNFT metadata."]
    end

    %% Communication Flows
    Learner -->|HTTPS / JSON / WSS| Frontend
    Donor -->|HTTPS / JSON / WSS| Frontend

    %% Wallet flows
    Learner -.->|signs transactions via Freighter/Albedo| StellarRpc
    Donor -.->|signs transactions via Freighter/Albedo| StellarRpc

    Frontend -->|HTTPS / REST API| Backend
    
    Backend -->|SQL / TCP| DB
    Backend -->|Redis Protocol / TCP| Redis
    Backend -->|JSON-RPC / HTTPS| StellarRpc
    Backend -->|IPFS API / HTTPS Pinning| IPFS
    
    StellarRpc -->|Invokes WASM| Contracts
    Frontend -->|HTTPS| IPFS
    
    classDef actor fill:#1c7ed6,stroke:#1098ad,stroke-width:2px,color:#fff;
    classDef container fill:#2b8a3e,stroke:#2f9e44,stroke-width:2px,color:#fff;
    classDef database fill:#1098ad,stroke:#0b7285,stroke-width:2px,color:#fff;
    classDef external fill:#e67e22,stroke:#d35400,stroke-width:2px,color:#fff;

    class Learner,Donor actor;
    class Frontend,Backend container;
    class DB,Redis database;
    class StellarRpc,Contracts,IPFS external;
```

## Container Specifications

| Container | Technology Stack | Purpose | Data Persistence |
| :--- | :--- | :--- | :--- |
| **React Web Application** | React, Vite, TypeScript, Vanilla CSS, Stellar SDK (Freighter / Albedo) | Serves the interactive user interface. Enables donors to deposit funds and scholars to enroll in courses, upload coursework, and interact with the DAO governance module. | Ephemeral browser storage (LocalSession / Redux cache) |
| **Express Backend API** | Node.js, Express, TypeScript, Knex.js | Serves core RESTful endpoints, parses coursework uploads, processes course enrollments, coordinates IPFS pinning, and executes background event-indexing tasks. | Stateless |
| **PostgreSQL Database** | PostgreSQL v15+ | Acts as the primary transactional datastore for all course layouts, learner profiles, audits, comments, local proposals, votes, and event index logs. | Persistent Relational Storage (Volume mapped) |
| **Redis Cache** | Redis v7+ | Accelerates session management, rate limits high-frequency endpoints, caches heavy aggregation queries, and tracks indexing process milestones. | In-Memory (Optional snapshotting) |
| **Soroban Smart Contracts** | Rust, Soroban SDK | Enforces trustless token economics, holds escrows, verifies milestone completions, issues credentials, and secures governance voting power on-chain. | Persistent Stellar Ledger State |
| **IPFS Storage** | Pinata / IPFS Gateways | Decentralized directory structure for binary materials, cover pictures, and JSON schemas representing Soulbound NFT credentials. | Distributed, content-addressed storage |
