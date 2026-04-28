extern crate std;

use soroban_sdk::{
    Address, Env, IntoVal, Symbol, Val, Vec,
    testutils::{Address as _, Events as _, Ledger, LedgerInfo, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
};

use crate::{DataKey, EscrowRecord};
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
    setup_with_inactivity_window(THIRTY_DAYS)
}

fn setup_with_inactivity_window(
    inactivity_window_seconds: u64,
) -> (Env, Address, Address, Address, Address, Address) {
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
    client.initialize(&admin, &treasury, &inactivity_window_seconds);

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
    if let Some(escrow) = client.get_escrow(&proposal_id) {
        set_caller(client, "release_tranche", &escrow.admin, (proposal_id,));
    }
    client.try_release_tranche(&proposal_id).map(|_| ())
}

fn reclaim_inactive_authorized(
    client: &MilestoneEscrowClient<'_>,
    proposal_id: u32,
) -> Result<(), Result<soroban_sdk::Error, soroban_sdk::InvokeError>> {
    if let Some(escrow) = client.get_escrow(&proposal_id) {
        set_caller(client, "reclaim_inactive", &escrow.admin, (proposal_id,));
    }
    client.try_reclaim_inactive(&proposal_id).map(|_| ())
}

#[test]
fn initialize_sets_admin_and_treasury_on_created_escrow() {
    let (env, contract_id, token, admin, treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    let before_events = env.events().all().len();
    create_escrow(&client, 1, &scholar, 120, 3);
    let after_events = env.events().all().len();
    // token transfer + EscrowCreated
    assert_eq!(after_events, before_events + 2);

    let escrow = client.get_escrow(&1).unwrap();
    assert_eq!(escrow.admin, admin);
    assert_eq!(escrow.treasury, treasury);
    assert_eq!(escrow.total_amount, 120);
    assert_eq!(escrow.released_amount, 0);
    assert_eq!(token_client(&env, &token).balance(&contract_id), 120);
}

#[test]
fn create_escrow_emits_event() {
    let (env, contract_id, _token, _admin, _treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    create_escrow(&client, 123, &scholar, 200, 4);

    let events = env.events().all();
    let found = events.iter().any(|(cid, topics, _)| {
        cid == contract_id && topics.contains(&Symbol::new(&env, "escrow_created").into_val(&env))
    });
    assert!(found, "escrow_created event not found");
}

#[test]
fn create_escrow_locks_funds_and_rejects_duplicates() {
    let (env, contract_id, token, _admin, treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    let before = env.events().all().len();
    create_escrow(&client, 7, &scholar, 100, 4);
    let after = env.events().all().len();
    // token transfer + EscrowCreated
    assert_eq!(after, before + 2);

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
    let before_reclaim = env.events().all().len();
    reclaim_inactive_authorized(&client, 11).unwrap();
    let after_reclaim = env.events().all().len();
    // token transfer back to treasury + EscrowReclaimed
    assert_eq!(after_reclaim, before_reclaim + 2);

    let escrow = client.get_escrow(&11).unwrap();
    assert_eq!(escrow.released_amount, 120);
    assert_eq!(token_client(&env, &token).balance(&treasury), 970);
    assert_eq!(token_client(&env, &token).balance(&contract_id), 0);
}

#[test]
fn reclaim_inactive_uses_configured_window_size() {
    let (env, contract_id, token, _admin, treasury, scholar) = setup_with_inactivity_window(1);
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    create_escrow(&client, 12, &scholar, 100, 4);
    release_tranche_authorized(&client, 12).unwrap();

    set_timestamp(&env, START_TS);
    let early = reclaim_inactive_authorized(&client, 12);
    assert_eq!(
        early.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InactivityNotReached as u32
        )))
    );

    set_timestamp(&env, START_TS + 1);
    reclaim_inactive_authorized(&client, 12).unwrap();
    assert_eq!(token_client(&env, &token).balance(&treasury), 975);
}

