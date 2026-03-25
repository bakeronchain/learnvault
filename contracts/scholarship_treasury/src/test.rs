extern crate std;

use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    Address, Env, IntoVal, String, Val, Vec,
};

use crate::{token, Error, ScholarshipTreasury, ScholarshipTreasuryClient};

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
    env.ledger().set_sequence_number(proposal.deadline_ledger + 1);

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
