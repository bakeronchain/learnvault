extern crate std;

use soroban_sdk::{
    Address, Env, IntoVal, Symbol, Val, Vec, symbol_short,
    testutils::{Address as _, Events as _, Ledger, LedgerInfo, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
};

use crate::{AwardRecord, AwardStatus, Config, DataKey, Error, ScholarshipClaim, ScholarshipClaimClient};

const START_LEDGER: u32 = 1000;
const DEADLINE_LEDGER: u32 = 2000;

fn set_ledger_sequence(env: &Env, sequence: u32) {
    env.ledger().set(LedgerInfo {
        timestamp: 1700000000,
        protocol_version: 23,
        sequence_number: sequence,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 6312000,
    });
}

fn token_client<'a>(env: &Env, token: &Address) -> TokenClient<'a> {
    TokenClient::new(env, token)
}

fn stellar_asset_client<'a>(env: &Env, token: &Address) -> StellarAssetClient<'a> {
    StellarAssetClient::new(env, token)
}

fn setup() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    set_ledger_sequence(&env, START_LEDGER);

    let admin = Address::generate(&env);
    let sponsor = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Register the contract
    let contract_id = env.register(ScholarshipClaim, ());

    // Create and fund a token contract
    let token_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token = sac.address();

    // Mint tokens to sponsor
    env.mock_all_auths();
    stellar_asset_client(&env, &token).mint(&sponsor, &10_000);

    // Initialize contract
    let client = ScholarshipClaimClient::new(&env, &contract_id);
    client.initialize(&admin);

    (env, contract_id, token, sponsor, recipient)
}

fn set_caller<T>(client: &ScholarshipClaimClient<'_>, fn_name: &str, caller: &Address, args: T)
where
    T: IntoVal<Env, Vec<Val>>,
{
    client.env.set_auths(&[]);
    let invoke = &MockAuthInvoke {
        contract: &client.address,
        fn_name,
        args: args.into_val(&client.env),
        sub_invokes: &[],
    };
    client.env.mock_auths(&[MockAuth {
        address: caller,
        invoke,
    }]);
}

fn create_award(
    client: &ScholarshipClaimClient<'_>,
    award_id: u32,
    sponsor: &Address,
    recipient: &Address,
    token: &Address,
    amount: i128,
    deadline: u32,
) {
    client.env.mock_all_auths();
    client.create_award(&award_id, sponsor, recipient, token, &amount, &deadline);
}

fn claim_authorized(
    client: &ScholarshipClaimClient<'_>,
    award_id: u32,
    recipient: &Address,
) -> Result<(), Result<soroban_sdk::Error, soroban_sdk::InvokeError>> {
    set_caller(client, "claim", recipient, (award_id,));
    client.try_claim(&award_id).map(|_| ())
}

fn reclaim_authorized(
    client: &ScholarshipClaimClient<'_>,
    award_id: u32,
    sponsor: &Address,
) -> Result<(), Result<soroban_sdk::Error, soroban_sdk::InvokeError>> {
    set_caller(client, "reclaim", sponsor, (award_id,));
    client.try_reclaim(&award_id).map(|_| ())
}

fn extend_deadline_authorized(
    client: &ScholarshipClaimClient<'_>,
    award_id: u32,
    sponsor: &Address,
    new_deadline: u32,
) -> Result<(), Result<soroban_sdk::Error, soroban_sdk::InvokeError>> {
    set_caller(client, "extend_deadline", sponsor, (award_id, new_deadline));
    client.try_extend_deadline(&award_id, &new_deadline).map(|_| ())
}

// ==================== CORE TESTS ====================

#[test]
fn initialize_sets_admin() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);
    // Contract is already initialized in setup()
    // Verify by checking we can create an award (which requires initialized state)
    create_award(&client, 1, &sponsor, &recipient, &token, 100, START_LEDGER + 100);
    let award = client.get_award(&1);
    assert!(award.is_some());
}

#[test]
fn create_award_fully_funds_at_creation() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let amount: i128 = 500;
    let deadline = START_LEDGER + 100;

    let before_events = env.events().all().len();
    create_award(&client, 1, &sponsor, &recipient, &token, amount, deadline);
    let after_events = env.events().all().len();

    // token transfer + AwardCreated event
    assert_eq!(after_events, before_events + 2);

    let award = client.get_award(&1).unwrap();
    assert_eq!(award.sponsor, sponsor);
    assert_eq!(award.recipient, recipient);
    assert_eq!(award.amount, amount);
    assert_eq!(award.claim_deadline_ledger, deadline);
    assert_eq!(award.status, AwardStatus::Active);

    // Verify tokens are in contract
    assert_eq!(token_client(&env, &token).balance(&contract_id), amount);
    assert_eq!(token_client(&env, &token).balance(&sponsor), 9_500);
}

