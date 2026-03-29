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
    Address, Env, String, Symbol, contract, contracterror, contractevent, contractimpl,
    contracttype, panic_with_error, symbol_short,
};

// ---------------------------------------------------------------------------
// Storage Constants (assuming ~6s ledger time)
// ---------------------------------------------------------------------------

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const INSTANCE_EXTEND_TO: u32 = DAY_IN_LEDGERS * 30; // 30 days
const PERSISTENT_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const PERSISTENT_EXTEND_TO: u32 = DAY_IN_LEDGERS * 365; // 1 year

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
    /// Expiration ledger is in the past.
    InvalidExpiration = 5,
    /// Allowance exists but is expired at current ledger.
    AllowanceExpired = 6,
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
    Delegate(Address),
    DelegatedAmount(Address),
}

#[contractevent]
pub struct GOVBurned {
    pub from: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GOVMinted {
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GOVTransferred {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GOVApproved {
    pub owner: Address,
    pub spender: Address,
    pub amount: i128,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct GovernanceToken;

#[contractimpl]
impl GovernanceToken {
    /// Initialise the contract. Can only be called once.
    ///
    /// Sets name = "LearnVault Governance", symbol = "GOV", decimals = 7.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, GOVError::Unauthorized);
        }
        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage()
            .instance()
            .set(&NAME_KEY, &String::from_str(&env, "LearnVault Governance"));
        env.storage()
            .instance()
            .set(&SYMBOL_KEY, &String::from_str(&env, "GOV"));
        env.storage().instance().set(&DECIMALS_KEY, &7_u32);

        Self::extend_instance(&env);
    }

    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    /// Mint `amount` GOV to `to`. Admin only.
    pub fn mint(env: Env, to: Address, amount: i128) {
        Self::extend_instance(&env);
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
        Self::extend_persistent(&env, &key);

        // Update delegated amount for 'to's delegate
        if let Some(delegate) = Self::get_delegate(env.clone(), to.clone()) {
            let del_key = DataKey::DelegatedAmount(delegate.clone());
            let del_bal: i128 = env.storage().persistent().get(&del_key).unwrap_or(0);
            env.storage()
                .persistent()
                .set(&del_key, &(del_bal + amount));
        }

        let supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply + amount));

        GOVMinted { to, amount }.publish(&env);
    }

