# Lesson 3 — Contract storage and state (Theory)

## Summary

State is what turns a smart contract from “a pure function” into an application.
In Soroban, storage is explicit and lives in the Stellar ledger.

This lesson covers the kinds of storage you’ll see and the practical design
tradeoffs to keep contracts predictable and efficient.

## Learning objectives

- Explain what contract state is and where it lives
- Describe key/value storage patterns
- Identify common pitfalls (unbounded growth, upgrade incompatibility)

## Storage as key/value

A common pattern is:

1. Choose a storage key (often a symbol or bytes)
2. Store a value for that key (often a number, struct, or map)
3. Read/modify/write during contract calls

Design tips:

- Keep keys stable and well-named
- Prefer storing small, well-structured values
- Avoid storing data that can be derived cheaply

## State design patterns

### Counters and simple config

- Counter: `count = count + 1`
- Config: admin address, fee rate, paused flag

### Maps (per-user state)

Use a composite key like `(user, key)` to store per-user values.

### Versioning for upgrades

If you may upgrade a contract later, plan a versioning strategy:

- Store a `schema_version`
- Write migration logic (or deploy a new contract and migrate state)

## Pitfalls

- **Unbounded storage**: if users can create unlimited keys, storage can bloat.
- **Unbounded loops**: avoid iterating over large user-controlled collections.
- **Ambiguous encoding**: be consistent about how you encode keys and values.

## Knowledge check

- Why is “unbounded growth” a contract design risk?
- What is one strategy to prepare for upgrades?

## Reviewer sign-off

Reviewed by: _TBD_
