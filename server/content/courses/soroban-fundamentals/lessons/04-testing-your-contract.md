# Lesson 4 — Testing your contract (Practical)

## Summary

Good tests are what separates “it compiles” from “it’s safe to ship.” In this
lesson you’ll learn a practical testing approach for Soroban contracts.

## Learning objectives

- Explain the difference between unit and integration tests
- Identify what to test: happy paths, auth, edge cases
- Build confidence before deploying on-chain

## What to test

### 1) Happy path

- Valid inputs
- Expected state updates
- Expected return values

### 2) Authorization rules

If a function should only be callable by an admin or the user, tests should
prove unauthorized calls fail.

### 3) Edge cases

- Missing state (`None` / unset storage)
- Boundary values (0, max limits)
- Repeated calls

## Unit testing mindset

A unit test should be:

- Deterministic
- Small
- Focused on one behavior

## Integration testing mindset

An integration test validates:

- Deploy + invoke end-to-end
- Network configuration
- Real transaction signing and submission

## Knowledge check

- Name two categories of behaviors you should always test.
- Why are deterministic tests especially important for smart contracts?

## Reviewer sign-off

Reviewed by: _TBD_
