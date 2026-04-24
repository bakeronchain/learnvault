# Production Environment Variables

This guide documents environment variables used by LearnVault across frontend,
backend, contracts, and infrastructure. Use it as a deployment checklist for
`dev`, `staging`, and `prod`.

## Environment Matrix

- `dev`: local development with disposable keys and permissive defaults.
- `staging`: production-like config with isolated wallets and services.
- `prod`: real infrastructure, funded wallets, and secrets managed in CI/Vault.

## Variable Reference

### Core Runtime

| Variable | Required | Env scope | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | yes (server) | dev/staging/prod | Node runtime mode (`development`, `test`, `production`). |
| `PORT` | yes (server) | dev/staging/prod | Backend server port. |
| `FRONTEND_URL` | yes | dev/staging/prod | Canonical frontend origin for CORS and links in emails. |
| `VITE_API_URL` | yes (frontend) | dev/staging/prod | Base URL used by frontend API calls. |
| `VITE_API_BASE_URL` | optional | dev/staging/prod | API prefix used by some frontend pages. |
| `VITE_SERVER_URL` | optional legacy | dev/staging/prod | Backward-compatible server URL alias. |

### Database and Cache

| Variable | Required | Env scope | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | dev/staging/prod | Postgres connection string used by API and migration scripts. |
| `REDIS_URL` | optional | dev/staging/prod | Redis endpoint for rate limiting / nonce state. |

### Auth and Admin

| Variable | Required | Env scope | Description |
| --- | --- | --- | --- |
| `JWT_PRIVATE_KEY` | yes in staging/prod | dev/staging/prod | RSA private key for JWT signing. |
| `JWT_PUBLIC_KEY` | yes in staging/prod | dev/staging/prod | RSA public key for JWT verification. |
| `JWT_SECRET` | legacy/dev fallback | dev | Legacy shared-secret mode for tests or local-only auth. |
| `ADMIN_ADDRESSES` | recommended | dev/staging/prod | Comma-separated Stellar addresses allowed to perform admin actions. |
| `ADMIN_API_KEY` | recommended | dev/staging/prod | Extra API key guard for admin endpoints. |
| `MAX_COMMENTS_PER_DAY` | optional | dev/staging/prod | Spam/rate-control limit for comments. |

### Stellar / Soroban Network

| Variable | Required | Env scope | Description |
| --- | --- | --- | --- |
| `STELLAR_NETWORK` | yes | dev/staging/prod | Target network (`local`, `testnet`, `mainnet`). |
| `SOROBAN_RPC_URL` | yes | dev/staging/prod | Soroban RPC endpoint used by workers and contract services. |
| `PUBLIC_STELLAR_NETWORK` | yes (frontend) | dev/staging/prod | Frontend network selector. |
| `PUBLIC_STELLAR_NETWORK_PASSPHRASE` | yes (frontend) | dev/staging/prod | Network passphrase for frontend contract operations. |
| `PUBLIC_STELLAR_RPC_URL` | yes (frontend) | dev/staging/prod | Frontend Soroban RPC endpoint. |
| `PUBLIC_STELLAR_HORIZON_URL` | yes (frontend) | dev/staging/prod | Frontend Horizon endpoint. |
| `STELLAR_SECRET_KEY` | yes for on-chain writes | staging/prod | Signing key used for backend contract submissions. |

### Contract IDs

Set both frontend (`VITE_*`) and backend contract IDs consistently:

- `LEARN_TOKEN_CONTRACT_ID` / `VITE_LEARN_TOKEN_CONTRACT_ID`
- `GOVERNANCE_TOKEN_CONTRACT_ID` / `VITE_GOVERNANCE_TOKEN_CONTRACT_ID`
- `COURSE_MILESTONE_CONTRACT_ID` / `VITE_COURSE_MILESTONE_CONTRACT_ID`
- `SCHOLARSHIP_TREASURY_CONTRACT_ID` / `VITE_SCHOLARSHIP_TREASURY_CONTRACT_ID`
- `MILESTONE_ESCROW_CONTRACT_ID` / `VITE_MILESTONE_ESCROW_CONTRACT_ID`
- `SCHOLAR_NFT_CONTRACT_ID` / `VITE_SCHOLAR_NFT_CONTRACT_ID`
- `PUBLIC_*` legacy aliases still used by some frontend modules.

