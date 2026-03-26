extern crate std;

use soroban_sdk::{testutils::Address as _, Address, Env, IntoVal, String};

use crate::{ScholarNFT, ScholarNFTClient, ScholarNFTError};

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
    let admin = Address::generate(&env);
    let contract_id = env.register(ScholarNFT, ());
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &admin,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &contract_id,
            fn_name: "initialize",
            args: (admin.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let client = ScholarNFTClient::new(&env, &contract_id);
    client.initialize(&admin);

    let scholar = Address::generate(&env);
    let result = client.try_mint(&scholar, &cid(&env, "ipfs://unauthorized"));

    assert!(result.is_err());
}

#[test]
fn transfer_always_panics() {
    let env = Env::default();
    let (_, _, client) = setup(&env);
    let from = Address::generate(&env);
    let token_id = client.mint(&from, &cid(&env, "ipfs://soulbound"));

    let to = Address::generate(&env);
    let result = client.try_transfer(&from, &to, &token_id);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            ScholarNFTError::Soulbound as u32
        )))
    );
}

#[test]
fn owner_of_missing_token_panics() {
    let env = Env::default();
    let (_, _, client) = setup(&env);

    let result = client.try_owner_of(&99);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            ScholarNFTError::TokenNotFound as u32
        )))
    );
}

#[test]
fn token_uri_missing_token_panics() {
    let env = Env::default();
    let (_, _, client) = setup(&env);

    let result = client.try_token_uri(&99);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            ScholarNFTError::TokenNotFound as u32
        )))
    );
}

#[test]
fn mint_before_initialize_panics() {
    let env = Env::default();
    let contract_id = env.register(ScholarNFT, ());
    env.mock_all_auths();
    let client = ScholarNFTClient::new(&env, &contract_id);
    let scholar = Address::generate(&env);

    let result = client.try_mint(&scholar, &cid(&env, "ipfs://before-init"));

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            ScholarNFTError::NotInitialized as u32
        )))
    );
}

#[test]
fn duplicate_mint_for_same_scholar_panics() {
    let env = Env::default();
    let (_, _, client) = setup(&env);
    let scholar = Address::generate(&env);

    client.mint(&scholar, &cid(&env, "ipfs://first"));
    let result = client.try_mint(&scholar, &cid(&env, "ipfs://second"));

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            ScholarNFTError::ScholarAlreadyMinted as u32
        )))
    );
}

#[test]
fn get_token_and_has_credential() {
    let env = Env::default();
    let (_, _, client) = setup(&env);
    let scholar = Address::generate(&env);

    assert!(!client.has_credential(&scholar));
    assert_eq!(client.get_token(&scholar), None);

    let token_id = client.mint(&scholar, &cid(&env, "ipfs://credential"));

    assert!(client.has_credential(&scholar));
    assert_eq!(client.get_token(&scholar), Some(token_id));
}

#[test]
fn get_metadata_returns_stored_data() {
    let env = Env::default();
    let (_, _, client) = setup(&env);
    let scholar = Address::generate(&env);
    let uri = cid(&env, "ipfs://meta-test");

    let token_id = client.mint(&scholar, &uri);

    let meta = client.get_metadata(&token_id).unwrap();
    assert_eq!(meta.scholar, scholar);
    assert_eq!(meta.ipfs_uri, Some(uri));
}