    /// Burn `amount` from the caller's own balance.
    pub fn burn(env: Env, from: Address, amount: i128) {
        Self::extend_instance(&env);
        from.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, GOVError::ZeroAmount);
        }
        Self::_debit(&env, &from, amount);
        // reduce total supply
        let supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply - amount));
        GOVBurned { from, amount }.publish(&env);
    }

    /// Administrative burn for slashing.
    pub fn admin_burn_from(env: Env, from: Address, amount: i128) {
        Self::extend_instance(&env);
        let admin: Address = env
            .storage()
            .instance()
            .get(&ADMIN_KEY)
            .unwrap_or_else(|| panic_with_error!(&env, GOVError::NotInitialized));
        admin.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, GOVError::ZeroAmount);
        }
        Self::_debit(&env, &from, amount);

        let supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply - amount));
        GOVBurned { from, amount }.publish(&env);
    }

    /// Transfer the admin role to a new address.
    pub fn set_admin(env: Env, new_admin: Address) {
        Self::extend_instance(&env);
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
        Self::extend_instance(&env);
        from.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, GOVError::ZeroAmount);
        }
        Self::_debit(&env, &from, amount);
        Self::_credit(&env, &to, amount);

        GOVTransferred { from, to, amount }.publish(&env);
    }

    /// Approve `spender` to spend up to `amount` on behalf of `owner`.
    pub fn approve(
        env: Env,
        owner: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) {
        owner.require_auth();
        let current_ledger = env.ledger().sequence();
        if expiration_ledger < current_ledger {
            panic_with_error!(&env, GOVError::InvalidExpiration);
        }

        let key = DataKey::Allowance(owner.clone(), spender.clone());
        env.storage()
            .persistent()
            .set(&key, &(amount, expiration_ledger));
        Self::extend_persistent(&env, &key);

        GOVApproved {
            owner,
            spender,
            amount,
        }
        .publish(&env);
    }

    /// Transfer `amount` from `from` to `to` using `spender`'s allowance.
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, GOVError::ZeroAmount);
        }

        let current_ledger = env.ledger().sequence();
        let allow_key = DataKey::Allowance(from.clone(), spender.clone());
        let (allowance, expiration_ledger): (i128, u32) =
            env.storage().persistent().get(&allow_key).unwrap_or((0, 0));

        if allowance > 0 && expiration_ledger < current_ledger {
            panic_with_error!(&env, GOVError::AllowanceExpired);
        }

        if allowance < amount {
            panic_with_error!(&env, GOVError::InsufficientFunds);
        }

        let remaining = allowance - amount;
        if remaining == 0 {
            env.storage().persistent().remove(&allow_key);
        } else {
            env.storage()
                .persistent()
                .set(&allow_key, &(remaining, expiration_ledger));
            Self::extend_persistent(&env, &allow_key);
        }

        Self::_debit(&env, &from, amount);
        Self::_credit(&env, &to, amount);

        GOVTransferred { from, to, amount }.publish(&env);
    }

    // -----------------------------------------------------------------------
    // Delegation
    // -----------------------------------------------------------------------

    pub fn delegate(env: Env, delegator: Address, delegatee: Address) {
        delegator.require_auth();

        let old_delegate = Self::get_delegate(env.clone(), delegator.clone());
        if old_delegate == Some(delegatee.clone()) {
            return;
        }

        let bal = Self::balance(env.clone(), delegator.clone());

        // Remove from old delegate
        if let Some(old) = old_delegate {
            let key = DataKey::DelegatedAmount(old);
            let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
            env.storage().persistent().set(&key, &(current - bal));
        }

        // Add to new delegate
        if delegator != delegatee {
            let key = DataKey::DelegatedAmount(delegatee.clone());
            let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
            env.storage().persistent().set(&key, &(current + bal));
            env.storage()
                .persistent()
                .set(&DataKey::Delegate(delegator), &delegatee);
        } else {
            // Delegating to self is same as undelegating
            env.storage()
                .persistent()
                .remove(&DataKey::Delegate(delegator));
        }
    }

    pub fn undelegate(env: Env, delegator: Address) {
        delegator.require_auth();

        let old_delegate = Self::get_delegate(env.clone(), delegator.clone());
        if let Some(old) = old_delegate {
            let bal = Self::balance(env.clone(), delegator.clone());
            let key = DataKey::DelegatedAmount(old);
            let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
            env.storage().persistent().set(&key, &(current - bal));

            env.storage()
                .persistent()
                .remove(&DataKey::Delegate(delegator));
        }
    }

    // -----------------------------------------------------------------------
    // Read functions
    // -----------------------------------------------------------------------

    pub fn get_delegate(env: Env, delegator: Address) -> Option<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Delegate(delegator))
    }

    pub fn get_voting_power(env: Env, address: Address) -> i128 {
        if Self::get_delegate(env.clone(), address.clone()).is_some() {
            return 0;
        }
        let bal = Self::balance(env.clone(), address.clone());
        let delegated: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::DelegatedAmount(address))
            .unwrap_or(0);
        bal + delegated
    }

    pub fn balance(env: Env, account: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(account))
            .unwrap_or(0)
    }

    pub fn allowance(env: Env, owner: Address, spender: Address) -> i128 {
        let key = DataKey::Allowance(owner, spender);
        if let Some((allowance, expiration_ledger)) =
            env.storage().persistent().get::<_, (i128, u32)>(&key)
        {
            if expiration_ledger < env.ledger().sequence() {
                0
            } else {
                Self::extend_persistent(&env, &key);
                allowance
            }
        } else {
            0
        }
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

    pub fn get_version(env: Env) -> String {
        String::from_str(&env, "1.0.0")
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
        Self::extend_persistent(env, &key);

        // Update delegated amount for 'from's delegate
        if let Some(delegate) = Self::get_delegate(env.clone(), from.clone()) {
            let del_key = DataKey::DelegatedAmount(delegate.clone());
            let del_bal: i128 = env.storage().persistent().get(&del_key).unwrap_or(0);
            env.storage()
                .persistent()
                .set(&del_key, &(del_bal - amount));
            Self::extend_persistent(env, &del_key);
        }
    }

    fn _credit(env: &Env, to: &Address, amount: i128) {
        let key = DataKey::Balance(to.clone());
        let bal: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(bal + amount));
        Self::extend_persistent(env, &key);

        // Update delegated amount for 'to's delegate
        if let Some(delegate) = Self::get_delegate(env.clone(), to.clone()) {
            let del_key = DataKey::DelegatedAmount(delegate.clone());
            let del_bal: i128 = env.storage().persistent().get(&del_key).unwrap_or(0);
            env.storage()
                .persistent()
                .set(&del_key, &(del_bal + amount));
            Self::extend_persistent(env, &del_key);
        }
    }

    fn extend_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_EXTEND_TO);
    }

    fn extend_persistent(env: &Env, key: &DataKey) {
        env.storage()
            .persistent()
            .extend_ttl(key, PERSISTENT_BUMP_THRESHOLD, PERSISTENT_EXTEND_TO);
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod test {
    extern crate std;

    use soroban_sdk::{
        Address, Env, IntoVal, String,
        testutils::{Address as _, Ledger, LedgerInfo},
    };

    use crate::{GOVError, GovernanceToken, GovernanceTokenClient};

    fn setup(e: &Env) -> (Address, Address, GovernanceTokenClient) {
        let admin = Address::generate(e);
        let id = e.register(GovernanceToken, ());
        e.mock_all_auths();
        let client = GovernanceTokenClient::new(e, &id);
        client.initialize(&admin);
        (id, admin, client)
    }

    fn set_ledger_sequence(env: &Env, sequence_number: u32) {
        env.ledger().set(LedgerInfo {
            timestamp: 1_700_000_000,
            protocol_version: 23,
            sequence_number,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 16,
            min_persistent_entry_ttl: 16,
            max_entry_ttl: 6312000,
        });
    }

    fn valid_expiration(env: &Env) -> u32 {
        env.ledger().sequence() + 100
    }

    // --- initialization ---

    #[test]
    fn initialize_stores_metadata() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        assert_eq!(client.name(), String::from_str(&e, "LearnVault Governance"));
        assert_eq!(client.symbol(), String::from_str(&e, "GOV"));
        assert_eq!(client.decimals(), 7);
    }

    #[test]
    fn double_initialize_reverts() {
        let e = Env::default();
        let (_, admin, client) = setup(&e);
        let _ = admin; // already initialized via setup
        let result = client.try_initialize(&Address::generate(&e));
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
                args: (admin.clone(),).into_val(&e),
                sub_invokes: &[],
            },
        }]);
        let client = GovernanceTokenClient::new(&e, &id);
        client.initialize(&admin);
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
        client.approve(&alice, &bob, &60, &valid_expiration(&e));
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
        client.approve(&alice, &bob, &10, &valid_expiration(&e));
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

    // --- delegation ---

    #[test]
    fn delegation_increases_voting_power() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);

        client.mint(&alice, &100);
        client.mint(&bob, &50);

        // Before delegation
        assert_eq!(client.get_voting_power(&alice), 100);
        assert_eq!(client.get_voting_power(&bob), 50);

        client.delegate(&alice, &bob);

        // After delegation
        assert_eq!(client.get_voting_power(&alice), 0);
        assert_eq!(client.get_voting_power(&bob), 150);
        assert_eq!(client.get_delegate(&alice), Some(bob.clone()));
    }

    #[test]
    fn undelegate_restores_power() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);

        client.mint(&alice, &100);
        client.delegate(&alice, &bob);
        assert_eq!(client.get_voting_power(&bob), 100);

        client.undelegate(&alice);
        assert_eq!(client.get_voting_power(&alice), 100);
        assert_eq!(client.get_voting_power(&bob), 0);
        assert_eq!(client.get_delegate(&alice), None);
    }

    #[test]
    fn transfer_updates_delegated_power() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);
        let carol = Address::generate(&e);

        client.mint(&alice, &100);
        client.delegate(&alice, &bob);
        assert_eq!(client.get_voting_power(&bob), 100);

        client.transfer(&alice, &carol, &40);
        assert_eq!(client.get_voting_power(&bob), 60);
        assert_eq!(client.balance(&carol), 40);
        assert_eq!(client.get_voting_power(&carol), 40); // Carol has no delegate
    }

    #[test]
    fn mint_updates_delegated_power() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);

        client.delegate(&alice, &bob);
        client.mint(&alice, &100);
        assert_eq!(client.get_voting_power(&bob), 100);
    }

    #[test]
    fn delegate_to_self_is_undelegate() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);

        client.mint(&alice, &100);
        client.delegate(&alice, &bob);
        assert_eq!(client.get_delegate(&alice), Some(bob.clone()));

        client.delegate(&alice, &alice);
        assert_eq!(client.get_delegate(&alice), None);
        assert_eq!(client.get_voting_power(&alice), 100);
        assert_eq!(client.get_voting_power(&bob), 0);
    }

    // --- additional edge cases ---

    #[test]
    fn transfer_zero_amount_reverts() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);
        client.mint(&alice, &100);
        let result = client.try_transfer(&alice, &bob, &0);
        assert_eq!(
            result.err(),
            Some(Ok(soroban_sdk::Error::from_contract_error(
                GOVError::ZeroAmount as u32
            )))
        );
    }

    #[test]
    fn transfer_from_zero_amount_reverts() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);
        let carol = Address::generate(&e);
        client.mint(&alice, &100);
        client.approve(&alice, &bob, &50, &valid_expiration(&e));
        let result = client.try_transfer_from(&bob, &alice, &carol, &0);
        assert_eq!(
            result.err(),
            Some(Ok(soroban_sdk::Error::from_contract_error(
                GOVError::ZeroAmount as u32
            )))
        );
    }

    #[test]
    fn balance_of_nonexistent_account_is_zero() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let nobody = Address::generate(&e);
        assert_eq!(client.balance(&nobody), 0);
    }

    #[test]
    fn allowance_of_nonexistent_pair_is_zero() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);
        assert_eq!(client.allowance(&alice, &bob), 0);
    }

    #[test]
    fn approve_zero_allowance_works() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);
        client.mint(&alice, &100);
        client.approve(&alice, &bob, &50, &valid_expiration(&e));
        assert_eq!(client.allowance(&alice, &bob), 50);
        // Reset to zero
        client.approve(&alice, &bob, &0, &valid_expiration(&e));
        assert_eq!(client.allowance(&alice, &bob), 0);
    }

    #[test]
    fn transfer_from_with_insufficient_balance_reverts() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);
        let carol = Address::generate(&e);
        client.mint(&alice, &10);
        client.approve(&alice, &bob, &100, &valid_expiration(&e)); // High allowance
        let result = client.try_transfer_from(&bob, &alice, &carol, &50);
        assert_eq!(
            result.err(),
            Some(Ok(soroban_sdk::Error::from_contract_error(
                GOVError::InsufficientFunds as u32
            )))
        );
    }

    #[test]
    fn total_supply_starts_at_zero() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        assert_eq!(client.total_supply(), 0);
    }

    #[test]
    fn get_version_returns_semver() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        assert_eq!(client.get_version(), String::from_str(&e, "1.0.0"));
    }

    #[test]
    fn multiple_mints_to_different_accounts() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);
        let carol = Address::generate(&e);

        client.mint(&alice, &100);
        client.mint(&bob, &200);
        client.mint(&carol, &300);

        assert_eq!(client.balance(&alice), 100);
        assert_eq!(client.balance(&bob), 200);
        assert_eq!(client.balance(&carol), 300);
        assert_eq!(client.total_supply(), 600);
    }

    #[test]
    fn approve_updates_allowance() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);

        client.approve(&alice, &bob, &100, &valid_expiration(&e));
        assert_eq!(client.allowance(&alice, &bob), 100);

        // Update allowance
        client.approve(&alice, &bob, &200, &valid_expiration(&e));
        assert_eq!(client.allowance(&alice, &bob), 200);
    }

    #[test]
    fn transfer_entire_balance_works() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);

        client.mint(&alice, &100);
        client.transfer(&alice, &bob, &100);

        assert_eq!(client.balance(&alice), 0);
        assert_eq!(client.balance(&bob), 100);
    }

    #[test]
    fn transfer_from_entire_allowance_works() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);
        let carol = Address::generate(&e);

        client.mint(&alice, &100);
        client.approve(&alice, &bob, &100, &valid_expiration(&e));
        client.transfer_from(&bob, &alice, &carol, &100);

        assert_eq!(client.balance(&alice), 0);
        assert_eq!(client.balance(&carol), 100);
        assert_eq!(client.allowance(&alice, &bob), 0);
    }

    #[test]
    fn approve_rejects_past_expiration() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        set_ledger_sequence(&e, 10);

        let alice = Address::generate(&e);
        let bob = Address::generate(&e);

        let result = client.try_approve(&alice, &bob, &50, &9);
        assert_eq!(
            result.err(),
            Some(Ok(soroban_sdk::Error::from_contract_error(
                GOVError::InvalidExpiration as u32
            )))
        );
    }

    #[test]
    fn transfer_from_rejects_expired_allowance() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        set_ledger_sequence(&e, 10);

        let alice = Address::generate(&e);
        let bob = Address::generate(&e);
        let carol = Address::generate(&e);

        client.mint(&alice, &100);
        client.approve(&alice, &bob, &80, &10);

        set_ledger_sequence(&e, 11);
        let result = client.try_transfer_from(&bob, &alice, &carol, &20);
        assert_eq!(
            result.err(),
            Some(Ok(soroban_sdk::Error::from_contract_error(
                GOVError::AllowanceExpired as u32
            )))
        );
        assert_eq!(client.allowance(&alice, &bob), 0);
    }

    #[test]
    fn transfer_from_allows_when_expiration_matches_current_ledger() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        set_ledger_sequence(&e, 10);

        let alice = Address::generate(&e);
        let bob = Address::generate(&e);
        let carol = Address::generate(&e);

        client.mint(&alice, &100);
        client.approve(&alice, &bob, &40, &10);
        client.transfer_from(&bob, &alice, &carol, &25);

        assert_eq!(client.balance(&alice), 75);
        assert_eq!(client.balance(&carol), 25);
        assert_eq!(client.allowance(&alice, &bob), 15);
    }

    // --- burning ---

    #[test]
    fn burn_reduces_balance_and_supply() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        client.mint(&alice, &100);
        client.burn(&alice, &40);
        assert_eq!(client.balance(&alice), 60);
        assert_eq!(client.total_supply(), 60);
    }

    #[test]
    fn admin_burn_reduces_balance_and_supply() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        client.mint(&alice, &100);
        client.admin_burn_from(&alice, &40);
        assert_eq!(client.balance(&alice), 60);
        assert_eq!(client.total_supply(), 60);
    }

    #[test]
    fn burn_zero_reverts() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        client.mint(&alice, &100);
        let result = client.try_burn(&alice, &0);
        assert_eq!(
            result.err(),
            Some(Ok(soroban_sdk::Error::from_contract_error(
                GOVError::ZeroAmount as u32
            )))
        );
    }

    #[test]
    fn burn_insufficient_balance_reverts() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        client.mint(&alice, &10);
        let result = client.try_burn(&alice, &50);
        assert_eq!(
            result.err(),
            Some(Ok(soroban_sdk::Error::from_contract_error(
                GOVError::InsufficientFunds as u32
            )))
        );
    }

    #[test]
    fn burn_updates_delegation() {
        let e = Env::default();
        let (_, _, client) = setup(&e);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);
        client.mint(&alice, &100);
        client.delegate(&alice, &bob);
        assert_eq!(client.get_voting_power(&bob), 100);

        client.burn(&alice, &40);
        assert_eq!(client.get_voting_power(&bob), 60);
    }
}
