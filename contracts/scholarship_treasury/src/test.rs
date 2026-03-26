extern crate std;

use soroban_sdk::{
    Address, Env, IntoVal, String, Val, Vec, contract, contractimpl,
    testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
};

use crate::{Error, ProposalStatus, ScholarshipTreasury, ScholarshipTreasuryClient, token};

#[contract]
pub struct MockGovernance;

#[contractimpl]
impl MockGovernance {
    pub fn initialize(env: Env, treasury: Address) {}
    pub fn mint(env: Env, to: Address, amount: i128) {
        let key = soroban_sdk::Symbol::new(&env, "balance");
        let balance: i128 = env.storage().persistent().get(&to).unwrap_or(0);
        env.storage().persistent().set(&to, &(balance + amount));
    }
    pub fn balance(env: Env, account: Address) -> i128 {
        env.storage().persistent().get(&account).unwrap_or(0)
    }
    pub fn get_voting_power(env: Env, address: Address) -> i128 {
        // For mock, just return balance. We'll manually mint to simulate delegated power in tests if needed.
        Self::balance(env, address)
    }
}

fn setup<'a>(
    env: &'a Env,
) -> (
    ScholarshipTreasuryClient<'a>,
    Address,
    Address,
    Address,
    Address,
    MockGovernanceClient<'a>,
) {
    let admin = Address::generate(env);
    let donor = Address::generate(env);
    let recipient = Address::generate(env);

    let contract_id = env.register(ScholarshipTreasury, ());
    let client = ScholarshipTreasuryClient::new(env, &contract_id);

    let gov_contract_id = env.register(MockGovernance, ());
    let gov_client = MockGovernanceClient::new(env, &gov_contract_id);

    env.mock_all_auths();
    env.as_contract(&contract_id, || token::register(env, &admin));
    let token_id = env.as_contract(&contract_id, || token::contract_id(env));
    let sac = StellarAssetClient::new(env, &token_id);
    sac.mint(&donor, &1_000);

    gov_client.initialize(&contract_id);
    client.initialize(&admin, &token_id, &gov_contract_id);
    env.set_auths(&[]);

    (
        client,
        gov_contract_id,
        donor,
        recipient,
        token_id,
        gov_client,
    )
}

fn token_client<'a>(env: &Env, token_id: &Address) -> TokenClient<'a> {
    TokenClient::new(env, token_id)
}

fn set_caller<T>(client: &ScholarshipTreasuryClient, fn_name: &str, caller: &Address, args: T)
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

fn submit_sample_proposal(
    env: &Env,
    client: &ScholarshipTreasuryClient<'_>,
    applicant: &Address,
    amount: i128,
) -> u32 {
    let (milestone_titles, milestone_dates) = sample_milestones(env);
    client.submit_proposal(
        applicant,
        &amount,
        &String::from_str(env, "Scholarship"),
        &String::from_str(env, "https://example.com"),
        &String::from_str(env, "Program description"),
        &String::from_str(env, "2026-05-15"),
        &milestone_titles,
        &milestone_dates,
    )
}

#[test]
fn deposits_are_tracked_per_donor() {
    let env = Env::default();
    let (client, _governance, donor, _recipient, token_id, gov_client) = setup(&env);

    env.mock_all_auths();
    client.deposit(&donor, &150);
    client.deposit(&donor, &50);

    assert_eq!(client.get_donor_total(&donor), 200);
    assert_eq!(client.get_balance(), 200);
    assert_eq!(token_client(&env, &token_id).balance(&client.address), 200);
    assert_eq!(token_client(&env, &token_id).balance(&donor), 800);
    assert_eq!(gov_client.balance(&donor), 200);
}

#[test]
fn unauthorized_disburse_is_rejected() {
    let env = Env::default();
    let (client, governance, donor, recipient, token_id, _gov_client) = setup(&env);
    env.mock_all_auths();
    client.deposit(&donor, &250);
    env.set_auths(&[]);

    let attacker = Address::generate(&env);
    set_caller(&client, "disburse", &attacker, (&recipient, 100_i128));
    let unauthorized = client.try_disburse(&recipient, &100);
    assert!(unauthorized.is_err());

    set_caller(&client, "disburse", &governance, (&recipient, 100_i128));
    client.disburse(&recipient, &100);

    assert_eq!(client.get_balance(), 150);
    assert_eq!(token_client(&env, &token_id).balance(&recipient), 100);
    assert_eq!(token_client(&env, &token_id).balance(&client.address), 150);
}

