//! Fuzz target for milestone_escrow deposit (create_escrow), release
//! (release_tranche), and refund (reclaim_inactive) operations.
//!
//! Run locally:
//!   cargo test -p milestone-escrow --test fuzz_escrow_operations -- --include-ignored
//! CI runs this target for 60 seconds on pull requests.

extern crate std;

use milestone_escrow::{Error, MilestoneEscrow, MilestoneEscrowClient};
use proptest::prelude::*;
use soroban_sdk::{
    Address, Env, IntoVal, Symbol, Val, Vec, symbol_short,
    testutils::{Address as _, Ledger, LedgerInfo, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
};

const XLM_KEY: Symbol = symbol_short!("XLM");

fn register_xlm(env: &Env, contract_id: &Address, admin: &Address) {
    env.as_contract(contract_id, || {
        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        env.storage().instance().set(&XLM_KEY, &sac.address());
    });
}

fn token_address(env: &Env, contract_id: &Address) -> Address {
    env.as_contract(contract_id, || {
        env.storage()
            .instance()
            .get::<_, Address>(&XLM_KEY)
            .expect("XLM contract not initialized")
    })
}

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

fn token_client<'a>(env: &'a Env, token: &'a Address) -> TokenClient<'a> {
    TokenClient::new(env, token)
}

fn setup_env() -> (Env, Address, Address, Address, Address, Address, MilestoneEscrowClient<'static>) {
    let env = Env::default();
    set_timestamp(&env, START_TS);

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let scholar = Address::generate(&env);
    let contract_id = env.register(MilestoneEscrow, ());

    env.mock_all_auths();
    register_xlm(&env, &contract_id, &admin);
    let token = token_address(&env, &contract_id);
    StellarAssetClient::new(&env, &token).mint(&treasury, &10_000_000_000);

    let client = MilestoneEscrowClient::new(&env, &contract_id);
    client.initialize(&admin, &treasury, &THIRTY_DAYS);

    (env, contract_id, token, admin, treasury, scholar, client)
}

fn set_caller<T>(client: &MilestoneEscrowClient<'_>, fn_name: &str, caller: &Address, args: T)
where
    T: IntoVal<Env, Vec<Val>>,
{
    client.env.set_auths(&[]);
    client.env.mock_auths(&[MockAuth {
        address: caller,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name,
            args: args.into_val(&client.env),
            sub_invokes: &[],
        },
    }]);
}

fn escrow_balance_invariant(
    env: &Env,
    token: &Address,
    contract_id: &Address,
    record: &milestone_escrow::EscrowRecord,
) {
    let contract_balance = token_client(env, token).balance(contract_id);
    let remaining = record.total_amount - record.released_amount;
    assert!(
        contract_balance >= 0,
        "contract escrow balance must never be negative"
    );
    assert!(
        remaining >= 0,
        "unreleased escrow amount must never be negative"
    );
    assert!(
        record.released_amount <= record.total_amount,
        "released amount must not exceed total deposit"
    );
    assert!(
        contract_balance <= record.total_amount,
        "on-chain balance must not exceed escrow total"
    );
}

proptest! {
    #![proptest_config(ProptestConfig {
        cases: 256,
        .. ProptestConfig::default()
    })]

    #[test]
    #[ignore = "fuzz: deposit (create_escrow) invariant"]
    fn fuzz_deposit(
        proposal_id in 1_u32..10_000,
        amount in 1_i128..1_000_000_000,
        tranches in 1_u32..100,
    ) {
        let (env, contract_id, token, _admin, treasury, scholar, client) = setup_env();
        if amount < tranches as i128 {
            return Ok(());
        }

        env.mock_all_auths();
        StellarAssetClient::new(&env, &token).mint(&treasury, &amount);

        let result = client.try_create_escrow(&proposal_id, &scholar, &amount, &tranches);
        prop_assert!(result.is_ok());

        let record = client.get_escrow(&proposal_id).unwrap();
        prop_assert_eq!(record.total_amount, amount);
        prop_assert_eq!(record.released_amount, 0);
        escrow_balance_invariant(&env, &token, &contract_id, &record);
    }

    #[test]
    #[ignore = "fuzz: release (release_tranche) invariant"]
    fn fuzz_release(
        amount in 4_i128..1_000_000,
        tranches in 1_u32..20,
        releases in 0_u32..20,
    ) {
        let (env, contract_id, token, admin, treasury, scholar, client) = setup_env();
        if amount < tranches as i128 {
            return Ok(());
        }

        env.mock_all_auths();
        StellarAssetClient::new(&env, &token).mint(&treasury, &amount);
        client.create_escrow(&1, &scholar, &amount, &tranches);

        let mut release_count = 0_u32;
        while release_count < releases {
            let record = match client.get_escrow(&1) {
                Some(r) if r.tranches_released < r.total_tranches => r,
                _ => break,
            };

            set_caller(&client, "release_tranche", &admin, (1_u32,));
            let result = client.try_release_tranche(&1);
            if result.is_err() {
                break;
            }

            let updated = client.get_escrow(&1).unwrap();
            prop_assert!(updated.released_amount >= record.released_amount);
            escrow_balance_invariant(&env, &token, &contract_id, &updated);
            release_count += 1;
        }
    }

    #[test]
    #[ignore = "fuzz: refund (reclaim_inactive) invariant"]
    fn fuzz_refund(elapsed in 0_u64..THIRTY_DAYS * 2, partial_releases in 0_u32..5) {
        let (env, contract_id, token, admin, treasury, scholar, client) = setup_env();
        let amount = 1_000_i128;
        let tranches = 5_u32;

        env.mock_all_auths();
        StellarAssetClient::new(&env, &token).mint(&treasury, &amount);
        client.create_escrow(&2, &scholar, &amount, &tranches);

        for _ in 0..partial_releases.min(tranches) {
            set_caller(&client, "release_tranche", &admin, (2_u32,));
            if client.try_release_tranche(&2).is_err() {
                break;
            }
        }

        set_timestamp(&env, START_TS.saturating_add(elapsed));
        set_caller(&client, "reclaim_inactive", &admin, (2_u32,));
        let result = client.try_reclaim_inactive(&2);

        let record = client.get_escrow(&2).unwrap();
        if elapsed >= THIRTY_DAYS && record.released_amount < record.total_amount {
            prop_assert!(result.is_ok());
        } else if elapsed < THIRTY_DAYS {
            prop_assert_eq!(
                result.err(),
                Some(Ok(soroban_sdk::Error::from_contract_error(
                    Error::InactivityNotReached as u32
                )))
            );
        }
        escrow_balance_invariant(&env, &token, &contract_id, &record);
    }
}

#[test]
#[ignore = "fuzz: requires test_xlm context — run via the lib's internal test suite"]
fn fuzz_smoke_deposit_release_refund() {
    let (_env, contract_id, token, admin, treasury, scholar, client) = setup_env();
    let env = client.env.clone();
    env.mock_all_auths();
    StellarAssetClient::new(&env, &token).mint(&treasury, &500);
    client.create_escrow(&99, &scholar, &500, &2);
    set_caller(&client, "release_tranche", &admin, (99_u32,));
    client.release_tranche(&99);
    set_timestamp(&env, START_TS + THIRTY_DAYS + 1);
    set_caller(&client, "reclaim_inactive", &admin, (99_u32,));
    client.reclaim_inactive(&99);
    let record = client.get_escrow(&99).unwrap();
    escrow_balance_invariant(&env, &token, &contract_id, &record);
}
