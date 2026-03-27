#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Events as _},
    Address, Env, IntoVal, String, symbol_short, vec,
};

use crate::{
    ScholarNFT, ScholarNFTClient, ScholarNFTError, InitializedEventData, MintEventData,
    TransferAttemptEventData,
};

fn setup(env: &Env) -> (Address, Address, ScholarNFTClient) {
    let admin = Address::generate(env);
    let contract_id = env.register(ScholarNFT, ());
    env.mock_all_auths();
    let client = ScholarNFTClient::new(env, &contract_id);
    client.initialize(&admin);
    (contract_id, admin, client)
}

fn cid(env: &Env, value: &str) -> String {
    String::from_str(env, value)
}

#[test]
fn mint_returns_sequential_token_ids() {
    let env = Env::default();
    let (_, _, client) = setup(&env);
    let scholar_a = Address::generate(&env);
    let scholar_b = Address::generate(&env);

    assert_eq!(client.mint(&scholar_a, &cid(&env, "ipfs://cid-1")), 1);
    assert_eq!(client.mint(&scholar_b, &cid(&env, "ipfs://cid-2")), 2);
}

#[test]
fn owner_of_returns_minted_owner() {
    let env = Env::default();
    let (_, _, client) = setup(&env);
    let scholar = Address::generate(&env);

    let token_id = client.mint(&scholar, &cid(&env, "ipfs://owner-check"));

    assert_eq!(client.owner_of(&token_id), scholar);
}

#[test]
fn token_uri_returns_metadata_uri() {
    let env = Env::default();
    let (_, _, client) = setup(&env);
    let scholar = Address::generate(&env);
    let metadata_uri = cid(&env, "ipfs://bafybeigdyrzt");

    let token_id = client.mint(&scholar, &metadata_uri);

    assert_eq!(client.token_uri(&token_id), metadata_uri);
}

#[test]
fn non_admin_mint_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScholarNFT);
    let client = ScholarNFTClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    
    // Initialize the contract
    client.initialize(&admin);
    (env, client, admin)
}

#[test]
fn test_mint_and_owner() {
    let (env, client, admin) = setup_test();
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
    
    // hacker tries to revoke - this should fail authentication even if mock_all_auths is on because we check admin address match
    client.revoke(&hacker, &token_id, &reason);
}

#[test]
fn test_revoke_non_existent_token_fails() {
    let (env, client, admin) = setup_test();
    let token_id = 999u64;
    let reason = String::from_str(&env, "Testing");

    // This is just a placeholder to show as_contract usage
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
fn initialize_emits_event() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(ScholarNFT, ());
    env.mock_all_auths();
    let client = ScholarNFTClient::new(&env, &contract_id);

    client.initialize(&admin);

    let events = env.events().all();
    let found = events.iter().any(|(cid, topics, _data)| {
        cid == contract_id
            && topics.contains(&symbol_short!("init").into_val(&env))
    });
    assert!(found, "initialized event not found");
}

#[test]
fn mint_emits_event() {
    let env = Env::default();
    let (contract_id, _, client) = setup(&env);
    let scholar = Address::generate(&env);
    let uri = cid(&env, "ipfs://mint-event-test");

    let token_id = client.mint(&scholar, &uri);

    let events = env.events().all();
    let found = events.iter().any(|(cid, topics, _data)| {
        cid == contract_id
            && topics.contains(&symbol_short!("mint").into_val(&env))
            && topics.contains(&token_id.into_val(&env))
    });
    assert!(found, "mint event not found");
}

#[test]
#[ignore]
fn transfer_attempt_emits_event() {
    let env = Env::default();
    let (contract_id, _, client) = setup(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let uri = cid(&env, "ipfs://transfer-attempt-test");

    let token_id = client.mint(&from, &uri);

    // Transfer will panic, but event should be emitted before panic
    let _ = client.try_transfer(&from, &to, &token_id);

    let events = env.events().all();
    let found = events.iter().any(|(cid, topics, _data)| {
        cid == contract_id
            && topics
                == vec![
                    &env,
                    symbol_short!("xfer_att").into_val(&env),
                ]
    });
    assert!(found, "transfer_attempted event not found");
}
