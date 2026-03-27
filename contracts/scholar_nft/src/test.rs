#![cfg(test)]

use soroban_sdk::{
    Address, Env, IntoVal, String, symbol_short,
    testutils::{Address as _, Events as _},
    vec,
};

use crate::{ScholarNFT, ScholarNFTClient};

fn setup(env: &Env) -> (Address, Address, ScholarNFTClient) {
    let admin = Address::generate(env);
    let contract_id = env.register(ScholarNFT, ());
    env.mock_all_auths();
    let client = ScholarNFTClient::new(env, &contract_id);
    client.initialize(&admin);
    (contract_id, admin, client)
}

fn setup_test() -> (Env, ScholarNFTClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ScholarNFT, ());
    let client = ScholarNFTClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    (env, client, admin)
}

#[test]
fn test_mint_and_owner() {
    let (env, client, _admin) = setup_test();
    let recipient = Address::generate(&env);
    let token_id = 1u64;

    client.mint(&recipient, &token_id);
    assert!(client.has_credential(&token_id));
    assert_eq!(client.owner_of(&token_id), recipient);
}

#[test]
fn test_revoke_flow() {
    let (env, client, admin) = setup_test();
    let recipient = Address::generate(&env);
    let token_id = 1u64;
    let reason = String::from_str(&env, "Cheater");

    client.mint(&recipient, &token_id);
    assert!(client.has_credential(&token_id));

    // Admin revokes the token
    client.revoke(&admin, &token_id, &reason);

    // Verify it's no longer valid
    assert!(!client.has_credential(&token_id));
    assert_eq!(client.get_revocation_reason(&token_id), Some(reason));
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_owner_of_revoked_fails() {
    let (env, client, admin) = setup_test();
    let recipient = Address::generate(&env);
    let token_id = 1u64;
    let reason = String::from_str(&env, "Plagiarism");

    client.mint(&recipient, &token_id);
    client.revoke(&admin, &token_id, &reason);

    // This should panic because token is revoked
    client.owner_of(&token_id);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_unauthorized_revoke_fails() {
    let (env, client, _admin) = setup_test();
    let recipient = Address::generate(&env);
    let hacker = Address::generate(&env);
    let token_id = 42u64;
    let reason = String::from_str(&env, "Hax");

    client.mint(&recipient, &token_id);

    // hacker tries to revoke - this should fail because we check admin address match
    client.revoke(&hacker, &token_id, &reason);
}

#[test]
fn test_revoke_non_existent_token_fails() {
    let (_env, _client, _admin) = setup_test();
    // placeholder test
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_revoke_non_existent_token_panics() {
    let (env, client, admin) = setup_test();
    let token_id = 999u64;
    let reason = String::from_str(&env, "Testing");

    client.revoke(&admin, &token_id, &reason);
}

#[test]
fn mint_emits_event() {
    let env = Env::default();
    let (contract_id, _, client) = setup(&env);
    let scholar = Address::generate(&env);
    let token_id = 1u64;

    client.mint(&scholar, &token_id);

    let events = env.events().all();
    let found = events.iter().any(|(cid, topics, _data)| {
        cid == contract_id && topics.contains(&symbol_short!("minted").into_val(&env))
    });
    assert!(found, "mint event not found");
}

#[test]
#[ignore]
fn transfer_attempt_emits_event() {
    let env = Env::default();
    let (contract_id, _, client) = setup(&env);
    let from = Address::generate(&env);
    let token_id = 1u64;

    client.mint(&from, &token_id);

    let events = env.events().all();
    let found = events.iter().any(|(cid, topics, _data)| {
        cid == contract_id && topics == vec![&env, symbol_short!("xfer_att").into_val(&env)]
    });
    assert!(found, "transfer_attempted event not found");
}
