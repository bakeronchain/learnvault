# Contributing to LearnVault

Welcome — and thank you for wanting to contribute! 🎉

LearnVault is an open-source, learn-and-earn platform built for African learners
on the Stellar blockchain. Whether you're a smart-contract engineer, a frontend
developer, a technical writer, or a designer, there is room for you here. This
guide will get you from zero to your first pull request.

---

## Table of Contents

- [Contributing to LearnVault](#contributing-to-learnvault)
  - [Table of Contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Clone and Install](#clone-and-install)
  - [Run the Frontend (No Blockchain Required)](#run-the-frontend-no-blockchain-required)
  - [Run Contract Tests](#run-contract-tests)
  - [Start Full Dev Environment (Requires Docker)](#start-full-dev-environment-requires-docker)
  - [Project Structure](#project-structure)
  - [How to Pick an Issue](#how-to-pick-an-issue)
  - [Branching and PR Workflow](#branching-and-pr-workflow)
    - [1. Create a branch](#1-create-a-branch)
    - [2. Make your changes](#2-make-your-changes)
    - [3. Open a pull request](#3-open-a-pull-request)
    - [PR Checklist](#pr-checklist)
  - [Code Style](#code-style)
    - [TypeScript / Frontend](#typescript--frontend)
    - [Rust / Smart Contracts](#rust--smart-contracts)
  - [Commit Messages](#commit-messages)
  - [Need Help?](#need-help)
  - [Code of Conduct](#code-of-conduct)

---

## Prerequisites

Make sure the following tools are installed on your machine before you begin:

| Tool          | Minimum Version | Purpose                                                              |
| ------------- | --------------- | -------------------------------------------------------------------- |
| **Node.js**   | 20+             | Frontend build tooling and dev server                                |
| **npm**       | 10+             | Package management (ships with Node.js)                              |
| **Rust**      | 1.89+           | Compiling Soroban smart contracts (pinned via `rust-toolchain.toml`) |
| **Docker**    | Latest stable   | Running a local Stellar node for full end-to-end development         |
| **Freighter** | Latest          | Stellar wallet browser extension for testing wallet interactions     |

> [!TIP] **First-time Rust setup?** After installing Rust via
> [rustup](https://rustup.rs/), the project's `rust-toolchain.toml` will
> automatically install the correct toolchain (channel `1.89.0`) and the
> `wasm32v1-none` target the first time you build.

> [!NOTE] **Frontend-only contributors** — you can skip Rust and Docker
> entirely. The frontend compiles and runs independently; see the section below.

---

## Clone and Install

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/<your-username>/learnvault.git
cd learnvault

# 2. Install Node.js dependencies
npm install

# 3. Copy the example environment file and adjust if needed
cp .env.example .env
```

The `.env.example` ships with defaults for a **local Stellar network**. If you
want to develop against the public testnet instead, uncomment the `TESTNET`
block in `.env`.

### Generate Soroban Contract Clients (optional)

If you have deployed the contracts and populated contract IDs in your `.env`
file, you can generate TypeScript client packages for all six contracts:

```bash
# Generate TypeScript bindings for all deployed contracts
npm run generate:clients

# Then build the generated packages
npm run install:contracts
```

`generate:clients` runs `scripts/generate-clients.sh`, which calls
`stellar contract bindings typescript` for each contract whose ID is set in
`.env`. Any contract with a missing ID is skipped with a warning — you do not
need all six deployed to generate clients for the ones you have.

> [!TIP] **Frontend-only work?** You can skip this step entirely. The frontend
> falls back to mock data when the generated packages are absent.

---

## Run the Frontend (No Blockchain Required)

If you are working on UI components, pages, or styling, you can iterate without
a local blockchain node:

```bash
# Verify the project compiles cleanly
npm run build

# Start only the Vite dev server
npm run dev:ui
```

The app will be available at **http://localhost:5173** (default Vite port).
Hot-module replacement is enabled, so changes are reflected instantly in the
browser.

---

## Run Contract Tests

The smart contracts live in `contracts/` and are tested with `cargo test`. A
convenience npm script is provided:

```bash
npm test
```

This runs `cargo test --workspace`, which covers all six contracts:

| Contract               | Description                             |
| ---------------------- | --------------------------------------- |
| `learn_token`          | Soulbound ERC20 reputation token        |
| `governance_token`     | Transferable DAO voting token           |
| `fungible-allowlist`   | Allowlist-gated fungible token          |
| `scholarship_treasury` | Donor-funded community treasury         |
| `milestone_escrow`     | Tranche-based scholarship disbursements |
| `scholar_nft`          | Soulbound NFT credential                |

> [!IMPORTANT] You need Rust installed to run contract tests. If a test fails,
> check that your Rust toolchain matches `1.89.0` by running `rustup show`.

---

## Start Full Dev Environment (Requires Docker)

For end-to-end development with a local Stellar node and the Vite frontend
running side by side:

```bash
npm start
```

This uses `concurrently` to launch:

1. **`stellar scaffold watch --build-clients`** — starts a local Stellar node
   and watches for contract changes.
2. **`vite`** — starts the frontend dev server.

Both processes are displayed in the same terminal with color-coded prefixes
(`stellar` in gray, `vite` in green).

> [!NOTE] Make sure Docker is running before you execute `npm start`. If you see
> connection errors, verify that port `8000` is not in use by another process.

---

## Project Structure

```
learnvault/
├── contracts/              # Soroban smart contracts (Rust)
│   ├── learn_token/
│   ├── governance_token/
│   ├── fungible-allowlist/
│   ├── scholarship_treasury/
│   ├── milestone_escrow/
│   └── scholar_nft/
├── src/                    # Frontend source (React + TypeScript)
├── server/                 # Backend API (Node.js)
├── packages/               # Auto-generated contract client packages
├── scripts/                # Helper shell scripts (e.g. generate-clients.sh)
├── docs/                   # Whitepaper and documentation
├── public/                 # Static assets
├── .github/                # CI workflows, issue & PR templates
├── Cargo.toml              # Rust workspace configuration
├── package.json            # Node.js scripts and dependencies
└── vite.config.ts          # Vite build configuration
```

---

## How to Pick an Issue

1. **Browse open issues** on the
   [Issues tab](https://github.com/bakeronchain/learnvault/issues).
2. **Filter by `good first issue`** if this is your first contribution — these
   are scoped, well-described tasks designed for newcomers.
3. **Comment on the issue** to claim it before you start working. This prevents
   duplicate effort.
4. **One issue per contributor at a time.** Finish (or explicitly unclaim) your
   current issue before picking up a new one.

> [!TIP] Not sure where to start? Issues labelled `docs`, `good first issue`, or
> `frontend` are usually the most approachable. If an issue interests you but
> the scope is unclear, ask questions — the maintainers are happy to clarify.

---

## Branching and PR Workflow

### 1. Create a branch

Use one of these naming conventions:

```
feat/short-description   # New feature
fix/short-description    # Bug fix
docs/short-description   # Documentation update
refactor/short-description  # Code refactoring
test/short-description   # Adding or updating tests
```

Example:

```bash
git checkout -b feat/donor-dashboard
```

### 2. Make your changes

Write clean, well-tested code. Follow the code style guidelines below.

### 3. Open a pull request

When you're ready:

- **PR title** — should match the issue title.
- **Link the issue** — include `Closes #NNN` in the PR description so the issue
  is automatically closed when the PR merges.
- **Fill out the PR template** — the repo includes a pull request template;
  please complete every section.

### PR Checklist

Before opening your PR, make sure:

- [ ] Your branch is up to date with `main`
- [ ] The app builds without errors: `npm run build`
- [ ] Linting passes: `npm run lint`
- [ ] Formatting is correct: `npx prettier . --check`
- [ ] TypeScript compiles cleanly: `npx tsc --noEmit`
- [ ] Contract tests pass (if applicable): `npm test`
- [ ] You have added or updated tests where applicable
- [ ] The PR description links the issue with `Closes #NNN`

---

## Code Style

### TypeScript / Frontend

- **TypeScript Only** — All frontend code must be written in TypeScript. We do
  not accept JavaScript files in the codebase.
- **No `any` Type** — The use of the `any` type is prohibited. Use specific
  types, interfaces, `unknown` with type guards, or generics instead.
- **Use @stellar/design-system Components** — When building UI components, use
  components from the `@stellar/design-system` library instead of creating
  custom equivalents. This ensures visual consistency, accessibility compliance,
  and alignment with Stellar ecosystem standards.
- **Linting** — ESLint is configured via `eslint.config.js`. Run:
  ```bash
  npm run lint
  ```
- **Formatting** — Prettier is configured via the shared
  `@theahaco/ts-config/prettier` preset. Run:
  ```bash
  npx prettier . --check      # Check for formatting issues
  npm run format               # Auto-fix formatting
  ```
- **Type checking** — Ensure there are no type errors:
  ```bash
  npx tsc --noEmit
  ```

### Rust / Smart Contracts

- **Formatting** — All Rust code must be formatted with `rustfmt`:
  ```bash
  cargo fmt --all
  ```
- **Linting** — Clippy must pass with no warnings:
  ```bash
  cargo clippy --workspace --all-targets
  ```
- **Unit Tests Required** — Every pull request that touches a Soroban contract
  must include unit tests for the changed logic. Testing is critical for smart
  contracts because contract bugs can have serious consequences in a blockchain
  environment.
- **Soroban Best Practices** — Follow the official
  [Soroban documentation](https://soroban.stellar.org/docs) best practices,
  including proper error handling, efficient storage patterns, and security
  considerations.

> [!NOTE] A pre-commit hook powered by
> [Husky](https://typicode.github.io/husky/) and
> [lint-staged](https://github.com/lint-staged/lint-staged) automatically runs
> ESLint and Prettier on staged files. If the hook blocks your commit, fix the
> reported issues before committing.

---

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short summary>

# Examples:
feat: add donor contribution history page
fix: prevent double-minting of LearnTokens
docs: update CONTRIBUTING.md with PR checklist
test: add unit tests for milestone escrow release
refactor: extract wallet connection into custom hook
```

Keep the summary under 72 characters. Use the imperative mood ("add", not
"added").

---

## Need Help?

If you run into any issues during setup or have questions about the codebase:

- **Open a
  [Discussion](https://github.com/bakeronchain/learnvault/discussions)** on
  GitHub
- **Join our [Discord](https://discord.gg/learnvault)** — the `#dev` channel is
  the best place for contributor chat
- **Tag a maintainer** on your issue or PR if you're blocked

We're building LearnVault for the next generation of African builders — and that
includes building a welcoming, supportive contributor community. No question is
too small. We're glad you're here. 💛

---

## Code of Conduct

LearnVault is committed to providing a welcoming, inclusive, and harassment-free
experience for everyone. All contributors are expected to adhere to our Code of
Conduct.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing. By
participating in this project, you agree to abide by its terms and help us
maintain a positive and respectful community.

If you experience or witness unacceptable behavior, please report it to the
project maintainers. We take all reports seriously and will respond
appropriately.

---

_LearnVault — Built for African learners. Powered by community. Governed by
effort._