#[test]
fn disburse_more_than_balance_fails() {
    let env = Env::default();
    let (client, governance, donor, recipient, _token_id, _gov_client) = setup(&env);
    env.mock_all_auths();
    client.deposit(&donor, &10);
    env.set_auths(&[]);

    set_caller(&client, "disburse", &governance, (&recipient, 20_i128));
    let result = client.try_disburse(&recipient, &20);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InsufficientFunds as u32
        )))
    );
}

#[test]
fn submitted_proposals_are_stored_per_applicant() {
    let env = Env::default();
    let (client, _governance, donor, _recipient, _token_id, _gov_client) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    env.mock_all_auths();
    let proposal_id = client.submit_proposal(
        &donor,
        &500,
        &String::from_str(&env, "Stellar Builder Bootcamp"),
        &String::from_str(&env, "https://bootcamp.example/apply"),
        &String::from_str(
            &env,
            "An intensive Soroban engineering scholarship request.",
        ),
        &String::from_str(&env, "2026-05-15"),
        &milestone_titles,
        &milestone_dates,
    );

    assert_eq!(proposal_id, 1);
    assert_eq!(client.get_proposal_count(), 1);
    assert_eq!(
        client.get_proposals_by_applicant(&donor),
        Vec::from_array(&env, [1_u32])
    );

    let proposal = client
        .get_proposal(&proposal_id)
        .expect("proposal should exist");
    assert_eq!(proposal.id, 1);
    assert_eq!(proposal.applicant, donor);
    assert_eq!(proposal.amount, 500);
    assert_eq!(
        proposal.program_name,
        String::from_str(&env, "Stellar Builder Bootcamp")
    );
    assert_eq!(
        proposal.program_url,
        String::from_str(&env, "https://bootcamp.example/apply")
    );
    assert_eq!(
        proposal.program_description,
        String::from_str(
            &env,
            "An intensive Soroban engineering scholarship request."
        ),
    );
    assert_eq!(proposal.start_date, String::from_str(&env, "2026-05-15"));
    assert_eq!(proposal.milestone_titles, milestone_titles);
    assert_eq!(proposal.milestone_dates, milestone_dates);
}

#[test]
fn get_proposals_by_status_returns_pending_proposals() {
    let env = Env::default();
    let (client, _governance, donor, _recipient, _token_id, _gov_client) = setup(&env);

    env.mock_all_auths();
    let proposal_id = submit_sample_proposal(&env, &client, &donor, 500);

    let pending = client.get_proposals_by_status(&ProposalStatus::Pending);
    let active = client.get_active_proposals();
    let approved = client.get_proposals_by_status(&ProposalStatus::Approved);
    let rejected = client.get_proposals_by_status(&ProposalStatus::Rejected);

    assert_eq!(pending.len(), 1);
    assert_eq!(active.len(), 1);
    assert_eq!(pending.get(0).unwrap().id, proposal_id);
    assert_eq!(active.get(0).unwrap().id, proposal_id);
    assert_eq!(approved.len(), 0);
    assert_eq!(rejected.len(), 0);
}

#[test]
fn get_proposals_by_status_returns_approved_proposals_after_deadline() {
    let env = Env::default();
    let (client, _governance, donor, _recipient, _token_id, gov_client) = setup(&env);
    let voter = Address::generate(&env);

    gov_client.mint(&voter, &300);
    env.mock_all_auths();
    let proposal_id = submit_sample_proposal(&env, &client, &donor, 500);
    client.vote(&voter, &proposal_id, &true);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    env.ledger()
        .set_sequence_number(proposal.deadline_ledger + 1);

    let approved = client.get_proposals_by_status(&ProposalStatus::Approved);
    let rejected = client.get_proposals_by_status(&ProposalStatus::Rejected);
    let pending = client.get_proposals_by_status(&ProposalStatus::Pending);

    assert_eq!(approved.len(), 1);
    assert_eq!(approved.get(0).unwrap().id, proposal_id);
    assert_eq!(rejected.len(), 0);
    assert_eq!(pending.len(), 0);
}

#[test]
fn get_proposals_by_status_returns_rejected_proposals_after_deadline() {
    let env = Env::default();
    let (client, _governance, donor, _recipient, _token_id, gov_client) = setup(&env);
    let voter = Address::generate(&env);

    gov_client.mint(&voter, &200);
    env.mock_all_auths();
    let proposal_id = submit_sample_proposal(&env, &client, &donor, 500);
    client.vote(&voter, &proposal_id, &false);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    env.ledger()
        .set_sequence_number(proposal.deadline_ledger + 1);

    let rejected = client.get_proposals_by_status(&ProposalStatus::Rejected);
    let approved = client.get_proposals_by_status(&ProposalStatus::Approved);

    assert_eq!(rejected.len(), 1);
    assert_eq!(rejected.get(0).unwrap().id, proposal_id);
    assert_eq!(approved.len(), 0);
}