#[test]
fn create_award_emits_event() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    create_award(&client, 123, &sponsor, &recipient, &token, 200, START_LEDGER + 100);

    let events = env.events().all();
    let found = events.iter().any(|(cid, topics, _)| {
        cid == contract_id && topics.contains(&Symbol::new(&env, "award_created").into_val(&env))
    });
    assert!(found, "award_created event not found");
}

#[test]
fn create_award_rejects_past_deadline() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    // Try to create award with deadline at current ledger
    env.mock_all_auths();
    let result = client.try_create_award(&1, &sponsor, &recipient, &token, &100, &START_LEDGER);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidDeadline as u32
        )))
    );

    // Try to create award with deadline before current ledger
    let result = client.try_create_award(&2, &sponsor, &recipient, &token, &100, &(START_LEDGER - 1));
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidDeadline as u32
        )))
    );
}

#[test]
fn create_award_rejects_zero_amount() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    env.mock_all_auths();
    let result = client.try_create_award(&1, &sponsor, &recipient, &token, &0, &(START_LEDGER + 100));
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidAmount as u32
        )))
    );
}

#[test]
fn create_award_rejects_duplicate_award_id() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    create_award(&client, 1, &sponsor, &recipient, &token, 100, START_LEDGER + 100);

    env.mock_all_auths();
    let result = client.try_create_award(&1, &sponsor, &recipient, &token, &200, &(START_LEDGER + 200));
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::AwardExists as u32
        )))
    );
}

// ==================== CLAIM TESTS ====================

#[test]
fn claim_succeeds_before_deadline() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let amount: i128 = 100;
    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, amount, deadline);

    // Claim at deadline ledger (should succeed)
    set_ledger_sequence(&env, deadline);
    claim_authorized(&client, 1, &recipient).unwrap();

    let award = client.get_award(&1).unwrap();
    assert_eq!(award.status, AwardStatus::Claimed);
    assert_eq!(token_client(&env, &token).balance(&recipient), amount);
    assert_eq!(token_client(&env, &token).balance(&contract_id), 0);
}

#[test]
fn claim_succeeds_one_ledger_before_deadline() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let amount: i128 = 100;
    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, amount, deadline);

    // Claim one ledger before deadline
    set_ledger_sequence(&env, deadline - 1);
    claim_authorized(&client, 1, &recipient).unwrap();

    let award = client.get_award(&1).unwrap();
    assert_eq!(award.status, AwardStatus::Claimed);
    assert_eq!(token_client(&env, &token).balance(&recipient), amount);
}

#[test]
fn claim_fails_one_ledger_after_deadline() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let amount: i128 = 100;
    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, amount, deadline);

    // Claim one ledger after deadline (should fail)
    set_ledger_sequence(&env, deadline + 1);
    let result = claim_authorized(&client, 1, &recipient);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::DeadlinePassed as u32
        )))
    );

    // Award should still be active
    let award = client.get_award(&1).unwrap();
    assert_eq!(award.status, AwardStatus::Active);
    assert_eq!(token_client(&env, &token).balance(&contract_id), amount);
}

#[test]
fn claim_emits_event() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    create_award(&client, 1, &sponsor, &recipient, &token, 100, START_LEDGER + 100);

    claim_authorized(&client, 1, &recipient).unwrap();

    let events = env.events().all();
    let found = events.iter().any(|(cid, topics, _)| {
        cid == contract_id && topics.contains(&Symbol::new(&env, "award_claimed").into_val(&env))
    });
    assert!(found, "award_claimed event not found");
}

#[test]
fn claim_requires_recipient_auth() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    create_award(&client, 1, &sponsor, &recipient, &token, 100, START_LEDGER + 100);

    let attacker = Address::generate(&env);
    set_caller(&client, "claim", &attacker, (1_u32,));
    let result = client.try_claim(&1);
    assert!(result.is_err());
}

// ==================== RECLAIM TESTS ====================

#[test]
fn reclaim_fails_before_deadline() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, 100, deadline);

    // Try to reclaim before deadline (should fail)
    set_ledger_sequence(&env, deadline);
    let result = reclaim_authorized(&client, 1, &sponsor);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::DeadlineNotReached as u32
        )))
    );
}

#[test]
fn reclaim_succeeds_after_deadline() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let amount: i128 = 100;
    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, amount, deadline);

    // Reclaim after deadline
    set_ledger_sequence(&env, deadline + 1);
    reclaim_authorized(&client, 1, &sponsor).unwrap();

    let award = client.get_award(&1).unwrap();
    assert_eq!(award.status, AwardStatus::Reclaimed);
    assert_eq!(token_client(&env, &token).balance(&sponsor), 10_000); // Full amount returned
    assert_eq!(token_client(&env, &token).balance(&contract_id), 0);
}

