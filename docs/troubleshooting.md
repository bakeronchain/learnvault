# Troubleshooting Guide

Common developer issues and fast recovery steps for LearnVault.

## 1) Wallet Connection Fails

### Symptoms

- Wallet modal does not open.
- Connection rejected or stays in loading state.
- Connected account is on wrong network.

### Fix

1. Confirm wallet extension/app is unlocked and approved for the current site.
2. Verify frontend Stellar env values:
   - `PUBLIC_STELLAR_NETWORK`
   - `PUBLIC_STELLAR_NETWORK_PASSPHRASE`
   - `PUBLIC_STELLAR_RPC_URL`
3. Ensure wallet network matches app network (`local`/`testnet`/`mainnet`).
4. Restart frontend dev server after env changes.

## 2) Contract Call Fails with Sequence Number Error

### Symptoms

- Transaction submission fails with sequence mismatch/stale sequence.

### Fix

1. Retry once after refreshing account state from Horizon/RPC.
2. Avoid concurrent submissions from the same signer key.
3. If using backend signer (`STELLAR_SECRET_KEY`), make sure only one process is
   sending transactions with that key.
4. Reinitialize signer/session if nonce or sequence cache looks stale.

## 3) IPFS Upload Timeout

### Symptoms

- Upload endpoints hang or return timeout.
- Upload succeeds sometimes but not consistently.

### Fix

1. Validate `PINATA_API_KEY` and `PINATA_SECRET`.
2. Confirm Pinata account/API key is active and has sufficient quota.
3. Test connectivity to Pinata from your runtime environment.
4. If using dedicated gateway, verify `IPFS_GATEWAY_URL`/`VITE_IPFS_GATEWAY_URL`
   are valid and reachable.
5. Retry with a smaller file to isolate payload-size/network issues.

## 4) Local Database Migration Errors

### Symptoms

- `npm run migrate` fails in `server`.
- Schema mismatch or "relation already exists/does not exist" errors.

### Fix

1. Verify `DATABASE_URL` points to the intended local database.
2. Ensure Postgres service is running and accessible.
3. Run migration verification:

```bash
cd server
npm run migrate:verify
```

4. Inspect migration order and check for partial/failed previous runs.
5. For local-only environments, recreate the DB and rerun migrations if state is
   corrupted.

## 5) JWT Errors in Development

### Symptoms

- `401`/`403` for endpoints requiring admin/user JWT.
- "Invalid signature", "jwt malformed", or missing key errors.

### Fix

1. In dev, ensure one of these auth setups is correct:
   - RS256 keys: `JWT_PRIVATE_KEY` + `JWT_PUBLIC_KEY`
   - Dev fallback secret (if route supports it): `JWT_SECRET`
2. Restart backend after changing env values.
3. Confirm tokens are generated with matching algorithm/key pair.
4. In production, do not rely on fallback secret behavior.

## 6) Frontend Build Fails (TypeScript Errors)

### Symptoms

- `npm run build` or `npm run typecheck` fails with TS diagnostics.

### Fix

1. Install dependencies cleanly:

```bash
npm ci --legacy-peer-deps
```

2. Run type checking directly to isolate:

```bash
npm run typecheck
```

3. Fix strict type errors before build (do not suppress with `any` unless justified).
4. Ensure generated clients/packages are up to date if contract interfaces changed.

## 7) Soroban Contract Compilation Errors

### Symptoms

- `cargo build` fails for `wasm32v1-none`.
- Missing target/toolchain or crate feature incompatibility.

### Fix

1. Ensure Rust target is installed:

```bash
rustup target add wasm32v1-none
```

2. Build from repo root:

```bash
cargo build --target wasm32v1-none --release
```

3. Confirm Rust toolchain version matches project expectation.
4. Resolve clippy/fmt issues if CI enforces them:

```bash
cargo clippy -- -D warnings
cargo fmt --check
```

## 8) CI Pipeline Fails

### Symptoms

- GitHub Actions job fails on lint/test/build/migration steps.

### Fix

1. Open failed workflow logs and identify first failing step.
2. Reproduce locally with the same command.
3. Common local reproductions:

```bash
npm run lint
npx prettier . --check
npm run build
npm run test:frontend
npm run test:e2e
cd server && npm test
```

4. If DB-related CI job fails, run migrations locally before tests.
5. If contract CI fails, run `cargo test --workspace` and `cargo build --target wasm32v1-none --release`.

## Fast Diagnostic Checklist

- [ ] Correct `.env` values loaded in frontend and server.
- [ ] Network and contract IDs point to the same environment.
- [ ] Postgres reachable and migrations current.
- [ ] Stellar signer/key and RPC endpoint valid.
- [ ] Local tests pass before pushing.
