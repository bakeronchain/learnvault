extern crate std;

use soroban_sdk::{
    Address, Env, IntoVal, Val, Vec,
    testutils::{Address as _, Ledger, LedgerInfo, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
};

use crate::{Error, MilestoneEscrow, MilestoneEscrowClient, xlm};

const START_TS: u64 = 1_700_000_000;
const THIRTY_DAYS: u64 = 30 * 24 * 60 * 60;

fn set_timestamp(env: &Env, timestamp: u64) {
    env.ledger().set(LedgerInfo {
        timestamp,
        protocol_version: 23,
        sequence_number: 1,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 6312000,
    });
}

fn token_address(env: &Env, contract_id: &Address) -> Address {
    env.as_contract(contract_id, || xlm::contract_id(env))
}

fn token_client<'a>(env: &Env, token: &Address) -> TokenClient<'a> {
    TokenClient::new(env, token)
}

fn stellar_asset_client<'a>(env: &Env, token: &Address) -> StellarAssetClient<'a> {
    StellarAssetClient::new(env, token)
}

fn setup() -> (Env, Address, Address, Address, Address, Address) {
    let env = Env::default();
    set_timestamp(&env, START_TS);

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let scholar = Address::generate(&env);

    let contract_id = env.register(MilestoneEscrow, ());
    env.mock_all_auths();
    env.as_contract(&contract_id, || xlm::register(&env, &admin));
    let token = token_address(&env, &contract_id);
    stellar_asset_client(&env, &token).mint(&treasury, &1_000);

    let client = MilestoneEscrowClient::new(&env, &contract_id);
    client.initialize(&admin, &treasury);

    (env, contract_id, token, admin, treasury, scholar)
}

fn set_caller<T>(client: &MilestoneEscrowClient<'_>, fn_name: &str, caller: &Address, args: T)
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

fn create_escrow(
    client: &MilestoneEscrowClient<'_>,
    proposal_id: u32,
    scholar: &Address,
    amount: i128,
    tranches: u32,
) {
    client.env.mock_all_auths();
    client.create_escrow(&proposal_id, scholar, &amount, &tranches);
}

fn release_tranche_authorized(
    client: &MilestoneEscrowClient<'_>,
    proposal_id: u32,
) -> Result<(), Result<soroban_sdk::Error, soroban_sdk::InvokeError>> {
    client.env.mock_all_auths();
    client.try_release_tranche(&proposal_id).map(|_| ())
}

fn reclaim_inactive_authorized(
    client: &MilestoneEscrowClient<'_>,
    proposal_id: u32,
) -> Result<(), Result<soroban_sdk::Error, soroban_sdk::InvokeError>> {
    client.env.mock_all_auths();
    client.try_reclaim_inactive(&proposal_id).map(|_| ())
}

#[test]
fn initialize_sets_admin_and_treasury_on_created_escrow() {
    let (env, contract_id, token, admin, treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    create_escrow(&client, 1, &scholar, 120, 3);

    let escrow = client.get_escrow(&1).unwrap();
    assert_eq!(escrow.admin, admin);
    assert_eq!(escrow.treasury, treasury);
    assert_eq!(escrow.total_amount, 120);
    assert_eq!(escrow.released_amount, 0);
    assert_eq!(token_client(&env, &token).balance(&contract_id), 120);
}

#[test]
fn create_escrow_locks_funds_and_rejects_duplicates() {
    let (env, contract_id, token, _admin, treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    create_escrow(&client, 7, &scholar, 100, 4);

    let escrow = client.get_escrow(&7).unwrap();
    assert_eq!(escrow.scholar, scholar);
    assert_eq!(escrow.total_amount, 100);
    assert_eq!(escrow.total_tranches, 4);
    assert_eq!(token_client(&env, &token).balance(&treasury), 900);
    assert_eq!(token_client(&env, &token).balance(&contract_id), 100);

    client.env.mock_all_auths();
    let duplicate = client.try_create_escrow(&7, &escrow.scholar, &100, &4);
    assert_eq!(
        duplicate.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::EscrowExists as u32
        )))
    );
}

#[test]
fn release_tranche_is_admin_only_and_stops_after_all_tranches() {
    let (env, contract_id, token, _admin, _treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);
    let attacker = Address::generate(&env);

    create_escrow(&client, 9, &scholar, 100, 3);

    set_caller(&client, "release_tranche", &attacker, (9_u32,));
    let unauthorized = client.try_release_tranche(&9).map(|_| ());
    assert!(unauthorized.is_err());

    release_tranche_authorized(&client, 9).unwrap();
    let first = client.get_escrow(&9).unwrap();
    assert_eq!(first.released_amount, 33);
    assert_eq!(first.tranches_released, 1);
    assert_eq!(token_client(&env, &token).balance(&scholar), 33);

    release_tranche_authorized(&client, 9).unwrap();
    let second = client.get_escrow(&9).unwrap();
    assert_eq!(second.released_amount, 66);
    assert_eq!(second.tranches_released, 2);

    release_tranche_authorized(&client, 9).unwrap();
    let final_record = client.get_escrow(&9).unwrap();
    assert_eq!(final_record.released_amount, 100);
    assert_eq!(final_record.tranches_released, 3);
    assert_eq!(token_client(&env, &token).balance(&scholar), 100);
    assert_eq!(token_client(&env, &token).balance(&contract_id), 0);

    let over_release = release_tranche_authorized(&client, 9);
    assert_eq!(
        over_release.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::AllTranchesReleased as u32
        )))
    );
}

