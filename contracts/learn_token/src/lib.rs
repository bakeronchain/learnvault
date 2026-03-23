#![no_std]

//! # LearnToken (LRN)
//!
//! A **soulbound** (non-transferable) SEP-41 fungible token minted to learners
//! when they complete verified course milestones.
//!
//! - Minting is restricted to the `CourseMilestone` contract (admin role).
//! - Transfer and `transfer_from` always revert — tokens represent proof of
//!   effort, not speculative value.
//! - The LRN balance is a learner's on-chain reputation score.
//!
//! ## Relevant issue
//! Implements: https://github.com/bakeronchain/learnvault/issues/5

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env, String, Symbol,
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum LRNError {
    /// Transfers are permanently disabled — LRN is soulbound.
    Soulbound = 1,
    /// Caller is not the contract admin.
    Unauthorized = 2,
    /// Mint amount must be greater than zero.
    ZeroAmount = 3,
    /// Contract has not been initialized.
    NotInitialized = 4,
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const ADMIN_KEY: Symbol = symbol_short!("ADMIN");
const NAME_KEY: Symbol = symbol_short!("NAME");
const SYMBOL_KEY: Symbol = symbol_short!("SYMBOL");
const DECIMALS_KEY: Symbol = symbol_short!("DECIMALS");

#[contracttype]
pub enum DataKey {
    Balance(Address),
    TotalSupply,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct LearnToken;

#[contractimpl]
impl LearnToken {
    /// Initialise the contract.
    ///
    /// Must be called once by the deployer.  `admin` should be set to the
    /// `CourseMilestone` contract address once that is deployed.
    pub fn initialize(env: Env, admin: Address) {
        todo!("set admin, name='LearnToken', symbol='LRN', decimals=7 in instance storage")
    }

    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    /// Mint `amount` LRN to `to`.  Only callable by the admin.
    pub fn mint(env: Env, to: Address, amount: i128) {
        todo!("require admin auth, validate amount > 0, update balance + total supply, emit lrn_mint event")
    }

    /// Transfer the admin role to a new address (e.g. the CourseMilestone contract).
    pub fn set_admin(env: Env, new_admin: Address) {
        todo!("require current admin auth, update ADMIN_KEY")
    }

    // -----------------------------------------------------------------------
    // SEP-41 read functions
    // -----------------------------------------------------------------------

    pub fn balance(env: Env, account: Address) -> i128 {
        todo!("return Balance(account) from persistent storage, default 0")
    }

    pub fn total_supply(env: Env) -> i128 {
        todo!("return TotalSupply from persistent storage")
    }

    pub fn decimals(env: Env) -> u32 {
        todo!("return DECIMALS_KEY from instance storage")
    }

    pub fn name(env: Env) -> String {
        todo!("return NAME_KEY from instance storage")
    }

    pub fn symbol(env: Env) -> String {
        todo!("return SYMBOL_KEY from instance storage")
    }

    // -----------------------------------------------------------------------
    // SEP-41 transfer functions — soulbound: always revert
    // -----------------------------------------------------------------------

    pub fn transfer(env: Env, _from: Address, _to: Address, _amount: i128) {
        panic_with_error!(&env, LRNError::Soulbound)
    }

    pub fn transfer_from(
        env: Env,
        _spender: Address,
        _from: Address,
        _to: Address,
        _amount: i128,
    ) {
        panic_with_error!(&env, LRNError::Soulbound)
    }

    pub fn approve(
        env: Env,
        _from: Address,
        _spender: Address,
        _amount: i128,
        _expiration_ledger: u32,
    ) {
        panic_with_error!(&env, LRNError::Soulbound)
    }

    pub fn allowance(env: Env, _from: Address, _spender: Address) -> i128 {
        0
    }
}

#[cfg(test)]
mod test;
