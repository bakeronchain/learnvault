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
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, LRNError::Unauthorized);
        }
        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage().instance().set(&NAME_KEY, &String::from_str(&env, "LearnToken"));
        env.storage().instance().set(&SYMBOL_KEY, &String::from_str(&env, "LRN"));
        env.storage().instance().set(&DECIMALS_KEY, &7_u32);
    }

    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    /// Mint `amount` LRN to `to`.  Only callable by the admin.
    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap_or_else(|| panic_with_error!(&env, LRNError::NotInitialized));
        admin.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, LRNError::ZeroAmount);
        }

        let balance_key = DataKey::Balance(to.clone());
        let current_balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);
        env.storage().persistent().set(&balance_key, &(current_balance + amount));

        let total_supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(total_supply + amount));

        env.events().publish(
            (symbol_short!("mint"), to),
            amount,
        );
    }

    /// Transfer the admin role to a new address (e.g. the CourseMilestone contract).
    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap_or_else(|| panic_with_error!(&env, LRNError::NotInitialized));
        admin.require_auth();
        env.storage().instance().set(&ADMIN_KEY, &new_admin);
    }

    // -----------------------------------------------------------------------
    // SEP-41 read functions
    // -----------------------------------------------------------------------

    pub fn balance(env: Env, account: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Balance(account)).unwrap_or(0)
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&DECIMALS_KEY).unwrap_or(7)
    }

    pub fn name(env: Env) -> String {
        env.storage().instance().get(&NAME_KEY).unwrap_or_else(|| String::from_str(&env, "LearnToken"))
    }

    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&SYMBOL_KEY).unwrap_or_else(|| String::from_str(&env, "LRN"))
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
