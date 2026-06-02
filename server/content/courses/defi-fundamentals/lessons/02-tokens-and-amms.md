# Lesson 2 — Tokens and AMMs (Theory)

## Summary

Two building blocks show up everywhere in DeFi:

1. **Tokens**: the units of value
2. **AMMs** (Automated Market Makers): a way to trade tokens using liquidity
   pools

## Learning objectives

- Explain what a fungible token is
- Understand how AMM liquidity pools enable swaps
- Define slippage and why it happens

## Tokens (quick refresher)

A fungible token is interchangeable: 1 unit is the same as another unit.
Examples include stablecoins, wrapped assets, or protocol tokens.

Tokens are used for:

- Payments and settlement
- Collateral in lending
- Governance votes

## AMMs in plain language

An AMM is a set of rules that sets a price based on the pool’s balances.

A simple mental model:

- A pool holds Token A and Token B
- Traders swap A for B (or vice versa)
- The price moves based on the pool ratio

### Slippage

**Slippage** is the difference between the expected price and the executed
price. It happens because your trade changes the pool ratio.

Bigger trade vs pool size ⇒ more slippage.

### Liquidity providers (LPs)

Liquidity providers deposit two assets into a pool and receive an LP position.
In return, they may earn fees from swaps.

LPs also face risk (e.g., impermanent loss) when prices move.

## Knowledge check

- What causes slippage in an AMM?
- Why might someone provide liquidity to a pool?

## Reviewer sign-off

Reviewed by: _TBD_
