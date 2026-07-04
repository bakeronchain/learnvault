/// Upgrade-migration tests for scholarship_treasury.
///
/// These tests verify that all pre-upgrade state (treasury balance, active
/// proposal IDs) is intact and readable after a contract upgrade.  In the
/// Soroban test environment there is no separate "v2" wasm to deploy, so the
/// tests achieve this by:
///   1. Deploying and fully initialising the contract (v1).
///   2. Seeding it with realistic state (funded treasury, two active proposals).
///   3. Re-creating the client from the *same* contract address — simulating
///      the point at which a newly deployed v2 wasm takes over the existing
///      instance storage.
///   4. Asserting that every piece of pre-upgrade state is still readable and
///      correct through the v2 client.
extern crate std;

use soroban_sdk::{
    Address, Env, String, Vec, contract, contractimpl,
    testutils::Address as _,
    token::StellarAssetClient,
};

use crate::{ScholarshipTreasury, ScholarshipTreasuryClient, token};

// ---------------------------------------------------------------------------
// Minimal mock governance contract
// ---------------------------------------------------------------------------

#[contract]
pub struct MockGovForUpgrade;

#[contractimpl]
impl MockGovForUpgrade {
    pub fn initialize(_env: Env, _treasury: Address) {}

    pub fn mint(env: Env, to: Address, amount: i128) {
        let balance: i128 = env.storage().persistent().get(&to).unwrap_or(0);
        env.storage().persistent().set(&to, &(balance + amount));
    }

    pub fn balance(env: Env, account: Address) -> i128 {
        env.storage().persistent().get(&account).unwrap_or(0)
    }

    pub fn get_voting_power(env: Env, address: Address) -> i128 {
        env.storage().persistent().get(&address).unwrap_or(0)
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn sample_milestones(env: &Env) -> (Vec<String>, Vec<String>) {
    let titles = Vec::from_array(
        env,
        [
            String::from_str(env, "Admissions + enrollment"),
            String::from_str(env, "Mid-program progress report"),
            String::from_str(env, "Final completion + credential"),
        ],
    );
    let dates = Vec::from_array(
        env,
        [
            String::from_str(env, "2026-06-01"),
            String::from_str(env, "2026-08-01"),
            String::from_str(env, "2026-10-01"),
        ],
    );
    (titles, dates)
}

/// Returns (client, contract_id, donor, gov_contract_id, token_id).
fn setup_v1<'a>(
    env: &'a Env,
) -> (
    ScholarshipTreasuryClient<'a>,
    Address,
    Address,
    Address,
    Address,
) {
    let admin = Address::generate(env);
    let donor = Address::generate(env);

    let contract_id = env.register(ScholarshipTreasury, ());
    let client = ScholarshipTreasuryClient::new(env, &contract_id);

    let gov_id = env.register(MockGovForUpgrade, ());
    let gov_client = MockGovForUpgradeClient::new(env, &gov_id);

    env.mock_all_auths();
    env.as_contract(&contract_id, || token::register(env, &admin));
    let token_id = env.as_contract(&contract_id, || token::contract_id(env));

    StellarAssetClient::new(env, &token_id).mint(&donor, &10_000);

    gov_client.initialize(&contract_id);
    // New initialize signature: admin, usdc_token, governance, quorum_threshold, approval_bps
    client.initialize(&admin, &token_id, &gov_id, &0_i128, &5_100_u32);

    (client, contract_id, donor, gov_id, token_id)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[test]
fn treasury_balance_preserved_after_upgrade() {
    let env = Env::default();
    let (client, contract_id, donor, _gov_id, token_id) = setup_v1(&env);

    // ── v1: seed state ──────────────────────────────────────────────────────
    env.mock_all_auths();
    client.deposit(&donor, &3_000, &token_id);
    assert_eq!(client.get_balance(), 3_000);

    // ── simulate upgrade: rebuild client from the same contract address ─────
    // In production the upgrade mechanism replaces the wasm at `contract_id`;
    // instance storage is retained verbatim.
    let v2_client = ScholarshipTreasuryClient::new(&env, &contract_id);

    // ── v2: assert balance intact ───────────────────────────────────────────
    assert_eq!(
        v2_client.get_balance(),
        3_000,
        "treasury balance must be unchanged after upgrade"
    );
    assert_eq!(
        v2_client.get_balance(),
        3_000,
        "treasury balance must also return the correct value after upgrade"
    );
}

#[test]
fn active_proposal_ids_preserved_after_upgrade() {
    let env = Env::default();
    let (client, contract_id, donor, _gov_id, token_id) = setup_v1(&env);
    let (titles, dates) = sample_milestones(&env);

    // ── v1: submit two proposals ────────────────────────────────────────────
    env.mock_all_auths();
    client.deposit(&donor, &2_000, &token_id);

    let id1 = client.submit_proposal(
        &donor,
        &500,
        &String::from_str(&env, "Bootcamp Alpha"),
        &String::from_str(&env, "https://alpha.example"),
        &String::from_str(&env, "Alpha scholarship request"),
        &String::from_str(&env, "2026-06-01"),
        &titles,
        &dates,
    );

    let id2 = client.submit_proposal(
        &donor,
        &800,
        &String::from_str(&env, "Bootcamp Beta"),
        &String::from_str(&env, "https://beta.example"),
        &String::from_str(&env, "Beta scholarship request"),
        &String::from_str(&env, "2026-07-01"),
        &titles,
        &dates,
    );

    assert_eq!(client.get_proposal_count(), 2);

    // ── simulate upgrade ────────────────────────────────────────────────────
    let v2_client = ScholarshipTreasuryClient::new(&env, &contract_id);

    // ── v2: assert proposal IDs and data intact ─────────────────────────────
    assert_eq!(
        v2_client.get_proposal_count(),
        2,
        "proposal count must survive the upgrade"
    );

    let applicant_ids = v2_client.get_proposals_by_applicant(&donor);
    assert_eq!(applicant_ids.len(), 2);
    assert!(applicant_ids.contains(&id1));
    assert!(applicant_ids.contains(&id2));

    let p1 = v2_client
        .get_proposal(&id1)
        .expect("proposal 1 must exist post-upgrade");
    assert_eq!(p1.amount, 500);
    assert_eq!(p1.program_name, String::from_str(&env, "Bootcamp Alpha"));

    let p2 = v2_client
        .get_proposal(&id2)
        .expect("proposal 2 must exist post-upgrade");
    assert_eq!(p2.amount, 800);
    assert_eq!(p2.program_name, String::from_str(&env, "Bootcamp Beta"));
}

#[test]
fn donor_contribution_and_scholar_counts_preserved_after_upgrade() {
    let env = Env::default();
    let (client, contract_id, donor, gov_id, token_id) = setup_v1(&env);

    env.mock_all_auths();
    client.deposit(&donor, &1_500, &token_id);

    // Disburse so scholars count increases
    let _ = MockGovForUpgradeClient::new(&env, &gov_id);

    let recipient = Address::generate(&env);
    client.disburse(&recipient, &400);

    // ── simulate upgrade ─────────────────────────────────────────────────────
    let v2_client = ScholarshipTreasuryClient::new(&env, &contract_id);

    assert_eq!(v2_client.get_donors_count(), 1);
    assert_eq!(v2_client.get_scholars_count(), 1);
    assert_eq!(v2_client.get_donor_total(&donor), 1_500);
    assert_eq!(
        v2_client.get_balance(),
        1_100,
        "balance after disbursal must be preserved"
    );
}