### Event and Worker Settings

| Variable | Required | Env scope | Description |
| --- | --- | --- | --- |
| `STARTING_LEDGER` | recommended | dev/staging/prod | Initial ledger height for event indexer replay. |
| `POLL_INTERVAL_MS` | optional | dev/staging/prod | Poll interval for on-chain event workers. |
| `ESCROW_TIMEOUT_CRON_INTERVAL_MS` | optional | dev/staging/prod | Scheduler interval for escrow timeout worker. |

### IPFS / Pinata

| Variable | Required | Env scope | Description |
| --- | --- | --- | --- |
| `PINATA_API_KEY` | yes for uploads | dev/staging/prod | Pinata API key for file pinning. |
| `PINATA_SECRET` | yes for uploads | dev/staging/prod | Pinata API secret for file pinning. |
| `IPFS_GATEWAY_URL` | optional | dev/staging/prod | Gateway override for public IPFS URLs. |
| `VITE_IPFS_GATEWAY_URL` | optional | dev/staging/prod | Frontend display gateway override. |

### Email Delivery

| Variable | Required | Env scope | Description |
| --- | --- | --- | --- |
| `RESEND_API_KEY` | one provider required | dev/staging/prod | Resend API key (preferred provider path in server code). |
| `EMAIL_API_KEY` | optional alt provider | dev/staging/prod | SendGrid API key (legacy/fallback path). |
| `EMAIL_FROM` | yes when email enabled | dev/staging/prod | Sender address used in outbound messages. |
| `ADMIN_EMAILS` | optional | dev/staging/prod | Comma-separated admin recipients for notifications. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | optional alt path | dev/staging/prod | SMTP transport settings for utility mailer path. |

### Credential Metadata

Badge CID values used by credential metadata endpoints:

- `BADGE_CID_STELLAR`
- `BADGE_CID_SOROBAN`
- `BADGE_CID_DEFI`
- `BADGE_CID_BASE`

## Secrets Management Rules

Mark these as **secrets in CI** (never committed to git):

- `DATABASE_URL` (production instances)
- `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`
- `STELLAR_SECRET_KEY`
- `PINATA_API_KEY`, `PINATA_SECRET`
- `RESEND_API_KEY`, `EMAIL_API_KEY`
- `SMTP_PASS`
- `ADMIN_API_KEY`

Non-secret but environment-specific values (store as variables, not secrets):

- `FRONTEND_URL`, `VITE_API_URL`, `PORT`
- `STELLAR_NETWORK`, `SOROBAN_RPC_URL`
- Contract IDs, gateway URLs, polling intervals

## Key Pair Strategy

### Ephemeral (dev/staging)

Use disposable identities that can be rotated frequently.

```bash
stellar keys generate dev-server --network testnet
stellar keys address dev-server
```

- Fund with friendbot (testnet only).
- Rotate often and do not reuse for production signing.

### Production

- Use a dedicated operational wallet or multisig-controlled signer.
- Generate keys in a secure environment (HSM, secure enclave, or offline host).
- Store only encrypted/export-controlled secret material in your secret manager.
- Restrict read access to CI principals and audited operators.

## Deployment Checklist

1. Copy and reconcile values from `.env.example` and `server/.env.example`.
2. Inject environment-specific values into deployment platform secrets.
3. Verify `staging` connectivity (DB, RPC, IPFS, email provider).
4. Confirm contract IDs map to the intended network.
5. Run migrations and smoke tests before promoting to `prod`.