#[test]
fn reclaim_emits_event() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, 100, deadline);

    set_ledger_sequence(&env, deadline + 1);
    reclaim_authorized(&client, 1, &sponsor).unwrap();

    let events = env.events().all();
    let found = events.iter().any(|(cid, topics, _)| {
        cid == contract_id && topics.contains(&Symbol::new(&env, "award_reclaimed").into_val(&env))
    });
    assert!(found, "award_reclaimed event not found");
}

#[test]
fn reclaim_requires_sponsor_auth() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, 100, deadline);

    set_ledger_sequence(&env, deadline + 1);

    let attacker = Address::generate(&env);
    set_caller(&client, "reclaim", &attacker, (1_u32,));
    let result = client.try_reclaim(&1);
    assert!(result.is_err());
}

// ==================== DOUBLE-PAYOUT PREVENTION TESTS ====================

#[test]
fn claim_and_reclaim_are_mutually_exclusive() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let amount: i128 = 100;
    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, amount, deadline);

    // Claim the award
    set_ledger_sequence(&env, deadline);
    claim_authorized(&client, 1, &recipient).unwrap();

    // Try to reclaim after claim (should fail)
    set_ledger_sequence(&env, deadline + 1);
    let result = reclaim_authorized(&client, 1, &sponsor);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::AlreadyClaimed as u32
        )))
    );

    // Verify balances
    assert_eq!(token_client(&env, &token).balance(&recipient), amount);
    assert_eq!(token_client(&env, &token).balance(&sponsor), 9_900);
    assert_eq!(token_client(&env, &token).balance(&contract_id), 0);
}

#[test]
fn reclaim_and_claim_are_mutually_exclusive() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let amount: i128 = 100;
    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, amount, deadline);

    // Reclaim after deadline
    set_ledger_sequence(&env, deadline + 1);
    reclaim_authorized(&client, 1, &sponsor).unwrap();

    // Try to claim after reclaim (should fail)
    let result = claim_authorized(&client, 1, &recipient);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::AlreadyClaimed as u32
        )))
    );

    // Verify balances
    assert_eq!(token_client(&env, &token).balance(&recipient), 0);
    assert_eq!(token_client(&env, &token).balance(&sponsor), 10_000);
    assert_eq!(token_client(&env, &token).balance(&contract_id), 0);
}

#[test]
fn double_claim_is_prevented() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let amount: i128 = 100;
    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, amount, deadline);

    // First claim
    set_ledger_sequence(&env, deadline);
    claim_authorized(&client, 1, &recipient).unwrap();

    // Try second claim
    let result = claim_authorized(&client, 1, &recipient);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::AlreadyClaimed as u32
        )))
    );

    // Verify balance is exactly amount (not doubled)
    assert_eq!(token_client(&env, &token).balance(&recipient), amount);
}

#[test]
fn double_reclaim_is_prevented() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let amount: i128 = 100;
    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, amount, deadline);

    // First reclaim
    set_ledger_sequence(&env, deadline + 1);
    reclaim_authorized(&client, 1, &sponsor).unwrap();

    // Try second reclaim
    let result = reclaim_authorized(&client, 1, &sponsor);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::AlreadyReclaimed as u32
        )))
    );

    // Verify balance is exactly original (not doubled)
    assert_eq!(token_client(&env, &token).balance(&sponsor), 10_000);
}

// ==================== EXTEND DEADLINE TESTS ====================

#[test]
fn extend_deadline_must_be_later() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, 100, deadline);

    // Try to extend to earlier deadline (should fail)
    let result = extend_deadline_authorized(&client, 1, &sponsor, deadline - 1);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidNewDeadline as u32
        )))
    );

    // Try to extend to same deadline (should fail)
    let result = extend_deadline_authorized(&client, 1, &sponsor, deadline);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidNewDeadline as u32
        )))
    );

    // Extend to later deadline (should succeed)
    extend_deadline_authorized(&client, 1, &sponsor, deadline + 100).unwrap();
    let award = client.get_award(&1).unwrap();
    assert_eq!(award.claim_deadline_ledger, deadline + 100);
}

#[test]
fn extend_deadline_requires_sponsor_auth() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, 100, deadline);

    let attacker = Address::generate(&env);
    set_caller(&client, "extend_deadline", &attacker, (1_u32, deadline + 100));
    let result = client.try_extend_deadline(&1, &(deadline + 100));
    assert!(result.is_err());
}

#[test]
fn extend_deadline_fails_if_already_claimed() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, 100, deadline);

    set_ledger_sequence(&env, deadline);
    claim_authorized(&client, 1, &recipient).unwrap();

    let result = extend_deadline_authorized(&client, 1, &sponsor, deadline + 100);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::AlreadyClaimed as u32
        )))
    );
}

