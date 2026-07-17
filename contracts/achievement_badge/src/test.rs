#![cfg(test)]

use soroban_sdk::symbol_short;

use crate::{AchievementBadge, AchievementBadgeError, DataKey};

#[test]
fn test_initialize() {
    let env = soroban_sdk::Env::default();
    let admin = soroban_sdk::Address::generate(&env);

    AchievementBadge::initialize(&env, admin.clone());

    // Check admin is set
    assert_eq!(AchievementBadge::get_admin(&env), admin);
}

#[test]
fn test_initialize_twice_fails() {
    let env = soroban_sdk::Env::default();
    let admin = soroban_sdk::Address::generate(&env);

    AchievementBadge::initialize(&env, admin.clone());

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        AchievementBadge::initialize(&env, admin);
    }));

    assert!(result.is_err());
}

#[test]
fn test_mint() {
    let env = soroban_sdk::Env::default();
    let admin = soroban_sdk::Address::generate(&env);
    let to = soroban_sdk::Address::generate(&env);
    let badge_type = soroban_sdk::String::from_str(&env, "first_completion");
    let metadata_uri = soroban_sdk::String::from_str(&env, "ipfs://test");

    AchievementBadge::initialize(&env, admin);

    let token_id = AchievementBadge::mint(&env, to.clone(), badge_type.clone(), metadata_uri.clone());

    assert_eq!(token_id, 1);
    assert_eq!(AchievementBadge::owner_of(&env, token_id), to);
    assert_eq!(AchievementBadge::token_uri(&env, token_id), metadata_uri);

    let metadata = AchievementBadge::get_metadata(&env, token_id);
    assert_eq!(metadata.owner, to);
    assert_eq!(metadata.badge_type, badge_type);
    assert_eq!(metadata.metadata_uri, metadata_uri);
}

#[test]
fn test_mint_duplicate_badge_type_fails() {
    let env = soroban_sdk::Env::default();
    let admin = soroban_sdk::Address::generate(&env);
    let to = soroban_sdk::Address::generate(&env);
    let badge_type = soroban_sdk::String::from_str(&env, "first_completion");
    let metadata_uri = soroban_sdk::String::from_str(&env, "ipfs://test");

    AchievementBadge::initialize(&env, admin);

    // First mint should succeed
    AchievementBadge::mint(&env, to.clone(), badge_type.clone(), metadata_uri.clone());

    // Second mint with same badge type should fail
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        AchievementBadge::mint(&env, to, badge_type, metadata_uri);
    }));

    assert!(result.is_err());
}

#[test]
fn test_mint_different_badge_type_succeeds() {
    let env = soroban_sdk::Env::default();
    let admin = soroban_sdk::Address::generate(&env);
    let to = soroban_sdk::Address::generate(&env);
    let badge_type1 = soroban_sdk::String::from_str(&env, "first_completion");
    let badge_type2 = soroban_sdk::String::from_str(&env, "streak_30");
    let metadata_uri = soroban_sdk::String::from_str(&env, "ipfs://test");

    AchievementBadge::initialize(&env, admin);

    // First badge type
    let token_id1 = AchievementBadge::mint(&env, to.clone(), badge_type1.clone(), metadata_uri.clone());
    assert_eq!(token_id1, 1);

    // Different badge type should succeed
    let token_id2 = AchievementBadge::mint(&env, to.clone(), badge_type2.clone(), metadata_uri.clone());
    assert_eq!(token_id2, 2);
}

#[test]
fn test_mint_unauthorized_fails() {
    let env = soroban_sdk::Env::default();
    let admin = soroban_sdk::Address::generate(&env);
    let unauthorized = soroban_sdk::Address::generate(&env);
    let to = soroban_sdk::Address::generate(&env);
    let badge_type = soroban_sdk::String::from_str(&env, "first_completion");
    let metadata_uri = soroban_sdk::String::from_str(&env, "ipfs://test");

    AchievementBadge::initialize(&env, admin);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        AchievementBadge::mint(&env, to, badge_type, metadata_uri);
    }));

    assert!(result.is_err());
}

