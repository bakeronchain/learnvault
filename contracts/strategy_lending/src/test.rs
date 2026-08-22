#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};
use super::{StrategyLending, StrategyLendingClient};

fn setup_env() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let donor = Address::generate(&env);
    let to = Address::generate(&env);
        let token_addr = env.register_stellar_asset_contract_v2(donor.clone()).address();
    // Fund the donor so they can transfer USDC to the adapter in each test.
    StellarAssetClient::new(&env, &token_addr).mint(&donor, &1_000_000);
    (env, admin, donor, to, token_addr)
}

fn clients<'a>(
    env: &'a Env, token_addr: &Address,
) -> (StellarAssetClient<'a>, TokenClient<'a>) {
    (
        StellarAssetClient::new(env, token_addr),
        TokenClient::new(env, token_addr),
    )
}

#[test]
fn initialize_sets_admin_and_token() {
    let (env, admin, _donor, _to, token_addr) = setup_env();
    let strat = env.register(StrategyLending, ());
    let client = StrategyLendingClient::new(&env, &strat);
    client.initialize(&admin, &token_addr);

    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_token(), token_addr);
    assert_eq!(client.balance_of(), 0);
    assert_eq!(client.get_rate_bps(), 500);
}

#[test]
fn deposit_accrues_withdraw_grows() {
    let (env, admin, donor, to, token_addr) = setup_env();
    let strat = env.register(StrategyLending, ());
    let client = StrategyLendingClient::new(&env, &strat);
    client.initialize(&admin, &token_addr);
    let (_asset, token) = clients(&env, &token_addr);

    token.transfer(&donor, &strat, &1_000);
    client.deposit(&1_000);
    assert_eq!(client.balance_of(), 1_000);
    assert_eq!(client.get_position(), (1_000, 1_000));

    // Advance one year: 5% of 1_000 principal = 50 interest.
    env.ledger().set_timestamp(env.ledger().timestamp() + 365 * 86_400);
    assert_eq!(client.balance_of(), 1_050);

        let got = client.withdraw(&1_000, &to);
    assert_eq!(got, 1_000);
    // Real tokens are fully reclaimed.
    assert_eq!(token.balance(&strat), 0);
    // The 50 accrued interest is unrealized (no real tokens were ever credited
    // by the venue), so it stays on the books but cannot be withdrawn as funds.
    assert_eq!(client.balance_of(), 50);
    assert_eq!(client.get_position(), (0, 50));
}

#[test]
fn interest_rounds_down_favoring_venue() {
    let (env, admin, donor, _to, token_addr) = setup_env();
    let strat = env.register(StrategyLending, ());
    let client = StrategyLendingClient::new(&env, &strat);
    client.initialize(&admin, &token_addr);
    let (_asset, token) = clients(&env, &token_addr);

    token.transfer(&donor, &strat, &1_000);
    client.deposit(&1_000);
    // 1 month (~1/12 year) of 5% on 1_000 = ~4.16 -> floor 4.
    env.ledger().set_timestamp(env.ledger().timestamp() + 30 * 86_400);
    assert_eq!(client.balance_of(), 1_004);
}

#[test]
fn write_off_reduces_principal_and_total() {
    let (env, admin, donor, _to, token_addr) = setup_env();
    let strat = env.register(StrategyLending, ());
    let client = StrategyLendingClient::new(&env, &strat);
    client.initialize(&admin, &token_addr);
    let (_asset, token) = clients(&env, &token_addr);

    token.transfer(&donor, &strat, &10_000);
    client.deposit(&10_000);
    client.write_off(&3_000);
    assert_eq!(client.get_position(), (7_000, 7_000));

    // Write-off larger than principal is capped to principal.
    client.write_off(&100_000);
    assert_eq!(client.get_position(), (0, 0));
}

#[test]
fn pause_blocks_withdraw() {
    let (env, admin, donor, to, token_addr) = setup_env();
    let strat = env.register(StrategyLending, ());
    let client = StrategyLendingClient::new(&env, &strat);
    client.initialize(&admin, &token_addr);
    let (_asset, token) = clients(&env, &token_addr);

    token.transfer(&donor, &strat, &1_000);
    client.deposit(&1_000);
    client.pause_withdrawals(&true);
    let res = client.try_withdraw(&1_000, &to);
    assert!(res.is_err());
}

#[test]
fn reserve_limit_caps_withdrawal() {
    let (env, admin, donor, _to, token_addr) = setup_env();
    let strat = env.register(StrategyLending, ());
    let client = StrategyLendingClient::new(&env, &strat);
    client.initialize(&admin, &token_addr);
    let (_asset, token) = clients(&env, &token_addr);

        token.transfer(&donor, &strat, &10_000);
    client.deposit(&10_000);
    client.set_reserve_bps(&5_000); // 50 % liquid
    assert_eq!(client.max_withdrawable(), 5_000);
}

#[test]
fn non_admin_cannot_deposit() {
    let (env, admin, donor, _to, token_addr) = setup_env();
    let strat = env.register(StrategyLending, ());
    let client = StrategyLendingClient::new(&env, &strat);
    client.initialize(&admin, &token_addr);
    let (_asset, token) = clients(&env, &token_addr);
    token.transfer(&donor, &strat, &1_000);

    // Disable auto-auths: deposit() requires the admin, which isn't authorized.
    env.set_auths(&[]);
    let res = client.try_deposit(&1_000);
    assert!(res.is_err());
}
