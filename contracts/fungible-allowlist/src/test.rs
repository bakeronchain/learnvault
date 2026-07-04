#![cfg(test)]

extern crate std;

use soroban_sdk::{
    Address, Env,
    testutils::{Address as _, Events as _},
};

use crate::{AllowlistError, FungibleAllowlist, FungibleAllowlistClient};

fn setup(env: &Env) -> (Address, Address, FungibleAllowlistClient) {
    let admin = Address::generate(env);
    let contract_id = env.register(FungibleAllowlist, ());
    env.mock_all_auths();
    let client = FungibleAllowlistClient::new(env, &contract_id);
    client.initialize(&admin);
    (contract_id, admin, client)
}

// --- initialization ---

#[test]
fn initialize_sets_admin_and_emits_event() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(FungibleAllowlist, ());
    env.mock_all_auths();
    let client = FungibleAllowlistClient::new(&env, &contract_id);

    let baseline = env.events().all().len();
    client.initialize(&admin);

    let events = env.events().all();
    assert!(events.len() > baseline);
    assert!(events.iter().any(|(cid, _, _)| cid == contract_id));
}

#[test]
fn double_initialize_is_rejected() {
    let env = Env::default();
    let (_, admin, client) = setup(&env);

    let result = client.try_initialize(&admin);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            AllowlistError::AlreadyInitialized as u32,
        ))),
    );
}

// --- add to allowlist ---

#[test]
fn add_to_allowlist_marks_address_as_allowed() {
    let env = Env::default();
    let (_, admin, client) = setup(&env);
    let alice = Address::generate(&env);

    assert!(!client.is_allowed(&alice));
    client.add_to_allowlist(&admin, &alice);
    assert!(client.is_allowed(&alice));
}

#[test]
fn add_to_allowlist_emits_event() {
    let env = Env::default();
    let (contract_id, admin, client) = setup(&env);
    let alice = Address::generate(&env);

    client.add_to_allowlist(&admin, &alice);

    let events = env.events().all();
    assert!(!events.is_empty());
    assert!(events.iter().any(|(cid, _, _)| cid == contract_id));
}

#[test]
fn duplicate_add_is_idempotent() {
    let env = Env::default();
    let (_, admin, client) = setup(&env);
    let alice = Address::generate(&env);

    client.add_to_allowlist(&admin, &alice);
    client.add_to_allowlist(&admin, &alice);
    assert!(client.is_allowed(&alice));
}

// --- remove from allowlist ---

#[test]
fn remove_from_allowlist_marks_address_as_not_allowed() {
    let env = Env::default();
    let (_, admin, client) = setup(&env);
    let alice = Address::generate(&env);

    client.add_to_allowlist(&admin, &alice);
    assert!(client.is_allowed(&alice));

    client.remove_from_allowlist(&admin, &alice);
    assert!(!client.is_allowed(&alice));
}

#[test]
fn remove_from_allowlist_emits_event() {
    let env = Env::default();
    let (contract_id, admin, client) = setup(&env);
    let alice = Address::generate(&env);

    client.add_to_allowlist(&admin, &alice);
    env.events().all();  // consume prior events
    client.remove_from_allowlist(&admin, &alice);

    let events = env.events().all();
    assert!(!events.is_empty());
    assert!(events.iter().any(|(cid, _, _)| cid == contract_id));
}

#[test]
fn remove_non_allowlisted_address_is_noop() {
    let env = Env::default();
    let (_, admin, client) = setup(&env);
    let alice = Address::generate(&env);

    client.remove_from_allowlist(&admin, &alice);
    assert!(!client.is_allowed(&alice));
}

// --- transfer gating (allowlist semantics) ---

#[test]
fn non_allowlisted_address_is_blocked() {
    let env = Env::default();
    let (_, _, client) = setup(&env);
    let stranger = Address::generate(&env);

    assert!(!client.is_allowed(&stranger));
}

#[test]
fn allowlisted_address_is_permitted() {
    let env = Env::default();
    let (_, admin, client) = setup(&env);
    let alice = Address::generate(&env);

    client.add_to_allowlist(&admin, &alice);

    assert!(client.is_allowed(&alice));
}

