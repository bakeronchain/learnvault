#![no_std]
#![allow(deprecated)]

//! # LearnToken (LRN)
//!
//! A **soulbound** (non-transferable) SEP-41 fungible token minted to learners
//! on verified course milestone completion. Represents real, on-chain proof of
//! effort — it cannot be sold or transferred.
//!
//! - Only the admin (CourseMilestone contract) can mint.
//! - Non-transferable by design.
//! - No burning in V1.
//!
//! ## Relevant issue
//! Implements: https://github.com/bakeronchain/learnvault/issues/5

use soroban_sdk::{
    Address, Env, String, Symbol, contract, contracterror, contractimpl, contracttype,
    panic_with_error, symbol_short,
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum LRNError {
    /// Caller is not the contract admin.
    Unauthorized = 1,
    /// Amount must be greater than zero.
    ZeroAmount = 2,
    /// Contract has not been initialized.
    NotInitialized = 3,
    /// Token is soulbound and cannot be transferred.
    Soulbound = 4,
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
    /// Initialise the contract. Can only be called once.
    ///
    /// Sets name = "LearnVault Learn Token", symbol = "LRN", decimals = 7.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, LRNError::Unauthorized);
        }
        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage()
            .instance()
            .set(&NAME_KEY, &String::from_str(&env, "LearnVault Learn Token"));
        env.storage()
            .instance()
            .set(&SYMBOL_KEY, &String::from_str(&env, "LRN"));
        env.storage().instance().set(&DECIMALS_KEY, &7_u32);
    }

    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    /// Mint `amount` LRN to `to`. Admin only.
    pub fn mint(env: Env, to: Address, amount: i128) {
        // 1. Load admin from storage, call admin.require_auth()
        let admin: Address = env
            .storage()
            .instance()
            .get(&ADMIN_KEY)
            .unwrap_or_else(|| panic_with_error!(&env, LRNError::NotInitialized));
        admin.require_auth();

        // 2. Panic with ZeroAmount if amount <= 0
        if amount <= 0 {
            panic_with_error!(&env, LRNError::ZeroAmount);
        }

        // 3. Add amount to Balance(to) in persistent storage
        let bal_key = DataKey::Balance(to.clone());
        let bal: i128 = env.storage().persistent().get(&bal_key).unwrap_or(0);
        env.storage().persistent().set(&bal_key, &(bal + amount));

        // 4. Add amount to TotalSupply in persistent storage
        let supply: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::TotalSupply, &(supply + amount));

        // 5. Emit event
        env.events()
            .publish((symbol_short!("lrn_mint"), to.clone()), amount);
    }

    /// Transfer the admin role to a new address. Admin only.
    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&ADMIN_KEY)
            .unwrap_or_else(|| panic_with_error!(&env, LRNError::NotInitialized));
        admin.require_auth();
        env.storage().instance().set(&ADMIN_KEY, &new_admin);
        env.events()
            .publish((symbol_short!("set_admin"),), new_admin);
    }

    /// Transfer is not allowed — LRN is soulbound.
    pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {
        panic_with_error!(&_env, LRNError::Soulbound);
    }

    /// Transfer from is not allowed — LRN is soulbound.
    pub fn transfer_from(_env: Env, _spender: Address, _from: Address, _to: Address, _amount: i128) {
        panic_with_error!(&_env, LRNError::Soulbound);
    }

    /// Approve is not allowed — LRN is soulbound.
    pub fn approve(_env: Env, _from: Address, _spender: Address, _amount: i128) {
        panic_with_error!(&_env, LRNError::Soulbound);
    }

    /// Allowance always returns 0 — LRN is soulbound and cannot be transferred.
    pub fn allowance(_env: Env, _from: Address, _spender: Address) -> i128 {
        0
    }

    // -----------------------------------------------------------------------
    // Read functions
    // -----------------------------------------------------------------------

    pub fn balance(env: Env, account: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(account))
            .unwrap_or(0)
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&DECIMALS_KEY).unwrap_or(7)
    }

    pub fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&NAME_KEY)
            .unwrap_or_else(|| String::from_str(&env, "LearnToken"))
    }

    pub fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&SYMBOL_KEY)
            .unwrap_or_else(|| String::from_str(&env, "LRN"))
    }

    pub fn get_version(env: Env) -> String {
        String::from_str(&env, "1.0.0")
    }

    /// Calculate reputation score based on balance.
    /// Formula: reputation = balance / 100 (integer division)
    pub fn reputation_score(env: Env, account: Address) -> i128 {
        let balance = Self::balance(env, account);
        balance / 100
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod test;