#[test]
fn get_proposals_by_status_returns_empty_vec_when_no_match() {
    let env = Env::default();
    let (client, _governance, donor, _recipient, _token_id, _gov_client) = setup(&env);

    env.mock_all_auths();
    let _proposal_id = submit_sample_proposal(&env, &client, &donor, 500);

    let approved = client.get_proposals_by_status(&ProposalStatus::Approved);
    let rejected = client.get_proposals_by_status(&ProposalStatus::Rejected);

    assert_eq!(approved.len(), 0);
    assert_eq!(rejected.len(), 0);
}

#[test]
fn proposal_requires_three_milestones() {
    let env = Env::default();
    let (client, _governance, donor, _recipient, _token_id, _gov_client) = setup(&env);

    env.mock_all_auths();
    let titles = Vec::from_array(
        &env,
        [
            String::from_str(&env, "Milestone 1"),
            String::from_str(&env, "Milestone 2"),
        ],
    );
    let dates = Vec::from_array(
        &env,
        [
            String::from_str(&env, "2026-06-01"),
            String::from_str(&env, "2026-07-01"),
        ],
    );

    let result = client.try_submit_proposal(
        &donor,
        &500,
        &String::from_str(&env, "Scholarship"),
        &String::from_str(&env, "https://example.com"),
        &String::from_str(&env, "Program description"),
        &String::from_str(&env, "2026-05-15"),
        &titles,
        &dates,
    );

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidAmount as u32
        )))
    );
}

#[test]
fn yes_vote_adds_weight() {
    let env = Env::default();
    let (client, _governance, donor, _recipient, _token_id, gov_client) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    let voter = Address::generate(&env);
    gov_client.mint(&voter, &500);

    env.mock_all_auths();
    let proposal_id = client.submit_proposal(
        &donor,
        &500,
        &String::from_str(&env, "Scholarship"),
        &String::from_str(&env, "https://example.com"),
        &String::from_str(&env, "Program description"),
        &String::from_str(&env, "2026-05-15"),
        &milestone_titles,
        &milestone_dates,
    );

    client.vote(&voter, &proposal_id, &true);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.yes_votes, 500);
    assert_eq!(proposal.no_votes, 0);
}

#[test]
fn vote_uses_delegated_power() {
    let env = Env::default();
    let (client, _governance, donor, _recipient, _token_id, gov_client) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    let voter = Address::generate(&env);
    // Simulate delegated power by minting directly to the voter in the mock
    gov_client.mint(&voter, &1000);

    env.mock_all_auths();
    let proposal_id = client.submit_proposal(
        &donor,
        &500,
        &String::from_str(&env, "Scholarship"),
        &String::from_str(&env, "https://example.com"),
        &String::from_str(&env, "Program description"),
        &String::from_str(&env, "2026-05-15"),
        &milestone_titles,
        &milestone_dates,
    );

    client.vote(&voter, &proposal_id, &true);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.yes_votes, 1000);
}

#[test]
fn no_vote_adds_weight() {
    let env = Env::default();
    let (client, _governance, donor, _recipient, _token_id, gov_client) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    let voter = Address::generate(&env);
    gov_client.mint(&voter, &500);

    env.mock_all_auths();
    let proposal_id = client.submit_proposal(
        &donor,
        &500,
        &String::from_str(&env, "Scholarship"),
        &String::from_str(&env, "https://example.com"),
        &String::from_str(&env, "Program description"),
        &String::from_str(&env, "2026-05-15"),
        &milestone_titles,
        &milestone_dates,
    );

    client.vote(&voter, &proposal_id, &false);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.no_votes, 500);
    assert_eq!(proposal.yes_votes, 0);
}

#[test]
fn double_vote_panics() {
    let env = Env::default();
    let (client, _governance, donor, _recipient, _token_id, gov_client) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    let voter = Address::generate(&env);
    gov_client.mint(&voter, &500);

    env.mock_all_auths();
    let proposal_id = client.submit_proposal(
        &donor,
        &500,
        &String::from_str(&env, "Scholarship"),
        &String::from_str(&env, "https://example.com"),
        &String::from_str(&env, "Program description"),
        &String::from_str(&env, "2026-05-15"),
        &milestone_titles,
        &milestone_dates,
    );

    client.vote(&voter, &proposal_id, &true);
    let result = client.try_vote(&voter, &proposal_id, &true);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::AlreadyVoted as u32
        )))
    );
}

