# Lesson 2 — Writing your first Soroban contract (Practical)

## Summary

In this lesson you’ll create a minimal Soroban contract, build it to WebAssembly
(Wasm), and understand the lifecycle: write → build → deploy → invoke.

> The exact CLI commands can vary by tooling and network. Focus on the flow and
> the moving parts.

## Learning objectives

- Identify the parts of a Soroban contract project
- Understand what “build to Wasm” means
- Explain deploy vs invoke

## The minimal contract shape

Most Soroban contracts have:

- A contract type (the “contract”)
- One or more public functions (the “entrypoints”)
- Optional storage (state)

Conceptual example:

```rust
// Pseudo-code for structure:
// - define a contract type
// - implement a function callable from the network
```

## Build → deploy → invoke

### 1) Build

Building compiles your Rust contract to a `.wasm` artifact.

Things to verify after a build:

- The build succeeds without warnings that indicate logic issues
- A Wasm artifact exists in your target/build output

### 2) Deploy

Deploying uploads your Wasm and creates a **contract instance** on the network.
You typically get back a **contract ID**.

### 3) Invoke

Invoking calls one contract function with inputs. The call may:

- Read/write storage
- Require authorization
- Emit events

## Common mistakes

- Deploying to the wrong network (testnet vs public)
- Re-using an outdated contract ID after redeploying
- Assuming you can do non-deterministic things (like HTTP calls)

## Knowledge check

- What artifact is produced when you build a Soroban contract?
- What identifier do you typically need after deployment to invoke functions?

## Reviewer sign-off

Reviewed by: _TBD_