#[test]
fn removed_address_is_blocked_again() {
    let env = Env::default();
    let (_, admin, client) = setup(&env);
    let alice = Address::generate(&env);

    client.add_to_allowlist(&admin, &alice);
    client.remove_from_allowlist(&admin, &alice);

    assert!(!client.is_allowed(&alice));
}

// --- admin controls ---

#[test]
fn non_admin_cannot_add_to_allowlist() {
    let env = Env::default();
    let (_, _, client) = setup(&env);
    let attacker = Address::generate(&env);
    let victim = Address::generate(&env);

    let result = client.try_add_to_allowlist(&attacker, &victim);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            AllowlistError::Unauthorized as u32,
        ))),
    );
    assert!(!client.is_allowed(&victim));
}

#[test]
fn non_admin_cannot_remove_from_allowlist() {
    let env = Env::default();
    let (_, admin, client) = setup(&env);
    let alice = Address::generate(&env);
    let attacker = Address::generate(&env);

    client.add_to_allowlist(&admin, &alice);

    let result = client.try_remove_from_allowlist(&attacker, &alice);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            AllowlistError::Unauthorized as u32,
        ))),
    );
    assert!(client.is_allowed(&alice));
}

#[test]
fn non_admin_cannot_set_admin() {
    let env = Env::default();
    let (_, _, client) = setup(&env);
    let attacker = Address::generate(&env);
    let new_admin = Address::generate(&env);

    let result = client.try_set_admin(&attacker, &new_admin);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            AllowlistError::Unauthorized as u32,
        ))),
    );
}

#[test]
fn set_admin_transfers_admin_authority() {
    let env = Env::default();
    let (_, admin, client) = setup(&env);
    let new_admin = Address::generate(&env);
    let alice = Address::generate(&env);

    client.set_admin(&admin, &new_admin);

    let result = client.try_add_to_allowlist(&admin, &alice);
    assert!(result.is_err());

    client.add_to_allowlist(&new_admin, &alice);
    assert!(client.is_allowed(&alice));
}

// --- edge cases ---

#[test]
fn empty_allowlist_has_no_allowed_addresses() {
    let env = Env::default();
    let (_, _, client) = setup(&env);
    let stranger = Address::generate(&env);

    assert!(!client.is_allowed(&stranger));
    assert_eq!(client.get_allowlist().len(), 0);
}

#[test]
fn multiple_addresses_tracked_independently() {
    let env = Env::default();
    let (_, admin, client) = setup(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let carol = Address::generate(&env);

    client.add_to_allowlist(&admin, &alice);
    client.add_to_allowlist(&admin, &bob);

    assert!(client.is_allowed(&alice));
    assert!(client.is_allowed(&bob));
    assert!(!client.is_allowed(&carol));
}

#[test]
fn add_before_initialize_is_rejected() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    let contract_id = env.register(FungibleAllowlist, ());
    env.mock_all_auths();
    let client = FungibleAllowlistClient::new(&env, &contract_id);

    let result = client.try_add_to_allowlist(&admin, &alice);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            AllowlistError::NotInitialized as u32,
        ))),
    );
}

// --- benchmark ---

#[test]
fn benchmark_costs() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let alice = Address::generate(&env);

    let contract_id = env.register(FungibleAllowlist, ());
    let client = FungibleAllowlistClient::new(&env, &contract_id);

    env.cost_estimate().budget().reset_unlimited();
    env.mock_all_auths();
    client.initialize(&admin);
    let init_instr = env.cost_estimate().budget().cpu_instruction_cost();
    let init_mem = env.cost_estimate().budget().memory_bytes_cost();

    env.cost_estimate().budget().reset_unlimited();
    client.add_to_allowlist(&admin, &alice);
    let add_instr = env.cost_estimate().budget().cpu_instruction_cost();
    let add_mem = env.cost_estimate().budget().memory_bytes_cost();

    std::println!("BENCHMARK_RESULTS: fungible_allowlist");
    std::println!("initialize: instr={}, mem={}", init_instr, init_mem);
    std::println!("add_to_allowlist: instr={}, mem={}", add_instr, add_mem);
}