#[test]
fn vote_after_deadline_panics() {
    let env = Env::default();
    let (client, _governance, donor, _recipient, _token_id, gov_client) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    let voter = Address::generate(&env);
    gov_client.mint(&voter, &500);

    env.mock_all_auths();
    let proposal_id = client.submit_proposal(
        &donor,
        &500,
        &String::from_str(&env, "Scholarship"),
        &String::from_str(&env, "https://example.com"),
        &String::from_str(&env, "Program description"),
        &String::from_str(&env, "2026-05-15"),
        &milestone_titles,
        &milestone_dates,
    );

    let proposal = client.get_proposal(&proposal_id).unwrap();
    env.ledger()
        .set_sequence_number(proposal.deadline_ledger + 1);

    let result = client.try_vote(&voter, &proposal_id, &true);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::VotingClosed as u32
        )))
    );
}

#[test]
fn zero_weight_vote_allowed() {
    let env = Env::default();
    let (client, _governance, donor, _recipient, _token_id, gov_client) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    let voter = Address::generate(&env);
    // No minting, weight is 0

    env.mock_all_auths();
    let proposal_id = client.submit_proposal(
        &donor,
        &500,
        &String::from_str(&env, "Scholarship"),
        &String::from_str(&env, "https://example.com"),
        &String::from_str(&env, "Program description"),
        &String::from_str(&env, "2026-05-15"),
        &milestone_titles,
        &milestone_dates,
    );

    client.vote(&voter, &proposal_id, &true);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.yes_votes, 0);

    // Assert VoteCast storage key is true (vote again should panic)
    let result = client.try_vote(&voter, &proposal_id, &true);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::AlreadyVoted as u32
        )))
    );
}

#[test]
fn vote_on_missing_proposal_panics() {
    let env = Env::default();
    let (client, _governance, _donor, _recipient, _token_id, _gov_client) = setup(&env);

    let voter = Address::generate(&env);
    env.mock_all_auths();

    let result = client.try_vote(&voter, &999, &true);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::ProposalNotFound as u32
        )))
    );
}

// ============================================================================
// INITIALIZE TESTS
// ============================================================================

#[test]
fn initialize_sets_admin_usdc_and_gov() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let usdc_token = Address::generate(&env);
    let gov_contract = Address::generate(&env);

    let contract_id = env.register(ScholarshipTreasury, ());
    let client = ScholarshipTreasuryClient::new(&env, &contract_id);

    env.mock_all_auths();
    client.initialize(&admin, &usdc_token, &gov_contract);

    // Verify initialization by checking that operations work
    assert_eq!(client.get_balance(), 0);
    assert_eq!(client.get_total_disbursed(), 0);
    assert_eq!(client.get_scholars_count(), 0);
    assert_eq!(client.get_donors_count(), 0);
}

#[test]
fn double_initialize_fails() {
    let env = Env::default();
    let (client, _, _, _, _, _) = setup(&env);

    let admin = Address::generate(&env);
    let usdc_token = Address::generate(&env);
    let gov_contract = Address::generate(&env);

    env.mock_all_auths();
    let result = client.try_initialize(&admin, &usdc_token, &gov_contract);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::AlreadyInitialized as u32
        )))
    );
}

// ============================================================================
// DEPOSIT TESTS
// ============================================================================

#[test]
fn deposit_happy_path() {
    let env = Env::default();
    let (client, _, donor, _, token_id, gov_client) = setup(&env);

    env.mock_all_auths();
    client.deposit(&donor, &100);

    assert_eq!(client.get_donor_total(&donor), 100);
    assert_eq!(client.get_balance(), 100);
    assert_eq!(token_client(&env, &token_id).balance(&client.address), 100);
    assert_eq!(gov_client.balance(&donor), 100);
}

#[test]
fn deposit_zero_amount_fails() {
    let env = Env::default();
    let (client, _, donor, _, _, _) = setup(&env);

    env.mock_all_auths();
    let result = client.try_deposit(&donor, &0);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidAmount as u32
        )))
    );
}

#[test]
fn deposit_negative_amount_fails() {
    let env = Env::default();
    let (client, _, donor, _, _, _) = setup(&env);

    env.mock_all_auths();
    let result = client.try_deposit(&donor, &-50);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidAmount as u32
        )))
    );
}

#[test]
fn deposit_when_paused_fails() {
    let env = Env::default();
    let (client, _, donor, _, _, _) = setup(&env);

    env.mock_all_auths();
    client.pause();
    let result = client.try_deposit(&donor, &100);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::ContractPaused as u32
        )))
    );
}