#[test]
fn reclaim_inactive_emits_event() {
    let (env, contract_id, _token, _admin, _treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    create_escrow(&client, 77, &scholar, 120, 4);
    // Make it active so last_activity is set from a release
    release_tranche_authorized(&client, 77).unwrap();

    set_timestamp(&env, START_TS + THIRTY_DAYS);
    reclaim_inactive_authorized(&client, 77).unwrap();

    let events = env.events().all();
    let found = events.iter().any(|(cid, topics, _)| {
        cid == contract_id && topics.contains(&Symbol::new(&env, "escrow_reclaimed").into_val(&env))
    });
    assert!(found, "escrow_reclaimed event not found");
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
fn zero_tranches_create_is_rejected() {
    let (env, contract_id, _token, _admin, _treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    client.env.mock_all_auths();
    let result = client.try_create_escrow(&22, &scholar, &100, &0);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidTranches as u32
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

// --- fuzz tests ---

use proptest::prelude::*;

proptest! {
    #[test]
    #[ignore]
    fn fuzz_ledger_timestamps_30_day_timeout(
        last_active_offset in 0..10_000_000_u64,
        check_time_offset in 0..10_000_000_u64
    ) {
        let (env, contract_id, _, _, _, scholar) = setup();
        let client = MilestoneEscrowClient::new(&env, &contract_id);

        let start_time = START_TS + last_active_offset;
        set_timestamp(&env, start_time);

        create_escrow(&client, 99, &scholar, 1000, 2);

        // Advance time
        let current_time = start_time + check_time_offset;
        set_timestamp(&env, current_time);

        let result = reclaim_inactive_authorized(&client, 99);

        if check_time_offset >= THIRTY_DAYS {
            assert!(result.is_ok());
        } else {
            assert_eq!(
                result.err(),
                Some(Ok(soroban_sdk::Error::from_contract_error(
                    crate::Error::InactivityNotReached as u32
                )))
            );
        }
    }

    #[test]
    #[ignore]
    fn fuzz_tranche_disbursement_amounts(
        amount in 1..100_000_000_i128,
        tranches in 1..100_u32
    ) {
        let (env, contract_id, token, _, treasury, scholar) = setup();
        let client = MilestoneEscrowClient::new(&env, &contract_id);

        if amount / (tranches as i128) == 0 {
            return Ok(());
        }

        // setup() only mints 1_000; top up so the treasury can fund this escrow
        env.mock_all_auths();
        stellar_asset_client(&env, &token).mint(&treasury, &amount);

        create_escrow(&client, 100, &scholar, amount, tranches);

        for _ in 0..tranches {
            release_tranche_authorized(&client, 100).unwrap();
        }

        let escrow = client.get_escrow(&100).unwrap();
        assert!(escrow.released_amount <= escrow.total_amount);

        // Try one more, should fail with AllTranchesReleased
        let over_release = release_tranche_authorized(&client, 100);
        assert_eq!(
            over_release.err(),
            Some(Ok(soroban_sdk::Error::from_contract_error(
                crate::Error::AllTranchesReleased as u32
            )))
        );
    }
}

#[test]
fn reclaim_inactive_when_fully_released_is_rejected() {
    let (env, contract_id, _token, _admin, _treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    create_escrow(&client, 23, &scholar, 100, 4);
    release_tranche_authorized(&client, 23).unwrap();
    release_tranche_authorized(&client, 23).unwrap();
    release_tranche_authorized(&client, 23).unwrap();
    release_tranche_authorized(&client, 23).unwrap();

    set_timestamp(&env, START_TS + THIRTY_DAYS);
    let result = reclaim_inactive_authorized(&client, 23);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::NothingToReclaim as u32
        )))
    );
}

#[test]
fn equal_split_releases_25_each_for_100_over_4_tranches() {
    let (env, contract_id, token, _admin, _treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    create_escrow(&client, 24, &scholar, 100, 4);

    release_tranche_authorized(&client, 24).unwrap();
    assert_eq!(token_client(&env, &token).balance(&scholar), 25);

    release_tranche_authorized(&client, 24).unwrap();
    assert_eq!(token_client(&env, &token).balance(&scholar), 50);

    release_tranche_authorized(&client, 24).unwrap();
    assert_eq!(token_client(&env, &token).balance(&scholar), 75);

    release_tranche_authorized(&client, 24).unwrap();
    assert_eq!(token_client(&env, &token).balance(&scholar), 100);

    let escrow = client.get_escrow(&24).unwrap();
    assert_eq!(escrow.released_amount, 100);
    assert_eq!(escrow.tranches_released, 4);
    assert_eq!(token_client(&env, &token).balance(&contract_id), 0);
}

#[test]
fn last_tranche_rounding_releases_33_33_34_for_100_over_3_tranches() {
    let (env, contract_id, token, _admin, _treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    create_escrow(&client, 25, &scholar, 100, 3);

    release_tranche_authorized(&client, 25).unwrap();
    assert_eq!(token_client(&env, &token).balance(&scholar), 33);

    release_tranche_authorized(&client, 25).unwrap();
    assert_eq!(token_client(&env, &token).balance(&scholar), 66);

    release_tranche_authorized(&client, 25).unwrap();
    assert_eq!(token_client(&env, &token).balance(&scholar), 100);

    let escrow = client.get_escrow(&25).unwrap();
    assert_eq!(escrow.released_amount, 100);
    assert_eq!(escrow.tranches_released, 3);
    assert_eq!(token_client(&env, &token).balance(&contract_id), 0);
}

#[cfg(test)]
mod fuzz_tests {
    use super::*;
    use proptest::prelude::*;

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        #[test]
        #[ignore]
        fn fuzz_ledger_timestamps(elapsed in 0..u64::MAX) {
            let (env, contract_id, _token, _admin, _treasury, scholar) = setup();
            let client = MilestoneEscrowClient::new(&env, &contract_id);

            create_escrow(&client, 99, &scholar, 100, 2);
            // Must release at least one tranche to be active and claimable
            release_tranche_authorized(&client, 99).unwrap();

            // Advance time, avoid overflowing u64
            let next_ts = START_TS.saturating_add(elapsed);
            set_timestamp(&env, next_ts);

            let res = reclaim_inactive_authorized(&client, 99);

            if elapsed >= THIRTY_DAYS {
                assert!(res.is_ok());
            } else {
                assert_eq!(
                    res.err(),
                    Some(Ok(soroban_sdk::Error::from_contract_error(
                        Error::InactivityNotReached as u32
                    )))
                );
            }
        }

        #[test]
        #[ignore]
        fn fuzz_tranche_disbursement_amounts(amount in 1..1_000_000_000_i128, tranches in 1..1000_u32) {
            let (env, contract_id, token, _admin, treasury, scholar) = setup();
            let client = MilestoneEscrowClient::new(&env, &contract_id);

            // Overpayment check constraint: amounts must be enough for tranches
            if amount < tranches as i128 {
                return Ok(());
            }

            // Ensure the treasury has enough balance for the randomized escrow amount.
            // setup() only mints 1_000 tokens by default.
            env.mock_all_auths();
            stellar_asset_client(&env, &token).mint(&treasury, &amount);

            create_escrow(&client, 100, &scholar, amount, tranches);

            let mut released = 0_i128;
            for _ in 0..tranches {
                assert!(release_tranche_authorized(&client, 100).is_ok());
                let escrow = client.get_escrow(&100).unwrap();
                assert!(escrow.released_amount <= amount);
                assert!(escrow.released_amount > released);
                released = escrow.released_amount;
            }

            // Releasing an extra one fails
            assert_eq!(
                release_tranche_authorized(&client, 100).err(),
                Some(Ok(soroban_sdk::Error::from_contract_error(
                    Error::AllTranchesReleased as u32
                )))
            );

            let final_escrow = client.get_escrow(&100).unwrap();
            assert_eq!(final_escrow.released_amount, amount);
        }
    }
}

#[test]
fn upgrade_requires_admin_auth() {
    let (env, contract_id, _token, _admin, _treasury, _scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);
    let attacker = Address::generate(&env);
    let wasm_hash = crate::upgrade::testutils::upload_upgrade_target(&env);

    set_caller(&client, "upgrade", &attacker, (wasm_hash.clone(),));
    assert!(client.try_upgrade(&wasm_hash).is_err());
}

#[test]
fn state_persists_after_upgrade() {
    let (env, contract_id, _token, admin, _treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);
    create_escrow(&client, 404, &scholar, 120, 3);

    let wasm_hash = crate::upgrade::testutils::upload_upgrade_target(&env);
    set_caller(&client, "upgrade", &admin, (wasm_hash.clone(),));
    client.upgrade(&wasm_hash);

    let escrow = env.as_contract(&contract_id, || {
        env.storage()
            .persistent()
            .get::<_, EscrowRecord>(&DataKey::Escrow(404))
    });
    let stored_hash = env.as_contract(&contract_id, || crate::upgrade::current_hash(&env));

    let escrow = escrow.expect("escrow should remain after upgrade");
    assert_eq!(escrow.scholar, scholar);
    assert_eq!(escrow.total_amount, 120);
    assert_eq!(escrow.total_tranches, 3);
    assert_eq!(stored_hash, wasm_hash);
}

#[test]
fn benchmark_costs() {
    let (env, contract_id, _token, admin, _treasury, scholar) = setup();
    let client = MilestoneEscrowClient::new(&env, &contract_id);

    // 1. Benchmark create_escrow
    env.cost_estimate().budget().reset_unlimited();
    env.mock_all_auths();
    client.create_escrow(&1, &scholar, &1000, &4);
    let create_instr = env.cost_estimate().budget().cpu_instruction_cost();
    let create_mem = env.cost_estimate().budget().memory_bytes_cost();

    // 2. Benchmark release_tranche
    env.cost_estimate().budget().reset_unlimited();
    set_caller(&client, "release_tranche", &admin, (1_u32,));
    client.release_tranche(&1);
    let release_instr = env.cost_estimate().budget().cpu_instruction_cost();
    let release_mem = env.cost_estimate().budget().memory_bytes_cost();

    // 3. Benchmark get_escrow
    env.cost_estimate().budget().reset_unlimited();
    client.get_escrow(&1);
    let get_instr = env.cost_estimate().budget().cpu_instruction_cost();
    let get_mem = env.cost_estimate().budget().memory_bytes_cost();

    extern crate std;
    std::println!("BENCHMARK_RESULTS: milestone_escrow");
    std::println!("create_escrow: instr={}, mem={}", create_instr, create_mem);
    std::println!(
        "release_tranche: instr={}, mem={}",
        release_instr,
        release_mem
    );
    std::println!("get_escrow: instr={}, mem={}", get_instr, get_mem);
}
