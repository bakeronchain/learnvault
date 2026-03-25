# Lesson 1 — What is Stellar? (Theory)

## Summary

Stellar is an open network for issuing assets and moving value quickly and
cheaply. It’s designed for payments, remittances, and on-chain asset exchange.

By the end of this lesson, you’ll understand the core building blocks of the
Stellar network and the vocabulary you’ll see across wallets, explorers, and
developer tools.

## Learning objectives

- Explain what Stellar is and what it’s used for
- Describe accounts, keypairs, balances, and transactions
- Explain assets, trustlines, and why they matter
- Identify the difference between Stellar Core and Horizon

## Core concepts (the “mental model”)

### 1) Accounts & keys

On Stellar, an **account** is controlled by one or more **public/private keys**
(keypairs). The public key is your address. The private key (or seed phrase in a
wallet) proves you own the account and can sign transactions.

**Rule of thumb:** if someone gets your secret key, they can control your funds.

### 2) XLM (the native asset)

**XLM** is Stellar’s native asset. It’s used for fees and also as a bridge asset
for path payments.

Most accounts must maintain a small **minimum balance** in XLM to exist on the
network and to hold additional ledger entries (like trustlines).

### 3) Transactions & operations

A **transaction** is a signed package submitted to the network. It contains one
or more **operations** (e.g., “send payment”, “change trust”, “manage offer”).

Key details you’ll see in most transactions:

- **Fee**: a small amount paid in XLM
- **Sequence number**: prevents replay and enforces ordering
- **Memo**: optional metadata (often used for exchange deposits)

### 4) Assets & trustlines

Stellar supports custom assets (e.g., “USDC” issued by an issuer). To hold a
non-native asset, an account must create a **trustline**.

Think of a trustline as: “I agree to hold up to X units of this asset.”

### 5) On-chain exchange (SDEX)

Stellar has a built-in decentralized exchange (often called the **SDEX**). Users
can place offers to trade assets. Path payments can automatically route through
these offers to find the best conversion.

### 6) Network components: Core vs Horizon

- **Stellar Core**: the software validators run to reach consensus and apply
  transactions to the ledger.
- **Horizon**: the API layer that most apps use to query accounts, submit
  transactions, and stream events.

## Quick exercise (5 minutes)

1. Find a Stellar explorer you like (any public explorer is fine).
2. Search for a public account address (you can use one from a wallet later).
3. Identify:
   - XLM balance
   - Trustlines (if any)
   - Recent transactions and operations

## Knowledge check

- What is the difference between a transaction and an operation?
- Why do you need a trustline to hold a non-native asset?
- Which component do most apps talk to: Stellar Core or Horizon?

## Reviewer sign-off

Reviewed by: _TBD_
