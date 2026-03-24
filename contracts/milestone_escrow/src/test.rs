extern crate std;

use soroban_sdk::{
    Address, Env,
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{StellarAssetClient, TokenClient},
};

use crate::{Error, MilestoneEscrow, MilestoneEscrowClient, xlm};
use proptest::prelude::*;

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

#[test]
fn releases_tranches_in_order() {
    let (env, contract_id, token, _admin, treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    client.create_escrow(&7, &scholar, &100, &3);
    assert_eq!(token_client(&env, &token).balance(&treasury), 900);
    assert_eq!(token_client(&env, &token).balance(&contract_id), 100);

    client.release_tranche(&7);
    let e1 = client.get_escrow(&7).unwrap();
    assert_eq!(e1.released_amount, 33);
    assert_eq!(e1.tranches_released, 1);
    assert_eq!(token_client(&env, &token).balance(&scholar), 33);

    client.release_tranche(&7);
    let e2 = client.get_escrow(&7).unwrap();
    assert_eq!(e2.released_amount, 66);
    assert_eq!(e2.tranches_released, 2);
    assert_eq!(token_client(&env, &token).balance(&scholar), 66);

    client.release_tranche(&7);
    let e3 = client.get_escrow(&7).unwrap();
    assert_eq!(e3.released_amount, 100);
    assert_eq!(e3.tranches_released, 3);
    assert_eq!(token_client(&env, &token).balance(&scholar), 100);
    assert_eq!(token_client(&env, &token).balance(&contract_id), 0);
}

#[test]
fn reclaims_after_30_days_of_inactivity() {
    let (env, contract_id, token, _admin, treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    client.create_escrow(&8, &scholar, &120, &4);
    client.release_tranche(&8);
    assert_eq!(token_client(&env, &token).balance(&scholar), 30);

    set_timestamp(&env, START_TS + THIRTY_DAYS - 1);
    let early_reclaim = client.try_reclaim_inactive(&8);
    assert_eq!(
        early_reclaim.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InactivityNotReached as u32
        )))
    );

    set_timestamp(&env, START_TS + THIRTY_DAYS);
    client.reclaim_inactive(&8);

    let escrow = client.get_escrow(&8).unwrap();
    assert_eq!(escrow.released_amount, 120);
    assert_eq!(token_client(&env, &token).balance(&treasury), 970);
    assert_eq!(token_client(&env, &token).balance(&contract_id), 0);
}

#[test]
fn overpayment_is_rejected() {
    let (env, contract_id, _token, _admin, _treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    client.create_escrow(&9, &scholar, &2, &4);
    let first_release = client.try_release_tranche(&9);
    assert_eq!(
        first_release.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::Overpayment as u32
        )))
    );
}

// ---------------------------------------------------------------------------
// Fuzz Testing
// ---------------------------------------------------------------------------

proptest! {
    #![proptest_config(ProptestConfig::with_cases(256))]
    
    #[test]
    #[ignore]
    fn fuzz_ledger_timestamps(time_offset in 0_u64..100_000_000_000) {
        let (env, contract_id, token, _admin, _treasury, scholar) = setup();
        let client = MilestoneEscrowClient::new(&env, &contract_id);
        
        env.mock_all_auths();
        
        let escrow_id = 99;
        client.create_escrow(&escrow_id, &scholar, &120, &4);
        
        client.release_tranche(&escrow_id);
        
        let new_time = START_TS + time_offset;
        set_timestamp(&env, new_time);
        
        if time_offset >= THIRTY_DAYS {
            client.reclaim_inactive(&escrow_id);
            assert_eq!(client.get_escrow(&escrow_id).unwrap().released_amount, 120);
            assert_eq!(token_client(&env, &token).balance(&contract_id), 0);
        } else {
            let res = client.try_reclaim_inactive(&escrow_id);
            assert_eq!(res.err(), Some(Ok(soroban_sdk::Error::from_contract_error(Error::InactivityNotReached as u32))));
        }
    }
    
    #[test]
    #[ignore]
    fn fuzz_tranche_disbursement_amounts(
        total_amount in 1_i128..1_000_000_000_000, 
        milestone_count in 1_u32..10_000
    ) {
        let (env, contract_id, token, _admin, treasury, scholar) = setup();
        let client = MilestoneEscrowClient::new(&env, &contract_id);
        
        env.mock_all_auths();
        
        if total_amount > 1_000 {
            stellar_asset_client(&env, &token).mint(&treasury, &(total_amount - 1_000));
        }
        
        let escrow_id = 100;
        client.create_escrow(&escrow_id, &scholar, &total_amount, &milestone_count);
        
        let mut expected_released = 0;
        let tranche_amount = total_amount / (milestone_count as i128);
        
        for i in 1..=milestone_count {
            client.release_tranche(&escrow_id);
            let e = client.get_escrow(&escrow_id).unwrap();
            
            if i == milestone_count {
                expected_released = total_amount;
            } else {
                expected_released += tranche_amount;
            }
            
            assert_eq!(e.released_amount, expected_released);
            assert_eq!(e.tranches_released, i);
            assert_eq!(token_client(&env, &token).balance(&scholar), expected_released);
        }
        
        let res = client.try_release_tranche(&escrow_id);
        assert!(res.is_err());
        assert_eq!(token_client(&env, &token).balance(&contract_id), 0);
    }
}
