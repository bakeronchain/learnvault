# LearnVault Deployment & Migration Runbook

This document is the official operational guide for deploying the **LearnVault** platform to both Stellar Testnet and Mainnet.

---

## 1. Prerequisites & Infrastructure Setup

Before initiating any deployment command, ensure the following local tools, network accounts, and access keys are ready:

### Tooling Requirements
*   **Stellar CLI**: Installed (version `v21.0.0` or newer). Check with:
    ```bash
    stellar --version
    ```
*   **Rust & Cargo**: Toolchain `1.75.0` or newer configured with the WebAssembly compilation target:
    ```bash
    rustup target add wasm32-unknown-unknown
    ```
*   **Node.js**: Long-Term Support (LTS) release (v18.0.0 or v20.0.0) with NPM.
*   **Postgres & Redis**: Active servers running locally or mapped via production environment Docker containers.

### Secret Management & Keys
*   **Deployment Signer Secret Key**: A Stellar secret key containing sufficient native XLM to cover fee/reserve limits for contract deployments.
*   **Admin Multi-Sig / Governance Address**: The public Stellar ID of the multi-signature wallet designated to manage upgrades.
*   **External Service Tokens**: APIs for IPFS file uploads (Pinata JWT token) and transaction email relays (Sendgrid API key).

---

## 2. Smart Contract Deployment Sequence

Due to cross-contract structural dependencies, contracts *must* be compiled, deployed, and initialized in the specific sequence below.

```
                  ┌──────────────┐      ┌─────────────────┐
                  │  LearnToken  │      │ GovernanceToken │
                  └──────┬───────┘      └────────┬────────┘
                         │                       │
 ┌─────────────┐  ┌──────▼──────────┐   ┌────────▼───────────┐
 │ ScholarNFT  │  │ CourseMilestone │   │ScholarshipTreasury │
 └──────┬──────┘  └─────────────────┘   └────────┬───────────┘
        │                                        │
        └───────────────┐ ┌──────────────────────┘
                        ▼ ▼
               ┌──────────────────┐
               │ MilestoneEscrow  │
               └──────────────────┘
```

### Compiling WASM Artifacts
Run the workspace build script from the repository root:
```bash
cargo build --target wasm32-unknown-unknown --release
```
Optimized WASM blobs will be located in the `target/wasm32-unknown-unknown/release/` directory.

### Step 1: Deploy & Initialize Token & NFT Engines
Deploy the independent core contracts to capture their generated Soroban Contract IDs.

1.  **`LearnToken` (LRN)**:
    ```bash
    stellar contract deploy \
      --network testnet \
      --source DEPLOYER_KEY \
      --wasm target/wasm32-unknown-unknown/release/learn_token.wasm
    ```
    Initialize with the admin account ID:
    ```bash
    stellar contract invoke \
      --network testnet --source DEPLOYER_KEY --id <LEARN_TOKEN_ID> -- \
      initialize --admin <ADMIN_ADDRESS>
    ```

2.  **`GovernanceToken` (GOV)**:
    ```bash
    stellar contract deploy \
      --network testnet \
      --source DEPLOYER_KEY \
      --wasm target/wasm32-unknown-unknown/release/governance_token.wasm
    ```
    Initialize GOV:
    ```bash
    stellar contract invoke \
      --network testnet --source DEPLOYER_KEY --id <GOV_TOKEN_ID> -- \
      initialize --admin <ADMIN_ADDRESS>
    ```

3.  **`ScholarNFT`**:
    ```bash
    stellar contract deploy \
      --network testnet \
      --source DEPLOYER_KEY \
      --wasm target/wasm32-unknown-unknown/release/scholar_nft.wasm
    ```
    Initialize NFT:
    ```bash
    stellar contract invoke \
      --network testnet --source DEPLOYER_KEY --id <SCHOLAR_NFT_ID> -- \
      initialize --admin <ADMIN_ADDRESS>
    ```

4.  **`UpgradeTimelockVault`**:
    ```bash
    stellar contract deploy \
      --network testnet \
      --source DEPLOYER_KEY \
      --wasm target/wasm32-unknown-unknown/release/upgrade_timelock_vault.wasm
    ```
    Initialize Vault:
    ```bash
    stellar contract invoke \
      --network testnet --source DEPLOYER_KEY --id <TIMELOCK_VAULT_ID> -- \
      initialize --admin <ADMIN_ADDRESS> --timelock_duration 172800
    ```

### Step 2: Deploy Dependent Logic Core
5.  **`CourseMilestone`** (Requires `LearnToken` ID):
    ```bash
    stellar contract deploy \
      --network testnet \
      --source DEPLOYER_KEY \
      --wasm target/wasm32-unknown-unknown/release/course_milestone.wasm
    ```
    Initialize referencing LRN:
    ```bash
    stellar contract invoke \
      --network testnet --source DEPLOYER_KEY --id <COURSE_MILESTONE_ID> -- \
      initialize --admin <ADMIN_ADDRESS> --learn_token <LEARN_TOKEN_ID>
    ```

