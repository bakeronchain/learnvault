# Lesson 4 — DeFi on Stellar (SDEX, liquidity pools) (Theory)

## Summary

Stellar supports asset issuance and exchange natively, and Soroban expands the
design space for DeFi-style applications.

This lesson connects DeFi concepts to the Stellar ecosystem: assets, trustlines,
order books, liquidity pools, and smart contracts.

## Learning objectives

- Explain how Stellar assets and trustlines map to tokens
- Understand the difference between order books and liquidity pools
- Describe what role Soroban can play in DeFi on Stellar

## Tokens on Stellar

On Stellar, many “tokens” are issued assets.

To hold an issued asset, users create a trustline. This is part of the protocol
and is an important safety/consent mechanism.

## Exchange on Stellar: SDEX

Stellar’s built-in exchange supports:

- Offers (order book)
- Path payments (routing through markets)

Order books match buyers and sellers directly. Prices come from outstanding
offers.

## Liquidity pools

Liquidity pools provide an AMM-like experience. Traders swap against pooled
liquidity, and LPs may earn fees.

## Where Soroban fits

Soroban enables:

- Custom AMMs and routing logic
- Lending/borrowing logic
- Vaults, staking, and more complex stateful protocols

Even with smart contracts, the basics remain: understand the asset model,
liquidity constraints, and risk.

## Knowledge check

- What protocol feature lets users consent to hold an issued asset?
- What’s one difference between an order book and a liquidity pool?

## Reviewer sign-off

Reviewed by: _TBD_
