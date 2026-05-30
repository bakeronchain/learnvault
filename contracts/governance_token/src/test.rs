#![cfg(test)]

extern crate std;

use soroban_sdk::{
	Address, Env, IntoVal, String,
	testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
};

use crate::{GOVError, GovernanceToken, GovernanceTokenClient};

fn setup(env: &Env) -> (Address, Address, GovernanceTokenClient) {
	let admin = Address::generate(env);
	let contract_id = env.register(GovernanceToken, ());
	env.mock_all_auths();
	let client = GovernanceTokenClient::new(env, &contract_id);
	client.initialize(&admin, &0);
	(contract_id, admin, client)
}

#[test]
fn initialize_exposes_expected_metadata() {
	let env = Env::default();
	let (_, _, client) = setup(&env);

	assert_eq!(
		client.name(),
		String::from_str(&env, "LearnVault Governance"),
	);
	assert_eq!(client.symbol(), String::from_str(&env, "GOV"));
	assert_eq!(client.decimals(), 7);
}

#[test]
fn only_admin_can_mint() {
	let env = Env::default();
	let admin = Address::generate(&env);
	let attacker = Address::generate(&env);
	let recipient = Address::generate(&env);
	let contract_id = env.register(GovernanceToken, ());

	env.mock_auths(&[MockAuth {
		address: &admin,
		invoke: &MockAuthInvoke {
			contract: &contract_id,
			fn_name: "initialize",
			args: (admin.clone(),).into_val(&env),
			sub_invokes: &[],
		},
	}]);

	let client = GovernanceTokenClient::new(&env, &contract_id);
	client.initialize(&admin, &0);

	env.mock_auths(&[MockAuth {
		address: &attacker,
		invoke: &MockAuthInvoke {
			contract: &contract_id,
			fn_name: "mint",
			args: (recipient.clone(), 10_i128).into_val(&env),
			sub_invokes: &[],
		},
	}]);

	let result = client.try_mint(&recipient, &10);
	assert!(result.is_err());
	assert_eq!(client.balance(&recipient), 0);
}

#[test]
fn mint_and_balance_queries_track_supply() {
	let env = Env::default();
	let (_, _, client) = setup(&env);
	let alice = Address::generate(&env);
	let bob = Address::generate(&env);

	client.mint(&alice, &120);
	client.mint(&bob, &80);

	assert_eq!(client.balance(&alice), 120);
	assert_eq!(client.balance(&bob), 80);
	assert_eq!(client.total_supply(), 200);
}

#[test]
fn transfer_moves_tokens_between_accounts() {
	let env = Env::default();
	let (_, _, client) = setup(&env);
	let alice = Address::generate(&env);
	let bob = Address::generate(&env);

	client.mint(&alice, &75);
	client.transfer(&alice, &bob, &30);

	assert_eq!(client.balance(&alice), 45);
	assert_eq!(client.balance(&bob), 30);
	assert_eq!(client.total_supply(), 75);
}

#[test]
fn set_admin_hands_off_mint_authority() {
	let env = Env::default();
	let (_, _, client) = setup(&env);
	let new_admin = Address::generate(&env);
	let recipient = Address::generate(&env);

	client.set_admin(&new_admin);
	client.mint(&recipient, &55);

	assert_eq!(client.balance(&recipient), 55);
	assert_eq!(client.total_supply(), 55);
}

#[test]
fn mint_and_transfer_emit_contract_events() {
	let env = Env::default();
	let (contract_id, _, client) = setup(&env);
	let alice = Address::generate(&env);
	let bob = Address::generate(&env);

	let baseline = env.events().all().len();
	client.mint(&alice, &25);
	let after_mint = env.events().all();
	assert!(
		after_mint.len() > baseline
			&& after_mint.iter().any(|(cid, _, _)| *cid == contract_id),
		"expected a mint event from the governance token contract",
	);

	let mint_event_count = after_mint.len();
	client.transfer(&alice, &bob, &10);
	let after_transfer = env.events().all();
	assert!(
		after_transfer.len() > mint_event_count
			&& after_transfer.iter().any(|(cid, _, _)| *cid == contract_id),
		"expected a transfer event from the governance token contract",
	);
}

#[test]
fn zero_transfer_is_rejected() {
	let env = Env::default();
	let (_, _, client) = setup(&env);
	let alice = Address::generate(&env);
	let bob = Address::generate(&env);

	client.mint(&alice, &5);

	let result = client.try_transfer(&alice, &bob, &0);
	assert_eq!(
		result.err(),
		Some(Ok(soroban_sdk::Error::from_contract_error(
			GOVError::ZeroAmount as u32,
		))),
	);
}

#[test]
fn self_transfer_preserves_balance() {
	let env = Env::default();
	let (_, _, client) = setup(&env);
	let alice = Address::generate(&env);

	client.mint(&alice, &42);
	client.transfer(&alice, &alice, &17);

	assert_eq!(client.balance(&alice), 42);
	assert_eq!(client.total_supply(), 42);
}

#[test]
fn mint_overflow_is_rejected() {
	let env = Env::default();
	let (_, _, client) = setup(&env);
	let whale = Address::generate(&env);

	client.mint(&whale, &i128::MAX);

	let result = client.try_mint(&whale, &1);
	assert_eq!(
		result.err(),
		Some(Ok(soroban_sdk::Error::from_contract_error(
			GOVError::ArithmeticOverflow as u32,
		))),
	);
}

#[test]
fn timelock_period_defaults_to_forty_eight_hours() {
	let env = Env::default();
	let (_, _, client) = setup(&env);
	assert_eq!(client.get_timelock_period(), crate::TIMELOCK_PERIOD);
}

#[test]
fn execute_proposal_fails_before_timelock_expires() {
	let env = Env::default();
	let (_, admin, client) = setup(&env);
	let proposal_id = 1_u32;

	client.create_proposal(&admin, &proposal_id);
	client.mark_proposal_passed(&admin, &proposal_id);

	let result = client.try_execute_proposal(&proposal_id);
	assert_eq!(
		result.err(),
		Some(Ok(soroban_sdk::Error::from_contract_error(
			GOVError::TimelockActive as u32,
		))),
	);
}

#[test]
fn execute_proposal_succeeds_after_timelock() {
	let env = Env::default();
	let (_, admin, client) = setup(&env);
	let proposal_id = 2_u32;

	client.create_proposal(&admin, &proposal_id);
	client.mark_proposal_passed(&admin, &proposal_id);

	let proposal = client.get_proposal(&proposal_id).unwrap();
	env.ledger().set_timestamp(proposal.execution_not_before);

	client.execute_proposal(&proposal_id);

	let executed = client.get_proposal(&proposal_id).unwrap();
	assert!(executed.executed);
}