#[test]
fn reclaim_inactive_requires_admin_and_deadline() {
    let (env, contract_id, token, _admin, treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);
    let attacker = Address::generate(&env);

    create_escrow(&client, 11, &scholar, 120, 4);
    release_tranche_authorized(&client, 11).unwrap();

    set_caller(&client, "reclaim_inactive", &attacker, (11_u32,));
    let unauthorized = client.try_reclaim_inactive(&11).map(|_| ());
    assert!(unauthorized.is_err());

    set_timestamp(&env, START_TS + THIRTY_DAYS - 1);
    let early = reclaim_inactive_authorized(&client, 11);
    assert_eq!(
        early.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InactivityNotReached as u32
        )))
    );

    set_timestamp(&env, START_TS + THIRTY_DAYS);
    reclaim_inactive_authorized(&client, 11).unwrap();

    let escrow = client.get_escrow(&11).unwrap();
    assert_eq!(escrow.released_amount, 120);
    assert_eq!(token_client(&env, &token).balance(&treasury), 970);
    assert_eq!(token_client(&env, &token).balance(&contract_id), 0);
}

#[test]
fn get_escrow_reflects_each_stage_of_the_full_flow() {
    let (env, contract_id, _token, _admin, _treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    create_escrow(&client, 15, &scholar, 90, 2);
    let created = client.get_escrow(&15).unwrap();
    assert_eq!(created.released_amount, 0);
    assert_eq!(created.tranches_released, 0);

    release_tranche_authorized(&client, 15).unwrap();
    let partial = client.get_escrow(&15).unwrap();
    assert_eq!(partial.released_amount, 45);
    assert_eq!(partial.tranches_released, 1);

    release_tranche_authorized(&client, 15).unwrap();
    let closed = client.get_escrow(&15).unwrap();
    assert_eq!(closed.released_amount, 90);
    assert_eq!(closed.tranches_released, 2);
    assert_eq!(closed.total_amount, 90);
}

#[test]
fn zero_amount_create_is_rejected() {
    let (env, contract_id, _token, _admin, _treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    client.env.mock_all_auths();
    let result = client.try_create_escrow(&20, &scholar, &0, &2);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidAmount as u32
        )))
    );
}

#[test]
fn overpayment_is_rejected() {
    let (env, contract_id, _token, _admin, _treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    create_escrow(&client, 21, &scholar, 2, 4);
    let first_release = release_tranche_authorized(&client, 21);

    assert_eq!(
        first_release.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::Overpayment as u32
        )))
    );
}
