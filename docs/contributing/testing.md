# Testing Strategy

This document defines LearnVault's testing pyramid, tooling, and CI expectations.

## Testing Pyramid

### 1) Unit Tests (fast, high volume)

- Scope: isolated functions/components/contracts.
- Tools:
  - Rust contracts: `cargo test --workspace`
  - Frontend/unit: `vitest`
  - Server unit/API handlers: `jest` (under `server`)

### 2) Integration Tests (service and contract boundaries)

- Scope: backend + database + contract client integration.
- Validates migrations, DB I/O, auth middleware, and contract service adapters.
- Run primarily from `server` test suite and migration verification scripts.

### 3) End-to-End Tests (user journeys)

- Scope: browser-based critical paths.
- Tool: Playwright (`e2e` directory).
- Uses preview build in CI via `playwright.config.ts` web server.

### 4) Contract Tests (on-chain behavior)

- Scope: Soroban contract logic, invariants, and event behavior.
- Tooling: Rust test framework plus optional ignored fuzz tests.
- Includes workspace-level tests and dedicated contract CI workflows.

## How to Run Each Suite

From repository root:

```bash
# Contracts (workspace)
npm run test

# Frontend unit/integration-style tests
npm run test:frontend

# E2E browser tests
npm run test:e2e

# Frontend + contract coverage report (frontend coverage command shown)
npm run test:coverage
```

From `server/` directory:

```bash
# Server tests
npm test

# Database migrations
npm run migrate
npm run migrate:verify
```

## Coverage Targets

Set minimum targets per layer:

- Contracts (Rust): >= 90% on critical contract modules.
- Server/API: >= 80% branch coverage on controllers/middleware/services.
- Frontend: >= 75% branch coverage on core user flows.
- E2E: 100% of critical path scenarios (connect wallet, submit milestone, review, treasury/governance actions).

PRs that reduce critical-path coverage should include justification and follow-up.

## Mocking Strategy for Stellar Contracts

Use a layered strategy:

- **Unit level**: mock contract client wrappers and RPC adapters.
- **Server integration**: stub transaction submission at service boundaries while
  preserving payload validation and auth checks.
- **Contract level**: prefer real Rust contract tests for business invariants.
- **E2E level**: avoid deep chain mocks; run against stable test network fixtures
  or deterministic local network where possible.

Guidelines:

- Mock only network transport, not domain rules.
- Keep fixture data deterministic and versioned.
- Validate event payload shape in tests when upgrades touch contract events.

## Writing New E2E Tests

1. Add spec file under `e2e/` with clear journey-based naming.
2. Cover one user intent per test (avoid giant multi-purpose specs).
3. Use robust selectors (role/text/test IDs), not fragile CSS chains.
4. Assert both success and expected failure/validation states.
5. Keep tests independent; no hidden ordering dependencies.

Run locally:

```bash
npm run test:e2e
```

Debug mode:

```bash
npx playwright test --debug
```

## Local Testnet Setup for Integration Tests

Use local or testnet config depending on test scope:

1. Set network env (`STELLAR_NETWORK`, `SOROBAN_RPC_URL`).
2. Provide contract IDs in `.env` and `server/.env`.
3. Ensure backend signer key (`STELLAR_SECRET_KEY`) is available for write-path tests.
4. Run DB services and migrations before API integration tests.
5. Seed deterministic test data if scenario requires historical state.

Minimum backend setup:

```bash
cd server
npm ci
npm run migrate
npm test
```

## CI Test Matrix

Current workflows execute tests by concern:

- `build.yml`: lint, format, build, workspace tests.
- `contracts-ci.yml` and `contracts.yml`: contract build/test/clippy/fmt paths.
- `server-ci.yml` and `backend-tests.yml`: Postgres-backed server tests + migrations.
- `frontend-ci.yml`: typecheck, lint, frontend tests, build.
- `e2e.yml`: Playwright journey tests on pull requests.

Recommended PR checklist:

- [ ] Relevant local test suites pass before push.
- [ ] CI jobs for touched area are green.
- [ ] Any skipped tests have explicit rationale in PR description.
