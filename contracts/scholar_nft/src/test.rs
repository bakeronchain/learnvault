extern crate std;

use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::{NFTError, ScholarNFT, ScholarNFTClient};

#[test]
fn test_initialize_stores_admin_and_sets_token_count() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(ScholarNFT, ());
    let client = ScholarNFTClient::new(&env, &contract_id);

    client.initialize(&admin);

    assert_eq!(client.admin(), admin);
    assert_eq!(client.token_count(), 0);
}

#[test]
fn test_double_initialize_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(ScholarNFT, ());
    let client = ScholarNFTClient::new(&env, &contract_id);

    client.initialize(&admin);

    let result = client.try_initialize(&admin);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            NFTError::AlreadyInitialized as u32
        )))
    );
}

#[test]
fn test_admin_not_initialized_panics() {
    let env = Env::default();
    let contract_id = env.register(ScholarNFT, ());
    let client = ScholarNFTClient::new(&env, &contract_id);

    let result = client.try_admin();

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            NFTError::NotInitialized as u32
        )))
    );
}
