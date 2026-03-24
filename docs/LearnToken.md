# LearnToken (LRN) — Contract Reference

## Overview

`LearnToken` is a **soulbound** (non-transferable) SEP-41 fungible token on the Stellar Soroban blockchain. It is minted to learners upon verified course milestone completion and serves as the core on-chain reputation layer of the LearnVault ecosystem.

- **Token name**: `LearnToken`
- **Symbol**: `LRN`
- **Decimals**: `7` (Stellar convention)
- **Transferability**: Permanently disabled — LRN is soulbound
- **Minting**: Restricted to the admin address (intended to be the `CourseMilestone` contract)

A learner's LRN balance is their **on-chain academic reputation score**, which gates scholarship eligibility and governance participation.

---

## Deployment

Deploy in this order (no dependencies for LearnToken):

```
1. LearnToken   — no dependencies
4. CourseMilestone — requires LearnToken address
```

After deploying `CourseMilestone`, call `set_admin` to transfer minting authority:

```rust
learn_token_client.set_admin(&course_milestone_address);
```

---

## Functions

### `initialize(admin: Address)`

Initialises the contract. Must be called exactly once by the deployer.

| Parameter | Type      | Description                                      |
|-----------|-----------|--------------------------------------------------|
| `admin`   | `Address` | The address authorised to call `mint`. Should be set to the `CourseMilestone` contract after deployment. |

**Errors**:
- `Unauthorized (2)` — if called a second time on an already-initialised contract.

---

### `mint(to: Address, amount: i128, course_id: String)`

Mints `amount` LRN tokens to `to` for completing `course_id`. Only callable by the admin.

| Parameter   | Type      | Description                                      |
|-------------|-----------|--------------------------------------------------|
| `to`        | `Address` | The learner's wallet address                     |
| `amount`    | `i128`    | Number of LRN tokens to mint (must be > 0)       |
| `course_id` | `String`  | Identifier of the completed course (e.g. `"web3-101"`) |

**Effects**:
- Increases `balance(to)` by `amount`
- Increases `total_supply()` by `amount`
- Emits a `MilestoneCompleted` event

**Errors**:
- `NotInitialized (4)` — if called before `initialize`
- `Unauthorized (2)` — if caller is not the admin
- `ZeroAmount (3)` — if `amount <= 0`

---

### `set_admin(new_admin: Address)`

Transfers the admin (minter) role to a new address.

| Parameter   | Type      | Description              |
|-------------|-----------|--------------------------|
| `new_admin` | `Address` | The new admin address    |

**Errors**:
- `NotInitialized (4)` — if called before `initialize`
- `Unauthorized (2)` — if caller is not the current admin

---

### `balance(account: Address) → i128`

Returns the LRN balance of `account`. Returns `0` for addresses that have never received LRN.

---

### `reputation_score(account: Address) → i128`

Returns the on-chain reputation score of `account`. Identical to `balance` — the LRN balance IS the reputation score. Provided as a semantically meaningful alias for use by scholarship eligibility checks and governance contracts.

---

### `total_supply() → i128`

Returns the total number of LRN tokens minted across all learners.

---

### `decimals() → u32`

Returns `7` (Stellar convention).

---

### `name() → String`

Returns `"LearnToken"`.

---

### `symbol() → String`

Returns `"LRN"`.

---

### `transfer(...)` / `transfer_from(...)` / `approve(...)`

Always revert with `Soulbound (1)`. LRN tokens cannot be transferred under any circumstances.

---

### `allowance(from: Address, spender: Address) → i128`

Always returns `0`. No approvals are possible on a soulbound token.

---

## Events

### `MilestoneCompleted`

Emitted on every successful `mint` call.

| Field       | Type      | Description                              |
|-------------|-----------|------------------------------------------|
| `learner`   | `Address` | The address that received LRN            |
| `amount`    | `i128`    | The number of LRN tokens minted          |
| `course_id` | `String`  | The course identifier that triggered the mint |

**Example** (off-chain indexer pseudocode):

```json
{
  "type": "MilestoneCompleted",
  "learner": "GABC...XYZ",
  "amount": 100,
  "course_id": "web3-101"
}
```

---

## Error Codes

| Code | Name             | Trigger                                                  |
|------|------------------|----------------------------------------------------------|
| `1`  | `Soulbound`      | `transfer`, `transfer_from`, or `approve` was called     |
| `2`  | `Unauthorized`   | Non-admin called `mint`/`set_admin`, or double `initialize` |
| `3`  | `ZeroAmount`     | `mint` called with `amount <= 0`                         |
| `4`  | `NotInitialized` | `mint` or `set_admin` called before `initialize`         |

---

## Storage Layout

| Key                        | Storage    | Type      | Description              |
|----------------------------|------------|-----------|--------------------------|
| `ADMIN`                    | Instance   | `Address` | Current admin address    |
| `NAME`                     | Instance   | `String`  | Token name               |
| `SYMBOL`                   | Instance   | `String`  | Token symbol             |
| `DECIMALS`                 | Instance   | `u32`     | Decimal places           |
| `DataKey::TotalSupply`     | Instance   | `i128`    | Total minted supply      |
| `DataKey::Balance(Address)`| Persistent | `i128`    | Per-learner LRN balance  |

Balances use **persistent** storage so learner reputation survives ledger TTL expiry.

---

## Usage Example

```rust
// 1. Deploy and initialize
learn_token_client.initialize(&deployer_address);

// 2. Hand off minting to CourseMilestone
learn_token_client.set_admin(&course_milestone_address);

// 3. CourseMilestone mints on verified completion
learn_token_client.mint(&learner_address, &100, &String::from_str(&env, "web3-101"));

// 4. Query reputation
let score = learn_token_client.reputation_score(&learner_address); // 100
let balance = learn_token_client.balance(&learner_address);        // 100 (same)

// 5. Transfer attempt — always fails
learn_token_client.transfer(&learner_address, &other_address, &10); // panics: Soulbound
```

---

## Security Notes

- The admin role is a single address. In production, set it to the `CourseMilestone` contract address, not an EOA.
- There is no burn function — LRN balances only increase. This is intentional: reputation is permanent proof of effort.
- The soulbound property is enforced at the contract level, not via allowlists. It cannot be bypassed.
