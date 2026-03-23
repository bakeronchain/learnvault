extern crate std;

use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    Address, Env, IntoVal, Val, Vec,
};

use crate::{token, Error, ScholarshipTreasury, ScholarshipTreasuryClient};

fn setup<'a>(env: &'a Env) -> (ScholarshipTreasuryClient<'a>, Address, Address, Address, Address) {
    let admin = Address::generate(env);
    let governance = Address::generate(env);
    let donor = Address::generate(env);
    let recipient = Address::generate(env);

    let contract_id = env.register(ScholarshipTreasury, ());
    let client = ScholarshipTreasuryClient::new(env, &contract_id);

    env.mock_all_auths();
    env.as_contract(&contract_id, || token::register(env, &admin));
    let token_id = env.as_contract(&contract_id, || token::contract_id(env));
    let sac = StellarAssetClient::new(env, &token_id);
    sac.mint(&donor, &1_000);
    client.initialize(&admin, &token_id, &governance);
    env.set_auths(&[]);

    (client, governance, donor, recipient, token_id)
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

#[test]
fn deposits_are_tracked_per_donor() {
    let env = Env::default();
    let (client, _governance, donor, _recipient, token_id) = setup(&env);

    env.mock_all_auths();
    client.deposit(&donor, &150);
    client.deposit(&donor, &50);

    assert_eq!(client.get_donor_total(&donor), 200);
    assert_eq!(client.get_balance(), 200);
    assert_eq!(token_client(&env, &token_id).balance(&client.address), 200);
    assert_eq!(token_client(&env, &token_id).balance(&donor), 800);
}

#[test]
fn unauthorized_disburse_is_rejected() {
    let env = Env::default();
    let (client, governance, donor, recipient, token_id) = setup(&env);
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
    let (client, governance, donor, recipient, _token_id) = setup(&env);
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
