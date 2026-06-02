# Lesson 3 — Your first XLM transaction (Practical)

## Summary

You’ll send a small payment on a test network to understand the lifecycle of a
Stellar transaction: build → sign → submit → verify on an explorer.

## Learning objectives

- Describe the pieces of a payment transaction
- Send XLM on a test network
- Verify the result using a transaction hash

## Prerequisites

- A funded testnet account in Freighter
- A second testnet address to receive funds (can be a second wallet)

## Option A: Using a wallet + explorer (fastest)

1. In Freighter, choose **Send**.
2. Paste the recipient address.
3. Enter a small amount of XLM (e.g., 1 XLM on testnet).
4. Confirm and sign.
5. Copy the resulting transaction hash (if shown).
6. Open an explorer and look up:
   - The transaction hash
   - The source account
   - The destination account

## Option B: Building a payment in code (conceptual)

Most apps follow this pattern:

1. Load the account (to get the current sequence number)
2. Build a transaction with one or more operations
3. Sign (wallet or secret key)
4. Submit

Example shape (pseudo-code):

```ts
// 1) load account
// 2) build tx with Operation.payment(...)
// 3) sign
// 4) submit
```

## What to observe

- A **payment** is one operation inside a transaction
- The network charges a small **fee** (paid in XLM)
- Transactions are ordered by **sequence number**

## Common mistakes

- Sending on the wrong network (testnet vs public)
- Copy/paste errors in addresses
- Insufficient balance for the minimum reserve + payment + fee

## Knowledge check

- What is a transaction hash used for?
- Why does the sequence number matter?

## Reviewer sign-off

Reviewed by: _TBD_