#[test]
fn extend_deadline_fails_if_already_reclaimed() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, 100, deadline);

    set_ledger_sequence(&env, deadline + 1);
    reclaim_authorized(&client, 1, &sponsor).unwrap();

    let result = extend_deadline_authorized(&client, 1, &sponsor, deadline + 100);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::AlreadyClaimed as u32
        )))
    );
}

// ==================== BOUNDARY TESTS ====================

#[test]
fn claim_succeeds_at_exact_deadline_ledger() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, 100, deadline);

    // Claim at exactly the deadline ledger
    set_ledger_sequence(&env, deadline);
    claim_authorized(&client, 1, &recipient).unwrap();

    let award = client.get_award(&1).unwrap();
    assert_eq!(award.status, AwardStatus::Claimed);
}

#[test]
fn claim_fails_at_deadline_plus_one() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, 100, deadline);

    // Claim at deadline + 1 (should fail)
    set_ledger_sequence(&env, deadline + 1);
    let result = claim_authorized(&client, 1, &recipient);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::DeadlinePassed as u32
        )))
    );
}

#[test]
fn reclaim_fails_at_exact_deadline_ledger() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, 100, deadline);

    // Try to reclaim at exactly deadline ledger (should fail - sponsor must wait until after)
    set_ledger_sequence(&env, deadline);
    let result = reclaim_authorized(&client, 1, &sponsor);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::DeadlineNotReached as u32
        )))
    );
}

#[test]
fn reclaim_succeeds_at_deadline_plus_one() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let amount: i128 = 100;
    let deadline = START_LEDGER + 100;
    create_award(&client, 1, &sponsor, &recipient, &token, amount, deadline);

    // Reclaim at deadline + 1 (should succeed)
    set_ledger_sequence(&env, deadline + 1);
    reclaim_authorized(&client, 1, &sponsor).unwrap();

    let award = client.get_award(&1).unwrap();
    assert_eq!(award.status, AwardStatus::Reclaimed);
    assert_eq!(token_client(&env, &token).balance(&sponsor), 10_000);
}

// ==================== GET AWARD TEST ====================

#[test]
fn get_award_returns_none_for_nonexistent() {
    let (env, contract_id, _token, _sponsor, _recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let result = client.get_award(&999);
    assert!(result.is_none());
}

#[test]
fn get_award_reflects_all_state_changes() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let deadline = START_LEDGER + 100;

    // Create
    create_award(&client, 1, &sponsor, &recipient, &token, 100, deadline);
    let created = client.get_award(&1).unwrap();
    assert_eq!(created.status, AwardStatus::Active);
    assert_eq!(created.claim_deadline_ledger, deadline);

    // Extend deadline
    extend_deadline_authorized(&client, 1, &sponsor, deadline + 50).unwrap();
    let extended = client.get_award(&1).unwrap();
    assert_eq!(extended.claim_deadline_ledger, deadline + 50);

    // Claim
    set_ledger_sequence(&env, deadline + 50);
    claim_authorized(&client, 1, &recipient).unwrap();
    let claimed = client.get_award(&1).unwrap();
    assert_eq!(claimed.status, AwardStatus::Claimed);
}

// ==================== UPGRADE TESTS ====================

#[test]
fn upgrade_requires_admin_auth() {
    let (env, contract_id, _token, _sponsor, _recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    let attacker = Address::generate(&env);
    let wasm_hash = crate::upgrade::testutils::upload_upgrade_target(&env);

    set_caller(&client, "upgrade", &attacker, (wasm_hash.clone(),));
    assert!(client.try_upgrade(&wasm_hash).is_err());
}

#[test]
fn state_persists_after_upgrade() {
    let (env, contract_id, token, sponsor, recipient) = setup();
    let client = ScholarshipClaimClient::new(&env, &contract_id);

    create_award(&client, 404, &sponsor, &recipient, &token, 120, START_LEDGER + 100);

    let wasm_hash = crate::upgrade::testutils::upload_upgrade_target(&env);

    // Get admin from config storage
    let admin = env.as_contract(&contract_id, || {
        env.storage()
            .instance()
            .get::<_, Config>(&symbol_short!("CONFIG"))
            .unwrap()
            .admin
    });

    set_caller(&client, "upgrade", &admin, (wasm_hash.clone(),));
    client.upgrade(&wasm_hash);

    let award = env.as_contract(&contract_id, || {
        env.storage()
            .persistent()
            .get::<_, AwardRecord>(&DataKey::Award(404))
    });
    let stored_hash = env.as_contract(&contract_id, || crate::upgrade::current_hash(&env));

    let award = award.expect("award should remain after upgrade");
    assert_eq!(award.recipient, recipient);
    assert_eq!(award.amount, 120);
    assert_eq!(stored_hash, wasm_hash);
}
