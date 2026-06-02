# Lesson 4 — Introduction to Soroban smart contracts (Theory)

## Summary

Soroban is Stellar’s smart contract platform. It enables on-chain programs that
can manage state, enforce rules, and power DeFi and other applications.

This lesson introduces the “shape” of a Soroban contract without requiring you
to write production-ready Rust yet.

## Learning objectives

- Define what a smart contract is (in the Stellar + Soroban context)
- Explain contract state and why storage is explicit
- Recognize common Soroban building blocks: `Env`, auth, events, storage

## What a Soroban contract is

At a high level, a Soroban contract is:

- **Code** (compiled to WebAssembly)
- **Functions** that can be invoked by transactions
- **State** stored in the Stellar ledger (when the contract chooses to store it)

Soroban contracts run deterministically. They don’t “reach out” to the internet
or read files. Everything they need must be provided via inputs or ledger state.

## Key building blocks

### `Env`

Soroban’s `Env` is the gateway to:

- Reading/writing storage
- Emitting events
- Verifying authorization
- Accessing ledger context (like timestamps/sequence)

### Storage (state)

Soroban makes storage explicit. Contract state is typically stored as key/value
pairs in the ledger.

You’ll often see patterns like:

- “Get the current value from storage”
- “Compute a new value”
- “Write the new value back to storage”

### Authorization (who is allowed to do what)

Most real contracts need to enforce rules like:

- Only an admin can upgrade settings
- A user must sign to move their funds
- A contract can only spend what it was approved to spend

Soroban provides primitives to validate authorization for contract calls.

## A tiny example (conceptual)

Below is a simplified counter contract shape:

```rust
// Pseudo-code to illustrate the idea:
// - read `count` from storage
// - increment it
// - write it back
// - return the updated value
```

## Where Soroban fits in this track

In the next track (Soroban Smart Contract Basics), you’ll:

- Learn Rust essentials for contract development
- Write and test a real contract
- Understand storage patterns and best practices

## Knowledge check

- Why can’t a Soroban contract call an external API directly?
- What is the role of `Env` in Soroban?

## Reviewer sign-off

Reviewed by: _TBD_
