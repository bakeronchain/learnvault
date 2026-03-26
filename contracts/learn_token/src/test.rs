#![cfg(test)]

use proptest::prelude::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    #[test]
    #[ignore]
    fn test_fuzz_mint_random_amounts(amount in 0..u128::MAX) {
        let env = Env::default();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        env.mock_all_auths();

        // Register the standard generic Soroban token (LearnToken equivalent)
        let token_contract_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_id = token_contract_id.address();
        
        let client = StellarAssetClient::new(&env, &token_id);
        let token_client = TokenClient::new(&env, &token_id);

        let safe_amount = if amount > i128::MAX as u128 {
            i128::MAX
        } else {
            amount as i128
        };

        // Execute mint
        client.mint(&user, &safe_amount);

        // Verify balance and no panic
        let balance = token_client.balance(&user);
        assert_eq!(balance, safe_amount);
    }
extern crate std;

use soroban_sdk::{Address, Env, IntoVal, testutils::{Address as _, Events as _}};

use crate::{LRNError, LearnToken, LearnTokenClient};

fn setup(e: &Env) -> (Address, Address, LearnTokenClient) {
    let admin = Address::generate(e);
    let id = e.register(LearnToken, ());
    e.mock_all_auths();
    let client = LearnTokenClient::new(e, &id);
    client.initialize(&admin);
    (id, admin, client)
}

// --- mint: happy path ---

#[test]
fn mint_increases_balance_and_supply() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let learner = Address::generate(&e);

    client.mint(&learner, &100);

    assert_eq!(client.balance(&learner), 100);
    assert_eq!(client.total_supply(), 100);
}

#[test]
fn mint_accumulates_on_repeated_calls() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let learner = Address::generate(&e);

    client.mint(&learner, &200);
    client.mint(&learner, &300);

    assert_eq!(client.balance(&learner), 500);
    assert_eq!(client.total_supply(), 500);
}

#[test]
fn mint_to_multiple_accounts_tracks_supply() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let alice = Address::generate(&e);
    let bob = Address::generate(&e);

    client.mint(&alice, &100);
    client.mint(&bob, &250);

    assert_eq!(client.balance(&alice), 100);
    assert_eq!(client.balance(&bob), 250);
    assert_eq!(client.total_supply(), 350);
}

// --- mint: event emission ---

#[test]
fn mint_emits_event() {
    let e = Env::default();
    let (contract_id, _, client) = setup(&e);
    let learner = Address::generate(&e);

    client.mint(&learner, &42);

    let events = e.events().all();
    // Find the lrn_mint event — check contract id and that the topic tuple
    // contains the "lrn_mint" symbol and the recipient address.
    use soroban_sdk::{symbol_short, vec};
    let found = events.iter().any(|(cid, topics, _data)| {
        cid == contract_id
            && topics
                == vec![
                    &e,
                    symbol_short!("lrn_mint").into_val(&e),
                    learner.clone().into_val(&e),
                ]
    });
    assert!(found, "lrn_mint event not found");
}

// --- mint: non-admin panics ---

#[test]
fn non_admin_mint_panics() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let id = e.register(LearnToken, ());

    // Only mock auth for initialize, not for mint
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

    let learner = Address::generate(&e);
    let result = client.try_mint(&learner, &100);
    assert!(result.is_err());
}

// --- mint: zero amount panics ---

#[test]
fn zero_amount_mint_panics() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let learner = Address::generate(&e);

    let result = client.try_mint(&learner, &0);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            LRNError::ZeroAmount as u32
        )))
    );
}

#[test]
fn negative_amount_mint_panics() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let learner = Address::generate(&e);

    let result = client.try_mint(&learner, &-1);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            LRNError::ZeroAmount as u32
        )))
    );
}

// --- misc ---

#[test]
fn balance_of_unknown_account_is_zero() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    assert_eq!(client.balance(&Address::generate(&e)), 0);
}

#[test]
fn total_supply_starts_at_zero() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    assert_eq!(client.total_supply(), 0);
}