6.  **`ScholarshipTreasury`** (Requires `GovernanceToken` ID):
    ```bash
    stellar contract deploy \
      --network testnet \
      --source DEPLOYER_KEY \
      --wasm target/wasm32-unknown-unknown/release/scholarship_treasury.wasm
    ```
    Initialize referencing GOV:
    ```bash
    stellar contract invoke \
      --network testnet --source DEPLOYER_KEY --id <TREASURY_ID> -- \
      initialize --admin <ADMIN_ADDRESS> --gov_token <GOV_TOKEN_ID>
    ```

7.  **`MilestoneEscrow`** (Requires `ScholarshipTreasury` and `ScholarNFT` IDs):
    ```bash
    stellar contract deploy \
      --network testnet \
      --source DEPLOYER_KEY \
      --wasm target/wasm32-unknown-unknown/release/milestone_escrow.wasm
    ```
    Initialize:
    ```bash
    stellar contract invoke \
      --network testnet --source DEPLOYER_KEY --id <ESCROW_ID> -- \
      initialize --treasury <TREASURY_ID> --scholar_nft <SCHOLAR_NFT_ID>
    ```

---

## 3. Database Migration Runbook

Database schemas are managed using SQL migrations executed by the backend container process.

### Dry-run validation
Check migration files status locally before submitting schemas to production:
```bash
cd server
npm run db:migrate:status
```

### Apply Migrations
Apply migrations up to the current level:
```bash
npm run db:migrate:latest
```

### Seeding Course Templates
Inject default courses, lessons, and quiz questions into the fresh database:
```bash
npm run db:seed
```

---

## 4. Environment Variables Checklist

Update the production Express server `.env` config with the deployed hashes:

```env
# Server System Configuration
PORT=4000
NODE_ENV=production
DATABASE_URL=postgres://user:password@db-host:5432/learnvault
REDIS_URL=redis://redis-host:6379

# Cryptographic Keys
JWT_SECRET=super_secret_jwt_sign_key_change_in_production
SESSION_SECRET=high_entropy_cookie_session_secret

# Stellar Network Configurations
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org:443
STELLAR_ADMIN_SECRET=SA5X...DEPL_KEY_FOR_SERVER_CALLS

# Deployed Soroban Contract IDs
CONTRACT_LEARN_TOKEN=<LEARN_TOKEN_ID>
CONTRACT_GOV_TOKEN=<GOV_TOKEN_ID>
CONTRACT_COURSE_MILESTONE=<COURSE_MILESTONE_ID>
CONTRACT_SCHOLARSHIP_TREASURY=<TREASURY_ID>
CONTRACT_MILESTONE_ESCROW=<ESCROW_ID>
CONTRACT_SCHOLAR_NFT=<SCHOLAR_NFT_ID>
CONTRACT_TIMELOCK_VAULT=<TIMELOCK_VAULT_ID>

# Decentrailized Storage & Mail Integrations
PINATA_JWT=ey...ipfs_api_key_jwt
IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
SENDGRID_API_KEY=SG.your_sendgrid_key_string
SYSTEM_EMAIL=no-reply@learnvault.academy
```

---

## 5. Post-Deployment Verification

Execute these verification checks immediately following deployment to confirm the system's operational integrity:

1.  **Server Health Check**:
    ```bash
    curl -i https://your-domain.com/api/health
    ```
    Confirm that `db` and `redis` connections show `healthy: true` inside the returned payload.
2.  **Verify Contract IDs on Block Explorer**: Search the contract IDs on `stellar.expert` (Testnet) to confirm deployment status.
3.  **Event Indexer Sweep Validation**: Check the Express API logs to ensure the indexing daemon has established connection to the Stellar RPC node and has created checkpoint offsets:
    ```bash
    npm run indexer:check
    ```

---

## 6. Rollback Procedures

If issues are detected post-deployment, execute the appropriate rollback protocols:

### Database Schema Rollback
To undo the last migration step:
```bash
npm run db:migrate:rollback
```
*Alternatively*, you can run the undo scripts directly via the psql client using the corresponding `.undo.sql` scripts located in `server/src/db/migrations/`.

### Smart Contract Hot-Fix Rollback
Soroban smart contracts are upgradeable in place. There is no need to tear down or redeploy contract instances. If a bug is detected:

1.  Locate the previous stable WASM artifact hash (available in Git tags or deployment archives).
2.  Prepare the rollback transaction calling `upgrade()` on the target contract, pointing back to the previous stable WASM hash:
    ```bash
    stellar contract invoke \
      --network testnet \
      --source DEPLOYER_KEY \
      --id <DEPLOYED_CONTRACT_ID> \
      -- \
      upgrade --new_wasm_hash <STABLE_PREVIOUS_WASM_HASH>
    ```
3.  Submit the transaction. Verify state integrity via reading static storage slots.