#[test]
fn test_transfer_soulbound() {
    let env = soroban_sdk::Env::default();
    let admin = soroban_sdk::Address::generate(&env);
    let from = soroban_sdk::Address::generate(&env);
    let to = soroban_sdk::Address::generate(&env);
    let badge_type = soroban_sdk::String::from_str(&env, "first_completion");
    let metadata_uri = soroban_sdk::String::from_str(&env, "ipfs://test");

    AchievementBadge::initialize(&env, admin);

    let token_id = AchievementBadge::mint(&env, from.clone(), badge_type, metadata_uri);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        AchievementBadge::transfer(&env, from, to, token_id);
    }));

    assert!(result.is_err());
}

#[test]
fn test_badges_of() {
    let env = soroban_sdk::Env::default();
    let admin = soroban_sdk::Address::generate(&env);
    let user1 = soroban_sdk::Address::generate(&env);
    let user2 = soroban_sdk::Address::generate(&env);
    let badge_type1 = soroban_sdk::String::from_str(&env, "first_completion");
    let badge_type2 = soroban_sdk::String::from_str(&env, "streak_30");
    let metadata_uri = soroban_sdk::String::from_str(&env, "ipfs://test");

    AchievementBadge::initialize(&env, admin);

    // Mint badges for user1
    AchievementBadge::mint(&env, user1.clone(), badge_type1.clone(), metadata_uri.clone());
    AchievementBadge::mint(&env, user1.clone(), badge_type2.clone(), metadata_uri.clone());

    // Mint badge for user2
    AchievementBadge::mint(&env, user2.clone(), badge_type1, metadata_uri);

    let user1_badges = AchievementBadge::badges_of(&env, user1);
    assert_eq!(user1_badges.len(), 2);

    let user2_badges = AchievementBadge::badges_of(&env, user2);
    assert_eq!(user2_badges.len(), 1);
}

#[test]
fn test_has_badge() {
    let env = soroban_sdk::Env::default();
    let admin = soroban_sdk::Address::generate(&env);
    let user = soroban_sdk::Address::generate(&env);
    let badge_type1 = soroban_sdk::String::from_str(&env, "first_completion");
    let badge_type2 = soroban_sdk::String::from_str(&env, "streak_30");
    let metadata_uri = soroban_sdk::String::from_str(&env, "ipfs://test");

    AchievementBadge::initialize(&env, admin);

    AchievementBadge::mint(&env, user.clone(), badge_type1.clone(), metadata_uri.clone());

    assert!(AchievementBadge::has_badge(&env, user.clone(), badge_type1));
    assert!(!AchievementBadge::has_badge(&env, user, badge_type2));
}

#[test]
fn test_get_badge_token_id() {
    let env = soroban_sdk::Env::default();
    let admin = soroban_sdk::Address::generate(&env);
    let user = soroban_sdk::Address::generate(&env);
    let badge_type = soroban_sdk::String::from_str(&env, "first_completion");
    let metadata_uri = soroban_sdk::String::from_str(&env, "ipfs://test");

    AchievementBadge::initialize(&env, admin);

    let token_id = AchievementBadge::mint(&env, user.clone(), badge_type.clone(), metadata_uri);

    let retrieved_token_id = AchievementBadge::get_badge_token_id(&env, user, badge_type);
    assert_eq!(retrieved_token_id, Some(token_id));
}

#[test]
fn test_transfer_admin() {
    let env = soroban_sdk::Env::default();
    let admin = soroban_sdk::Address::generate(&env);
    let new_admin = soroban_sdk::Address::generate(&env);

    AchievementBadge::initialize(&env, admin.clone());

    AchievementBadge::transfer_admin(&env, new_admin.clone());

    assert_eq!(AchievementBadge::get_admin(&env), new_admin);
}

#[test]
fn test_transfer_admin_unauthorized_fails() {
    let env = soroban_sdk::Env::default();
    let admin = soroban_sdk::Address::generate(&env);
    let unauthorized = soroban_sdk::Address::generate(&env);
    let new_admin = soroban_sdk::Address::generate(&env);

    AchievementBadge::initialize(&env, admin);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        AchievementBadge::transfer_admin(&env, new_admin);
    }));

    assert!(result.is_err());
}