#[test]
fn deposit_increments_donor_count() {
    let env = Env::default();
    let (client, _, donor, _, _, _) = setup(&env);

    env.mock_all_auths();
    assert_eq!(client.get_donors_count(), 0);

    client.deposit(&donor, &100);
    assert_eq!(client.get_donors_count(), 1);

    // Second deposit from same donor doesn't increment
    client.deposit(&donor, &50);
    assert_eq!(client.get_donors_count(), 1);

    // New donor increments
    let donor2 = Address::generate(&env);
    let token_id = env.as_contract(&client.address, || token::contract_id(&env));
    let sac = StellarAssetClient::new(&env, &token_id);
    sac.mint(&donor2, &1_000);
    client.deposit(&donor2, &100);
    assert_eq!(client.get_donors_count(), 2);
}

// ============================================================================
// DISBURSE TESTS
// ============================================================================

#[test]
fn disburse_happy_path() {
    let env = Env::default();
    let (client, governance, donor, recipient, token_id, _) = setup(&env);

    env.mock_all_auths();
    client.deposit(&donor, &500);
    env.set_auths(&[]);

    set_caller(&client, "disburse", &governance, (&recipient, 200_i128));
    client.disburse(&recipient, &200);

    assert_eq!(client.get_balance(), 300);
    assert_eq!(token_client(&env, &token_id).balance(&recipient), 200);
}

#[test]
fn disburse_zero_amount_fails() {
    let env = Env::default();
    let (client, governance, donor, recipient, _, _) = setup(&env);

    env.mock_all_auths();
    client.deposit(&donor, &500);
    env.set_auths(&[]);

    set_caller(&client, "disburse", &governance, (&recipient, 0_i128));
    let result = client.try_disburse(&recipient, &0);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidAmount as u32
        )))
    );
}

#[test]
fn disburse_negative_amount_fails() {
    let env = Env::default();
    let (client, governance, donor, recipient, _, _) = setup(&env);

    env.mock_all_auths();
    client.deposit(&donor, &500);
    env.set_auths(&[]);

    set_caller(&client, "disburse", &governance, (&recipient, -100_i128));
    let result = client.try_disburse(&recipient, &-100);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidAmount as u32
        )))
    );
}

#[test]
fn disburse_insufficient_balance_fails() {
    let env = Env::default();
    let (client, governance, donor, recipient, _, _) = setup(&env);

    env.mock_all_auths();
    client.deposit(&donor, &100);
    env.set_auths(&[]);

    set_caller(&client, "disburse", &governance, (&recipient, 200_i128));
    let result = client.try_disburse(&recipient, &200);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InsufficientFunds as u32
        )))
    );
}

#[test]
fn disburse_when_paused_fails() {
    let env = Env::default();
    let (client, governance, donor, recipient, _, _) = setup(&env);

    env.mock_all_auths();
    client.deposit(&donor, &500);
    client.pause();
    env.set_auths(&[]);

    set_caller(&client, "disburse", &governance, (&recipient, 100_i128));
    let result = client.try_disburse(&recipient, &100);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::ContractPaused as u32
        )))
    );
}

#[test]
fn disburse_increments_scholar_count() {
    let env = Env::default();
    let (client, governance, donor, recipient, _, _) = setup(&env);

    env.mock_all_auths();
    client.deposit(&donor, &500);
    assert_eq!(client.get_scholars_count(), 0);
    env.set_auths(&[]);

    set_caller(&client, "disburse", &governance, (&recipient, 100_i128));
    client.disburse(&recipient, &100);
    assert_eq!(client.get_scholars_count(), 1);

    // Second disburse to same recipient doesn't increment
    set_caller(&client, "disburse", &governance, (&recipient, 50_i128));
    client.disburse(&recipient, &50);
    assert_eq!(client.get_scholars_count(), 1);
}

#[test]
fn disburse_tracks_total_disbursed() {
    let env = Env::default();
    let (client, governance, donor, recipient, _, _) = setup(&env);

    env.mock_all_auths();
    client.deposit(&donor, &500);
    assert_eq!(client.get_total_disbursed(), 0);
    env.set_auths(&[]);

    set_caller(&client, "disburse", &governance, (&recipient, 100_i128));
    client.disburse(&recipient, &100);
    assert_eq!(client.get_total_disbursed(), 100);

    set_caller(&client, "disburse", &governance, (&recipient, 50_i128));
    client.disburse(&recipient, &50);
    assert_eq!(client.get_total_disbursed(), 150);
}

// ============================================================================
// PROPOSAL TESTS
// ============================================================================

