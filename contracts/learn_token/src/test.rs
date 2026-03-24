extern crate std;

use soroban_sdk::{testutils::Address as _, Address, Env, IntoVal, String};

use crate::{LRNError, LearnToken, LearnTokenClient};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn setup(e: &Env) -> (Address, Address, LearnTokenClient) {
    let admin = Address::generate(e);
    let id = e.register(LearnToken, ());
    e.mock_all_auths();
    let client = LearnTokenClient::new(e, &id);
    client.initialize(&admin);
    (id, admin, client)
}

fn cid(e: &Env, s: &str) -> String {
    String::from_str(e, s)
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

#[test]
fn initialize_stores_metadata() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    assert_eq!(client.name(), String::from_str(&e, "LearnToken"));
    assert_eq!(client.symbol(), String::from_str(&e, "LRN"));
    assert_eq!(client.decimals(), 7);
}

#[test]
fn double_initialize_reverts() {
    let e = Env::default();
    let (_, admin, client) = setup(&e);
    let result = client.try_initialize(&admin);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            LRNError::Unauthorized as u32
        )))
    );
}

#[test]
fn pre_init_reads_return_defaults() {
    let e = Env::default();
    let id = e.register(LearnToken, ());
    let client = LearnTokenClient::new(&e, &id);
    let stranger = Address::generate(&e);
    assert_eq!(client.balance(&stranger), 0);
    assert_eq!(client.reputation_score(&stranger), 0);
    assert_eq!(client.total_supply(), 0);
    assert_eq!(client.decimals(), 7);
    assert_eq!(client.name(), String::from_str(&e, "LearnToken"));
    assert_eq!(client.symbol(), String::from_str(&e, "LRN"));
}

// ---------------------------------------------------------------------------
// Minting
// ---------------------------------------------------------------------------

#[test]
fn mint_increases_balance_and_total_supply() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let learner = Address::generate(&e);
    client.mint(&learner, &100, &cid(&e, "web3-101"));
    assert_eq!(client.balance(&learner), 100);
    assert_eq!(client.total_supply(), 100);
}

#[test]
fn mint_accumulates_across_multiple_calls() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let learner = Address::generate(&e);
    client.mint(&learner, &50, &cid(&e, "web3-101"));
    client.mint(&learner, &75, &cid(&e, "defi-201"));
    client.mint(&learner, &25, &cid(&e, "zk-301"));
    assert_eq!(client.balance(&learner), 150);
    assert_eq!(client.total_supply(), 150);
}

#[test]
fn mint_zero_amount_reverts() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let learner = Address::generate(&e);
    let result = client.try_mint(&learner, &0, &cid(&e, "web3-101"));
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            LRNError::ZeroAmount as u32
        )))
    );
}

#[test]
fn mint_negative_amount_reverts() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let learner = Address::generate(&e);
    let result = client.try_mint(&learner, &-1, &cid(&e, "web3-101"));
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            LRNError::ZeroAmount as u32
        )))
    );
}

#[test]
fn mint_before_initialize_reverts() {
    let e = Env::default();
    let id = e.register(LearnToken, ());
    e.mock_all_auths();
    let client = LearnTokenClient::new(&e, &id);
    let learner = Address::generate(&e);
    let result = client.try_mint(&learner, &100, &cid(&e, "web3-101"));
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            LRNError::NotInitialized as u32
        )))
    );
}

// ---------------------------------------------------------------------------
// Soulbound enforcement
// ---------------------------------------------------------------------------

#[test]
fn transfer_is_blocked() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let a = Address::generate(&e);
    let b = Address::generate(&e);
    client.mint(&a, &50, &cid(&e, "web3-101"));
    let result = client.try_transfer(&a, &b, &10);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            LRNError::Soulbound as u32
        )))
    );
}

#[test]
fn transfer_from_is_blocked() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let spender = Address::generate(&e);
    let from = Address::generate(&e);
    let to = Address::generate(&e);
    client.mint(&from, &50, &cid(&e, "web3-101"));
    let result = client.try_transfer_from(&spender, &from, &to, &10);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            LRNError::Soulbound as u32
        )))
    );
}

#[test]
fn approve_is_blocked() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let from = Address::generate(&e);
    let spender = Address::generate(&e);
    let result = client.try_approve(&from, &spender, &100, &1000);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            LRNError::Soulbound as u32
        )))
    );
}

#[test]
fn allowance_always_zero() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let a = Address::generate(&e);
    let b = Address::generate(&e);
    assert_eq!(client.allowance(&a, &b), 0);
}

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

#[test]
fn unauthorized_mint_fails() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let id = e.register(LearnToken, ());
    // Mock only the admin auth for initialize
    e.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &admin,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &id,
            fn_name: "initialize",
            args: (admin.clone(),).into_val(&e),
            sub_invokes: &[],
        },
    }]);
    let client = LearnTokenClient::new(&e, &id);
    client.initialize(&admin);

    // Now call mint with no auth mocked — should fail
    let learner = Address::generate(&e);
    let result = client.try_mint(&learner, &100, &cid(&e, "web3-101"));
    assert!(result.is_err());
}

#[test]
fn set_admin_updates_admin() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let new_admin = Address::generate(&e);
    client.set_admin(&new_admin);
    let learner = Address::generate(&e);
    client.mint(&learner, &10, &cid(&e, "web3-101"));
    assert_eq!(client.balance(&learner), 10);
}

#[test]
fn set_admin_before_initialize_reverts() {
    let e = Env::default();
    let id = e.register(LearnToken, ());
    e.mock_all_auths();
    let client = LearnTokenClient::new(&e, &id);
    let new_admin = Address::generate(&e);
    let result = client.try_set_admin(&new_admin);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            LRNError::NotInitialized as u32
        )))
    );
}

// ---------------------------------------------------------------------------
// reputation_score
// ---------------------------------------------------------------------------

#[test]
fn reputation_score_is_zero_for_fresh_address() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let learner = Address::generate(&e);
    assert_eq!(client.reputation_score(&learner), 0);
    assert_eq!(client.balance(&learner), 0);
}

#[test]
fn reputation_score_mirrors_balance_after_mint() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let learner = Address::generate(&e);
    client.mint(&learner, &200, &cid(&e, "defi-201"));
    assert_eq!(client.reputation_score(&learner), client.balance(&learner));
    assert_eq!(client.reputation_score(&learner), 200);
}
