#![no_std]

//! # GovernanceToken (GOV)
//!
//! A **transferable** SEP-41 fungible token distributed to donors on treasury
//! deposit and earned by top learners at milestone thresholds. Used exclusively
//! for DAO voting on scholarship proposals.
//!
//! - Only the admin (treasury contract) can mint.
//! - Fully transferable — unlike LearnToken (LRN).
//! - No burning in V1.
//!
//! ## Relevant issue
//! Implements: https://github.com/bakeronchain/learnvault/issues/11

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
pub enum GOVError {
    /// Caller is not the contract admin.
    Unauthorized = 1,
    /// Amount must be greater than zero.
    ZeroAmount = 2,
    /// Contract has not been initialized.
    NotInitialized = 3,
    /// Insufficient balance or allowance.
    InsufficientFunds = 4,
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
    Allowance(Address, Address), // (owner, spender)
    TotalSupply,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct GovernanceToken;

#[contractimpl]
impl GovernanceToken {
    /// Initialise the contract. Can only be called once.
    pub fn initialize(env: Env, admin: Address, name: String, symbol: String) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, GOVError::Unauthorized);
        }
        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage().instance().set(&NAME_KEY, &name);
        env.storage().instance().set(&SYMBOL_KEY, &symbol);
        env.storage().instance().set(&DECIMALS_KEY, &7_u32);
    }

    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    /// Mint `amount` GOV to `to`. Admin only.
    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&ADMIN_KEY)
            .unwrap_or_else(|| panic_with_error!(&env, GOVError::NotInitialized));
        admin.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, GOVError::ZeroAmount);
        }

        let key = DataKey::Balance(to.clone());
        let bal: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(bal + amount));

        let supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply + amount));
    }

    /// Transfer the admin role to a new address.
    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&ADMIN_KEY)
            .unwrap_or_else(|| panic_with_error!(&env, GOVError::NotInitialized));
        admin.require_auth();
        env.storage().instance().set(&ADMIN_KEY, &new_admin);
    }

    // -----------------------------------------------------------------------
    // SEP-41 transfers
    // -----------------------------------------------------------------------

    /// Transfer `amount` GOV from `from` to `to`. Requires `from` auth.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, GOVError::ZeroAmount);
        }
        Self::_debit(&env, &from, amount);
        Self::_credit(&env, &to, amount);
    }

    /// Approve `spender` to spend up to `amount` on behalf of `owner`.
    pub fn approve(env: Env, owner: Address, spender: Address, amount: i128) {
        owner.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::Allowance(owner, spender), &amount);
    }

    /// Transfer `amount` from `from` to `to` using `spender`'s allowance.
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, GOVError::ZeroAmount);
        }
        let allow_key = DataKey::Allowance(from.clone(), spender.clone());
        let allowance: i128 = env.storage().persistent().get(&allow_key).unwrap_or(0);
        if allowance < amount {
            panic_with_error!(&env, GOVError::InsufficientFunds);
        }
        env.storage()
            .persistent()
            .set(&allow_key, &(allowance - amount));
        Self::_debit(&env, &from, amount);
        Self::_credit(&env, &to, amount);
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

    pub fn allowance(env: Env, owner: Address, spender: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Allowance(owner, spender))
            .unwrap_or(0)
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
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
            .unwrap_or_else(|| String::from_str(&env, "GovernanceToken"))
    }

    pub fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&SYMBOL_KEY)
            .unwrap_or_else(|| String::from_str(&env, "GOV"))
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    fn _debit(env: &Env, from: &Address, amount: i128) {
        let key = DataKey::Balance(from.clone());
        let bal: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if bal < amount {
            panic_with_error!(env, GOVError::InsufficientFunds);
        }
        env.storage().persistent().set(&key, &(bal - amount));
    }

    fn _credit(env: &Env, to: &Address, amount: i128) {
        let key = DataKey::Balance(to.clone());
        let bal: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(bal + amount));
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod test {
    extern crate std;

    use soroban_sdk::{testutils::Address as _, Address, Env, IntoVal, String};

    use crate::{GOVError, GovernanceToken, GovernanceTokenClient};

    fn setup(e: &Env) -> (Address, Address, GovernanceTokenClient) {
        let admin = Address::generate(e);
        let id = e.register(GovernanceToken, ());
        e.mock_all_auths();
        let client = GovernanceTokenClient::new(e, &id);
        client.initialize(
            &admin,
            &String::from_str(e, "GovernanceToken"),
            &String::from_str(e, "GOV"),
        );
        (id, admin, client)
    }

    // --- initialization ---

    #[test]
    fn initialize_stores_metadata() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        assert_eq!(client.name(), String::from_str(&e, "GovernanceToken"));
        assert_eq!(client.symbol(), String::from_str(&e, "GOV"));
        assert_eq!(client.decimals(), 7);
    }

    #[test]
    fn double_initialize_reverts() {
        let e = Env::default();
        let (_, admin, client) = setup(&e);
        let result = client.try_initialize(
            &admin,
            &String::from_str(&e, "GovernanceToken"),
            &String::from_str(&e, "GOV"),
        );
        assert_eq!(
            result.err(),
            Some(Ok(soroban_sdk::Error::from_contract_error(
                GOVError::Unauthorized as u32
            )))
        );
    }

    // --- minting ---

    #[test]
    fn mint_increases_balance_and_supply() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let donor = Address::generate(&e);
        client.mint(&donor, &500);
        assert_eq!(client.balance(&donor), 500);
        assert_eq!(client.total_supply(), 500);
    }

    #[test]
    fn mint_accumulates() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let donor = Address::generate(&e);
        client.mint(&donor, &200);
        client.mint(&donor, &300);
        assert_eq!(client.balance(&donor), 500);
        assert_eq!(client.total_supply(), 500);
    }

    #[test]
    fn mint_zero_reverts() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let donor = Address::generate(&e);
        let result = client.try_mint(&donor, &0);
        assert_eq!(
            result.err(),
            Some(Ok(soroban_sdk::Error::from_contract_error(
                GOVError::ZeroAmount as u32
            )))
        );
    }

    #[test]
    fn unauthorized_mint_reverts() {
        let e = Env::default();
        let admin = Address::generate(&e);
        let id = e.register(GovernanceToken, ());
        // Only mock auth for initialize
        e.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &admin,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &id,
                fn_name: "initialize",
                args: (
                    admin.clone(),
                    String::from_str(&e, "GovernanceToken"),
                    String::from_str(&e, "GOV"),
                )
                    .into_val(&e),
                sub_invokes: &[],
            },
        }]);
        let client = GovernanceTokenClient::new(&e, &id);
        client.initialize(
            &admin,
            &String::from_str(&e, "GovernanceToken"),
            &String::from_str(&e, "GOV"),
        );
        let donor = Address::generate(&e);
        let result = client.try_mint(&donor, &100);
        assert!(result.is_err());
    }

    // --- transfer ---

    #[test]
    fn transfer_moves_balance() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);
        client.mint(&alice, &100);
        client.transfer(&alice, &bob, &40);
        assert_eq!(client.balance(&alice), 60);
        assert_eq!(client.balance(&bob), 40);
        assert_eq!(client.total_supply(), 100); // supply unchanged
    }

    #[test]
    fn transfer_insufficient_balance_reverts() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);
        client.mint(&alice, &10);
        let result = client.try_transfer(&alice, &bob, &50);
        assert_eq!(
            result.err(),
            Some(Ok(soroban_sdk::Error::from_contract_error(
                GOVError::InsufficientFunds as u32
            )))
        );
    }

    // --- approve / transfer_from ---

    #[test]
    fn approve_and_transfer_from_work() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);
        let carol = Address::generate(&e);
        client.mint(&alice, &100);
        client.approve(&alice, &bob, &60);
        assert_eq!(client.allowance(&alice, &bob), 60);
        client.transfer_from(&bob, &alice, &carol, &40);
        assert_eq!(client.balance(&alice), 60);
        assert_eq!(client.balance(&carol), 40);
        assert_eq!(client.allowance(&alice, &bob), 20); // 60 - 40
    }

    #[test]
    fn transfer_from_exceeds_allowance_reverts() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);
        let carol = Address::generate(&e);
        client.mint(&alice, &100);
        client.approve(&alice, &bob, &10);
        let result = client.try_transfer_from(&bob, &alice, &carol, &50);
        assert_eq!(
            result.err(),
            Some(Ok(soroban_sdk::Error::from_contract_error(
                GOVError::InsufficientFunds as u32
            )))
        );
    }

    // --- set_admin ---

    #[test]
    fn set_admin_transfers_mint_rights() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let new_admin = Address::generate(&e);
        client.set_admin(&new_admin);
        let donor = Address::generate(&e);
        client.mint(&donor, &50);
        assert_eq!(client.balance(&donor), 50);
    }
}