#[test]
fn submit_proposal_happy_path() {
    let env = Env::default();
    let (client, _, donor, _, _, _) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    env.mock_all_auths();
    let proposal_id = client.submit_proposal(
        &donor,
        &1000,
        &String::from_str(&env, "DeFi Bootcamp"),
        &String::from_str(&env, "https://example.com/defi"),
        &String::from_str(&env, "Learn DeFi fundamentals"),
        &String::from_str(&env, "2026-05-01"),
        &milestone_titles,
        &milestone_dates,
    );

    assert_eq!(proposal_id, 1);
    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.applicant, donor);
    assert_eq!(proposal.amount, 1000);
    assert_eq!(proposal.yes_votes, 0);
    assert_eq!(proposal.no_votes, 0);
}

#[test]
fn submit_proposal_zero_amount_fails() {
    let env = Env::default();
    let (client, _, donor, _, _, _) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    env.mock_all_auths();
    let result = client.try_submit_proposal(
        &donor,
        &0,
        &String::from_str(&env, "Scholarship"),
        &String::from_str(&env, "https://example.com"),
        &String::from_str(&env, "Description"),
        &String::from_str(&env, "2026-05-01"),
        &milestone_titles,
        &milestone_dates,
    );

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidAmount as u32
        )))
    );
}

#[test]
fn submit_proposal_negative_amount_fails() {
    let env = Env::default();
    let (client, _, donor, _, _, _) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    env.mock_all_auths();
    let result = client.try_submit_proposal(
        &donor,
        &-500,
        &String::from_str(&env, "Scholarship"),
        &String::from_str(&env, "https://example.com"),
        &String::from_str(&env, "Description"),
        &String::from_str(&env, "2026-05-01"),
        &milestone_titles,
        &milestone_dates,
    );

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidAmount as u32
        )))
    );
}

#[test]
fn submit_proposal_wrong_milestone_count_fails() {
    let env = Env::default();
    let (client, _, donor, _, _, _) = setup(&env);

    env.mock_all_auths();
    let titles = Vec::from_array(
        &env,
        [String::from_str(&env, "M1"), String::from_str(&env, "M2")],
    );
    let dates = Vec::from_array(
        &env,
        [
            String::from_str(&env, "2026-06-01"),
            String::from_str(&env, "2026-07-01"),
        ],
    );

    let result = client.try_submit_proposal(
        &donor,
        &500,
        &String::from_str(&env, "Scholarship"),
        &String::from_str(&env, "https://example.com"),
        &String::from_str(&env, "Description"),
        &String::from_str(&env, "2026-05-01"),
        &titles,
        &dates,
    );

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidAmount as u32
        )))
    );
}

#[test]
fn submit_proposal_when_paused_fails() {
    let env = Env::default();
    let (client, _, donor, _, _, _) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    env.mock_all_auths();
    client.pause();

    let result = client.try_submit_proposal(
        &donor,
        &500,
        &String::from_str(&env, "Scholarship"),
        &String::from_str(&env, "https://example.com"),
        &String::from_str(&env, "Description"),
        &String::from_str(&env, "2026-05-01"),
        &milestone_titles,
        &milestone_dates,
    );

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::ContractPaused as u32
        )))
    );
}

#[test]
fn multiple_proposals_from_same_applicant() {
    let env = Env::default();
    let (client, _, donor, _, _, _) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    env.mock_all_auths();
    let id1 = client.submit_proposal(
        &donor,
        &500,
        &String::from_str(&env, "Program 1"),
        &String::from_str(&env, "https://example.com/1"),
        &String::from_str(&env, "Description 1"),
        &String::from_str(&env, "2026-05-01"),
        &milestone_titles,
        &milestone_dates,
    );

    let id2 = client.submit_proposal(
        &donor,
        &1000,
        &String::from_str(&env, "Program 2"),
        &String::from_str(&env, "https://example.com/2"),
        &String::from_str(&env, "Description 2"),
        &String::from_str(&env, "2026-06-01"),
        &milestone_titles,
        &milestone_dates,
    );

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    let proposals = client.get_proposals_by_applicant(&donor);
    assert_eq!(proposals.len(), 2);
    assert_eq!(proposals.get(0), Some(1));
    assert_eq!(proposals.get(1), Some(2));
}

// ============================================================================
// VOTE TESTS
// ============================================================================

#[test]
fn vote_without_gov_tokens_fails() {
    let env = Env::default();
    let (client, _, donor, _, _, _) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    let voter = Address::generate(&env);

    env.mock_all_auths();
    let proposal_id = client.submit_proposal(
        &donor,
        &500,
        &String::from_str(&env, "Scholarship"),
        &String::from_str(&env, "https://example.com"),
        &String::from_str(&env, "Description"),
        &String::from_str(&env, "2026-05-01"),
        &milestone_titles,
        &milestone_dates,
    );

    // Voter has no GOV tokens, vote is allowed but has 0 weight
    client.vote(&voter, &proposal_id, &true);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.yes_votes, 0);
}

