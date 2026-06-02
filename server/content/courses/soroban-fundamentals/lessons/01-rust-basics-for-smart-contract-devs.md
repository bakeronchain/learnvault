# Lesson 1 — Rust basics for smart contract devs (Theory)

## Summary

Soroban contracts are commonly written in Rust and compiled to WebAssembly. That
means you need a solid grasp of Rust’s safety model and a few patterns that
matter in deterministic, resource-bounded smart contract environments.

## Learning objectives

- Explain ownership and borrowing in practical terms
- Use `Option` and `Result` to model “maybe” and “error” outcomes
- Recognize common Rust data types and patterns used in contracts
- Understand why determinism and resource limits affect your code choices

## Rust concepts you’ll use constantly

### Ownership & borrowing (the core idea)

Rust prevents entire classes of bugs by enforcing clear rules about who “owns” a
value and how it can be referenced.

- **Ownership**: exactly one owner controls a value at a time.
- **Borrowing**: you can temporarily reference a value without taking ownership.
- **Mutability**: mutation is explicit (`mut`).

In smart contracts, this matters because you’ll build state transitions that are
safe, explicit, and testable.

### `Option` and `Result`

Contracts often need to handle absent values and validation errors.

- `Option<T>`: a value may exist (`Some`) or not (`None`).
- `Result<T, E>`: an operation may succeed (`Ok`) or fail (`Err`).

Treat these as first-class control flow tools.

### Structs, enums, and pattern matching

- Use **structs** to bundle related fields.
- Use **enums** to model variants (e.g., states, commands, error types).
- Use `match` to handle each variant explicitly.

### Avoiding foot-guns in contract code

Smart contracts execute in a deterministic environment and typically have
resource limits.

Practical guidelines:

- Prefer integers over floating-point math.
- Keep loops bounded (avoid unbounded iteration over user-controlled sizes).
- Be explicit about failure cases (don’t panic on user input).

## Mini exercise

Write a function that returns the next value for a counter.

- Input: current counter value (or `None` if unset)
- Output: incremented value

Think about whether this should return `u32`, `i64`, or another integer type.

## Knowledge check

- What’s the difference between owning a value and borrowing it?
- When would you choose `Option<T>` vs `Result<T, E>`?

## Reviewer sign-off

Reviewed by: _TBD_
