#![cfg(test)]

use crate::{
    AchievementBadge, AchievementBadgeClient, AchievementBadgeError, BadgeMetadata,
    DataKey, MintedEventData,
};
use soroban_sdk::{
    Address, Env, IntoVal, String, symbol_short,
    testutils::{Address as _, MockAuth, MockAuthInvoke},
};

fn setup(env: &Env) -> (Address, Address, AchievementBadgeClient) {
    let admin = Address::generate(env);
    let contract_id = env.register(AchievementBadge, ());
    let client = AchievementBadgeClient::new(env, &contract_id);
    env.mock_all_auths();
    client.initialize(&admin);
    (contract_id, admin, client)
}

fn cid(env: &Env, value: &str) -> String {
    String::from_str(env, value)
}

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(AchievementBadge, ());
    let client = AchievementBadgeClient::new(&env, &contract_id);

    env.mock_all_auths();
    client.initialize(&admin);

    assert_eq!(client.get_admin(), admin);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_initialize_twice_fails() {
    let env = Env::default();
    let (_, admin, client) = setup(&env);
    env.mock_all_auths();
    client.initialize(&admin);
}

#[test]
fn test_mint() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let to = Address::generate(&env);
    let badge_type = cid(&env, "first_completion");
    let metadata_uri = cid(&env, "ipfs://test");

    env.mock_all_auths();
    let token_id = client.mint(&to, &badge_type, &metadata_uri);

    assert_eq!(token_id, 1);
    assert_eq!(client.owner_of(&token_id), to);
    assert_eq!(client.token_uri(&token_id), metadata_uri);

    let metadata = client.get_metadata(&token_id);
    assert_eq!(metadata.owner, to);
    assert_eq!(metadata.badge_type, badge_type);
    assert_eq!(metadata.metadata_uri, metadata_uri);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_mint_duplicate_badge_type_fails() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let to = Address::generate(&env);
    let badge_type = cid(&env, "first_completion");
    let metadata_uri = cid(&env, "ipfs://test");

    env.mock_all_auths();
    client.mint(&to, &badge_type, &metadata_uri);
    client.mint(&to, &badge_type, &metadata_uri);
}

#[test]
fn test_mint_different_badge_type_succeeds() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let to = Address::generate(&env);
    let badge_type1 = cid(&env, "first_completion");
    let badge_type2 = cid(&env, "streak_30");
    let metadata_uri = cid(&env, "ipfs://test");

    env.mock_all_auths();
    let token_id1 = client.mint(&to, &badge_type1, &metadata_uri);
    assert_eq!(token_id1, 1);

    let token_id2 = client.mint(&to, &badge_type2, &metadata_uri);
    assert_eq!(token_id2, 2);
}

#[test]
#[should_panic(expected = "Error(Auth, InvalidAction)")]
fn test_mint_unauthorized_fails() {
    let env = Env::default();
    let (contract_id, _admin, client) = setup(&env);
    let unauthorized = Address::generate(&env);
    let to = Address::generate(&env);
    let badge_type = cid(&env, "first_completion");
    let metadata_uri = cid(&env, "ipfs://test");

    env.mock_auths(&[MockAuth {
        address: &unauthorized,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "mint",
            args: (&to, badge_type.clone(), metadata_uri.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    client.mint(&to, &badge_type, &metadata_uri);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_transfer_soulbound() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let badge_type = cid(&env, "first_completion");
    let metadata_uri = cid(&env, "ipfs://test");

    env.mock_all_auths();
    let token_id = client.mint(&from, &badge_type, &metadata_uri);
    client.transfer(&from, &to, &token_id);
}

#[test]
fn test_badges_of() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let badge_type1 = cid(&env, "first_completion");
    let badge_type2 = cid(&env, "streak_30");
    let metadata_uri = cid(&env, "ipfs://test");

    env.mock_all_auths();
    client.mint(&user1, &badge_type1, &metadata_uri);
    client.mint(&user1, &badge_type2, &metadata_uri);
    client.mint(&user2, &badge_type1, &metadata_uri);

    let user1_badges = client.badges_of(&user1);
    assert_eq!(user1_badges.len(), 2);

    let user2_badges = client.badges_of(&user2);
    assert_eq!(user2_badges.len(), 1);
}

#[test]
fn test_has_badge() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let user = Address::generate(&env);
    let badge_type1 = cid(&env, "first_completion");
    let badge_type2 = cid(&env, "streak_30");
    let metadata_uri = cid(&env, "ipfs://test");

    env.mock_all_auths();
    client.mint(&user, &badge_type1, &metadata_uri);

    assert!(client.has_badge(&user, &badge_type1));
    assert!(!client.has_badge(&user, &badge_type2));
}

#[test]
fn test_get_badge_token_id() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let user = Address::generate(&env);
    let badge_type = cid(&env, "first_completion");
    let metadata_uri = cid(&env, "ipfs://test");

    env.mock_all_auths();
    let token_id = client.mint(&user, &badge_type, &metadata_uri);

    let retrieved_token_id = client.get_badge_token_id(&user, &badge_type);
    assert_eq!(retrieved_token_id, Some(token_id));
}

#[test]
fn test_transfer_admin() {
    let env = Env::default();
    let (_, old_admin, client) = setup(&env);
    let new_admin = Address::generate(&env);

    env.mock_all_auths();
    client.transfer_admin(&new_admin);

    assert_eq!(client.get_admin(), new_admin);
}

#[test]
#[should_panic(expected = "Error(Auth, InvalidAction)")]
fn test_transfer_admin_unauthorized_fails() {
    let env = Env::default();
    let (contract_id, _admin, client) = setup(&env);
    let unauthorized = Address::generate(&env);
    let new_admin = Address::generate(&env);

    env.mock_auths(&[MockAuth {
        address: &unauthorized,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "transfer_admin",
            args: (&new_admin,).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    client.transfer_admin(&new_admin);
}

#[test]
fn mint_emits_event() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let to = Address::generate(&env);
    let badge_type = cid(&env, "first_completion");
    let metadata_uri = cid(&env, "ipfs://test");

    env.mock_all_auths();
    let token_id = client.mint(&to, &badge_type, &metadata_uri);

    let events = env.events().all();
    let found = events.iter().any(|(_, topics, data)| {
        topics.contains(&symbol_short!("minted").into_val(&env))
            && topics.contains(&token_id.into_val(&env))
            && {
                let d: MintedEventData = data.clone().into_val(&env);
                d == MintedEventData {
                    token_id,
                    owner: to.clone(),
                    badge_type: badge_type.clone(),
                }
            }
    });
    assert!(found, "minted event not found");
}