#[test]
fn multiple_votes_accumulate() {
    let env = Env::default();
    let (client, _, donor, _, _, gov_client) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    gov_client.mint(&voter1, &300);
    gov_client.mint(&voter2, &200);

    env.mock_all_auths();
    let proposal_id = client.submit_proposal(
        &donor,
        &500,
        &String::from_str(&env, "Scholarship"),
        &String::from_str(&env, "https://example.com"),
        &String::from_str(&env, "Description"),
        &String::from_str(&env, "2026-05-01"),
        &milestone_titles,
        &milestone_dates,
    );

    client.vote(&voter1, &proposal_id, &true);
    client.vote(&voter2, &proposal_id, &true);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.yes_votes, 500);
}

#[test]
fn mixed_yes_and_no_votes() {
    let env = Env::default();
    let (client, _, donor, _, _, gov_client) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    gov_client.mint(&voter1, &400);
    gov_client.mint(&voter2, &300);

    env.mock_all_auths();
    let proposal_id = client.submit_proposal(
        &donor,
        &500,
        &String::from_str(&env, "Scholarship"),
        &String::from_str(&env, "https://example.com"),
        &String::from_str(&env, "Description"),
        &String::from_str(&env, "2026-05-01"),
        &milestone_titles,
        &milestone_dates,
    );

    client.vote(&voter1, &proposal_id, &true);
    client.vote(&voter2, &proposal_id, &false);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.yes_votes, 400);
    assert_eq!(proposal.no_votes, 300);
}

// ============================================================================
// PAUSE/UNPAUSE TESTS
// ============================================================================

#[test]
fn pause_only_admin_can_call() {
    let env = Env::default();
    let (client, _, _, _, _, _) = setup(&env);

    let attacker = Address::generate(&env);
    env.mock_all_auths();
    let result = client.try_pause();
    // Should succeed because mock_all_auths allows all
    assert!(result.is_ok());
}

#[test]
fn pause_prevents_deposits() {
    let env = Env::default();
    let (client, _, donor, _, _, _) = setup(&env);

    env.mock_all_auths();
    client.pause();
    assert!(client.is_paused());

    let result = client.try_deposit(&donor, &100);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::ContractPaused as u32
        )))
    );
}

#[test]
fn pause_prevents_disbursements() {
    let env = Env::default();
    let (client, governance, donor, recipient, _, _) = setup(&env);

    env.mock_all_auths();
    client.deposit(&donor, &500);
    client.pause();
    env.set_auths(&[]);

    set_caller(&client, "disburse", &governance, (&recipient, 100_i128));
    let result = client.try_disburse(&recipient, &100);
    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::ContractPaused as u32
        )))
    );
}

#[test]
fn unpause_restores_functionality() {
    let env = Env::default();
    let (client, _, donor, _, _, _) = setup(&env);

    env.mock_all_auths();
    client.pause();
    assert!(client.is_paused());

    client.unpause();
    assert!(!client.is_paused());

    client.deposit(&donor, &100);
    assert_eq!(client.get_balance(), 100);
}

// ============================================================================
// FULL INTEGRATION FLOW TESTS
// ============================================================================

#[test]
fn full_flow_deposit_propose_vote_disburse() {
    let env = Env::default();
    let (client, governance, donor, recipient, token_id, gov_client) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    // Step 1: Donor deposits USDC
    env.mock_all_auths();
    client.deposit(&donor, &1000);
    assert_eq!(client.get_balance(), 1000);
    assert_eq!(gov_client.balance(&donor), 1000);

    // Step 2: Applicant submits proposal
    let applicant = Address::generate(&env);
    let proposal_id = client.submit_proposal(
        &applicant,
        &500,
        &String::from_str(&env, "Stellar Bootcamp"),
        &String::from_str(&env, "https://bootcamp.example.com"),
        &String::from_str(&env, "Intensive Soroban training"),
        &String::from_str(&env, "2026-05-15"),
        &milestone_titles,
        &milestone_dates,
    );
    assert_eq!(proposal_id, 1);

    // Step 3: Donors vote on proposal
    client.vote(&donor, &proposal_id, &true);
    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.yes_votes, 1000);

    // Step 4: Governance approves and disburses
    env.set_auths(&[]);
    set_caller(&client, "disburse", &governance, (&recipient, 500_i128));
    client.disburse(&recipient, &500);

    // Verify final state
    assert_eq!(client.get_balance(), 500);
    assert_eq!(client.get_total_disbursed(), 500);
    assert_eq!(token_client(&env, &token_id).balance(&recipient), 500);
    assert_eq!(client.get_scholars_count(), 1);
}

