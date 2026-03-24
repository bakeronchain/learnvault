extern crate std;

use soroban_sdk::{testutils::{Address as _, Events as _}, Address, Env, IntoVal, String};
use soroban_sdk::{Address, Env, testutils::Address as _};

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

// ---------------------------------------------------------------------------
// set_admin — unauthorised caller branch (100% branch coverage gap)
// ---------------------------------------------------------------------------

/// A stranger (non-admin) must not be able to hijack the admin role.
/// This exercises the `admin.require_auth()` failure branch inside `set_admin`.
#[test]
fn set_admin_by_non_admin_fails() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let id = e.register(LearnToken, ());
    // Authorise only the `initialize` call for the real admin.
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

    // No auth mocked for the stranger → require_auth fails.
    let stranger = Address::generate(&e);
    let result = client.try_set_admin(&stranger);
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// CourseMilestone contract as exclusive minter
// ---------------------------------------------------------------------------

/// Demonstrates that once the admin role is transferred to the CourseMilestone
/// contract address, only that contract can call `mint` — the original
/// initialiser is locked out.
#[test]
fn only_course_milestone_contract_can_mint() {
    let e = Env::default();
    let deployer = Address::generate(&e);
    let id = e.register(LearnToken, ());

    // Initialise with deployer as temporary admin.
    e.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &deployer,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &id,
            fn_name: "initialize",
            args: (deployer.clone(),).into_val(&e),
            sub_invokes: &[],
        },
    }]);
    let client = LearnTokenClient::new(&e, &id);
    client.initialize(&deployer);

    // Simulate the CourseMilestone contract address.
    let course_milestone = Address::generate(&e);

    // Transfer admin to CourseMilestone; authorised by deployer.
    e.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &deployer,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &id,
            fn_name: "set_admin",
            args: (course_milestone.clone(),).into_val(&e),
            sub_invokes: &[],
        },
    }]);
    client.set_admin(&course_milestone);

    // CourseMilestone (new admin) can mint.
    let learner = Address::generate(&e);
    e.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &course_milestone,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &id,
            fn_name: "mint",
            args: (learner.clone(), 100_i128, cid(&e, "web3-101")).into_val(&e),
            sub_invokes: &[],
        },
    }]);
    client.mint(&learner, &100, &cid(&e, "web3-101"));
    assert_eq!(client.balance(&learner), 100);

    // Deployer is no longer admin — mint must fail (no auth mocked).
    let result = client.try_mint(&learner, &50, &cid(&e, "web3-102"));
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// Multiple learners — balance isolation and total-supply accumulation
// ---------------------------------------------------------------------------

#[test]
fn multiple_learners_have_independent_balances() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let alice = Address::generate(&e);
    let bob = Address::generate(&e);
    let carol = Address::generate(&e);

    client.mint(&alice, &100, &cid(&e, "web3-101"));
    client.mint(&bob, &200, &cid(&e, "defi-201"));
    client.mint(&carol, &300, &cid(&e, "zk-301"));

    assert_eq!(client.balance(&alice), 100);
    assert_eq!(client.balance(&bob), 200);
    assert_eq!(client.balance(&carol), 300);
    assert_eq!(client.total_supply(), 600);
}

#[test]
fn balance_is_unaffected_by_other_learners_mints() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let alice = Address::generate(&e);
    let bob = Address::generate(&e);

    client.mint(&alice, &50, &cid(&e, "web3-101"));
    let alice_balance_before = client.balance(&alice);

    // Minting to Bob must not change Alice's balance.
    client.mint(&bob, &999, &cid(&e, "defi-201"));
    assert_eq!(client.balance(&alice), alice_balance_before);
}

// ---------------------------------------------------------------------------
// Event emission
// ---------------------------------------------------------------------------

/// After a successful `mint`, exactly one `MilestoneCompleted` event is
/// published.  We check count rather than exact field values so the test
/// remains stable across SDK serialisation changes.
#[test]
fn mint_emits_one_event() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let learner = Address::generate(&e);

    let before = e.events().all().len();
    client.mint(&learner, &100, &cid(&e, "web3-101"));
    assert_eq!(e.events().all().len(), before + 1);
}

/// The Soroban test host scopes `env.events()` to the most recent top-level
/// invocation, so every individual `mint` call emits exactly one event.
#[test]
fn each_mint_call_emits_exactly_one_event() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    let learner = Address::generate(&e);

    client.mint(&learner, &100, &cid(&e, "web3-101"));
    assert_eq!(e.events().all().len(), 1);

    // Second independent call — the buffer is scoped per invocation, so
    // there is still exactly one event (from this call) in the window.
    client.mint(&learner, &50, &cid(&e, "defi-201"));
    assert_eq!(e.events().all().len(), 1);
}

// ---------------------------------------------------------------------------
// "Zero address" criterion
// ---------------------------------------------------------------------------
//
// In Soroban / Stellar there is no "zero address" concept equivalent to
// Ethereum's 0x000…000.  Every `Address` value is either a valid Ed25519
// account public key or a 32-byte contract hash — the SDK enforces this at
// the XDR layer so a null/invalid address can never be constructed in safe
// Rust.  The guard that EVM contracts need (e.g. `require(to != address(0))`)
// is therefore structurally unnecessary and absent from this contract.
//
// The test below confirms the closest observable property: minting to a
// freshly-generated address (one that has never appeared on-chain) works
// correctly and does not silently lose tokens.
#[test]
fn mint_to_fresh_address_is_credited_correctly() {
    let e = Env::default();
    let (_, _, client) = setup(&e);
    // Address::generate produces a brand-new address with no on-chain history.
    let fresh = Address::generate(&e);
    assert_eq!(client.balance(&fresh), 0);
    client.mint(&fresh, &42, &cid(&e, "web3-101"));
    assert_eq!(client.balance(&fresh), 42);
    assert_eq!(client.total_supply(), 42);
}