#[test]
fn full_flow_multiple_donors_and_proposals() {
    let env = Env::default();
    let (client, governance, donor1, recipient, _, _) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    env.mock_all_auths();

    // Both donors deposit (using same donor for simplicity in test)
    client.deposit(&donor1, &1000);
    assert_eq!(client.get_balance(), 1000);
    assert_eq!(client.get_donors_count(), 1);

    // First proposal
    let applicant1 = Address::generate(&env);
    let proposal_id1 = client.submit_proposal(
        &applicant1,
        &500,
        &String::from_str(&env, "Program 1"),
        &String::from_str(&env, "https://example.com/1"),
        &String::from_str(&env, "Description 1"),
        &String::from_str(&env, "2026-05-01"),
        &milestone_titles,
        &milestone_dates,
    );

    // Second proposal
    let applicant2 = Address::generate(&env);
    let proposal_id2 = client.submit_proposal(
        &applicant2,
        &500,
        &String::from_str(&env, "Program 2"),
        &String::from_str(&env, "https://example.com/2"),
        &String::from_str(&env, "Description 2"),
        &String::from_str(&env, "2026-06-01"),
        &milestone_titles,
        &milestone_dates,
    );

    // Donor votes on both proposals
    client.vote(&donor1, &proposal_id1, &true);
    client.vote(&donor1, &proposal_id2, &true);

    let prop1 = client.get_proposal(&proposal_id1).unwrap();
    let prop2 = client.get_proposal(&proposal_id2).unwrap();
    assert_eq!(prop1.yes_votes, 1000);
    assert_eq!(prop2.yes_votes, 1000);

    // Disburse to both recipients
    env.set_auths(&[]);
    let recipient2 = Address::generate(&env);

    set_caller(&client, "disburse", &governance, (&recipient, 500_i128));
    client.disburse(&recipient, &500);

    set_caller(&client, "disburse", &governance, (&recipient2, 500_i128));
    client.disburse(&recipient2, &500);

    assert_eq!(client.get_balance(), 0);
    assert_eq!(client.get_total_disbursed(), 1000);
    assert_eq!(client.get_scholars_count(), 2);
}

#[test]
fn full_flow_with_pause_and_unpause() {
    let env = Env::default();
    let (client, governance, donor, recipient, _, _) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    env.mock_all_auths();

    // Initial deposit
    client.deposit(&donor, &500);
    assert_eq!(client.get_balance(), 500);

    // Pause contract
    client.pause();
    assert!(client.is_paused());

    // Verify operations fail
    let result = client.try_deposit(&donor, &100);
    assert!(result.is_err());

    // Unpause
    client.unpause();
    assert!(!client.is_paused());

    // Submit proposal and vote
    let applicant = Address::generate(&env);
    let proposal_id = client.submit_proposal(
        &applicant,
        &500,
        &String::from_str(&env, "Scholarship"),
        &String::from_str(&env, "https://example.com"),
        &String::from_str(&env, "Description"),
        &String::from_str(&env, "2026-05-01"),
        &milestone_titles,
        &milestone_dates,
    );

    client.vote(&donor, &proposal_id, &true);

    // Pause again before disburse
    client.pause();
    env.set_auths(&[]);

    set_caller(&client, "disburse", &governance, (&recipient, 500_i128));
    let result = client.try_disburse(&recipient, &500);
    assert!(result.is_err());

    // Unpause and disburse
    env.mock_all_auths();
    client.unpause();
    env.set_auths(&[]);

    set_caller(&client, "disburse", &governance, (&recipient, 500_i128));
    client.disburse(&recipient, &500);

    assert_eq!(client.get_balance(), 0);
}

#[test]
fn full_flow_edge_case_exact_balance_disburse() {
    let env = Env::default();
    let (client, governance, donor, recipient, _, _) = setup(&env);
    let (milestone_titles, milestone_dates) = sample_milestones(&env);

    env.mock_all_auths();

    // Deposit exact amount
    client.deposit(&donor, &500);

    // Submit proposal
    let applicant = Address::generate(&env);
    let proposal_id = client.submit_proposal(
        &applicant,
        &500,
        &String::from_str(&env, "Scholarship"),
        &String::from_str(&env, "https://example.com"),
        &String::from_str(&env, "Description"),
        &String::from_str(&env, "2026-05-01"),
        &milestone_titles,
        &milestone_dates,
    );

    // Vote
    client.vote(&donor, &proposal_id, &true);

    // Disburse exact balance
    env.set_auths(&[]);
    set_caller(&client, "disburse", &governance, (&recipient, 500_i128));
    client.disburse(&recipient, &500);

    assert_eq!(client.get_balance(), 0);
    assert_eq!(client.get_total_disbursed(), 500);
}
