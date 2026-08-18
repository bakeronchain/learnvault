extern crate std;

use soroban_sdk::{
    Address, Env, IntoVal, Map, Symbol, TryIntoVal, Val, Vec,
    testutils::{Address as _, Events as _, Ledger, LedgerInfo, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
};

/// Payload shape produced by `#[contractevent]` for a struct with no `#[topic]` fields.
type EventData = Map<Symbol, Val>;

use crate::{
    BPS_DENOMINATOR, EMERGENCY_PENALTY_BPS, LrnStaking, LrnStakingClient, MAX_ACTIVE_STAKES,
    MAX_LOCK_LEDGERS, MIN_LOCK_LEDGERS, StakingError,
};

const START_LEDGER: u32 = 1_000;
const MINT_AMOUNT: i128 = 10_000_000;

struct Fixture<'a> {
    env: Env,
    client: LrnStakingClient<'a>,
    contract_id: Address,
    token: TokenClient<'a>,
    staker: Address,
    treasury: Address,
    admin: Address,
}

fn set_sequence(env: &Env, sequence_number: u32) {
    env.ledger().set(LedgerInfo {
        timestamp: 1_700_000_000,
        protocol_version: 23,
        sequence_number,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 6_312_000,
    });
}

fn setup<'a>() -> Fixture<'a> {
    let env = Env::default();
    env.mock_all_auths();
    set_sequence(&env, START_LEDGER);

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let staker = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = sac.address();
    StellarAssetClient::new(&env, &token_address).mint(&staker, &MINT_AMOUNT);

    let contract_id = env.register(LrnStaking, ());
    let client = LrnStakingClient::new(&env, &contract_id);
    client.initialize(&admin, &token_address, &treasury);

    Fixture {
        token: TokenClient::new(&env, &token_address),
        env,
        client,
        contract_id,
        staker,
        treasury,
        admin,
    }
}

fn contract_error(
    error: StakingError,
) -> Option<Result<soroban_sdk::Error, soroban_sdk::InvokeError>> {
    Some(Ok(soroban_sdk::Error::from_contract_error(error as u32)))
}

// ---------------------------------------------------------------------------
// initialization
// ---------------------------------------------------------------------------

#[test]
fn initialize_stores_config() {
    let f = setup();
    let config = f.client.get_config();
    assert_eq!(config.admin, f.admin);
    assert_eq!(config.treasury, f.treasury);
    assert_eq!(config.lrn_token, f.token.address);
    assert_eq!(
        f.client.get_lock_params(),
        (MIN_LOCK_LEDGERS, MAX_LOCK_LEDGERS, EMERGENCY_PENALTY_BPS)
    );
}

#[test]
fn double_initialize_reverts() {
    let f = setup();
    let result = f
        .client
        .try_initialize(&f.admin, &f.token.address, &f.treasury);
    assert_eq!(
        result.err(),
        contract_error(StakingError::AlreadyInitialized)
    );
}

// ---------------------------------------------------------------------------
// stake
// ---------------------------------------------------------------------------

#[test]
fn stake_locks_principal_and_records_state() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000, &MAX_LOCK_LEDGERS);

    let stake = f.client.get_stake(&stake_id).unwrap();
    assert_eq!(stake.staker, f.staker);
    assert_eq!(stake.amount, 1_000);
    assert_eq!(stake.lock_start_ledger, START_LEDGER);
    assert_eq!(stake.lock_end_ledger, START_LEDGER + MAX_LOCK_LEDGERS);
    assert!(!stake.withdrawn);

    assert_eq!(f.token.balance(&f.staker), MINT_AMOUNT - 1_000);
    assert_eq!(f.token.balance(&f.contract_id), 1_000);
    assert_eq!(f.client.total_staked(&f.staker), 1_000);
    assert_eq!(f.client.get_active_stakes(&f.staker).len(), 1);
}

#[test]
fn stake_emits_staked_event() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000, &MIN_LOCK_LEDGERS);

    let expected = crate::Staked {
        stake_id,
        staker: f.staker.clone(),
        amount: 1_000,
        lock_start_ledger: START_LEDGER,
        lock_end_ledger: START_LEDGER + MIN_LOCK_LEDGERS,
    };
    assert!(was_published(&f.env, &f.contract_id, &expected));
}

#[test]
fn stake_rejects_non_positive_amount() {
    let f = setup();
    assert_eq!(
        f.client.try_stake(&f.staker, &0, &MIN_LOCK_LEDGERS).err(),
        contract_error(StakingError::InvalidAmount)
    );
    assert_eq!(
        f.client.try_stake(&f.staker, &-1, &MIN_LOCK_LEDGERS).err(),
        contract_error(StakingError::InvalidAmount)
    );
}

#[test]
fn stake_rejects_duration_outside_bounds() {
    let f = setup();
    assert_eq!(
        f.client
            .try_stake(&f.staker, &1_000, &(MIN_LOCK_LEDGERS - 1))
            .err(),
        contract_error(StakingError::InvalidLockDuration)
    );
    assert_eq!(
        f.client
            .try_stake(&f.staker, &1_000, &(MAX_LOCK_LEDGERS + 1))
            .err(),
        contract_error(StakingError::InvalidLockDuration)
    );
}

#[test]
fn stake_accepts_exact_duration_bounds() {
    let f = setup();
    f.client.stake(&f.staker, &1_000, &MIN_LOCK_LEDGERS);
    f.client.stake(&f.staker, &1_000, &MAX_LOCK_LEDGERS);
    assert_eq!(f.client.total_staked(&f.staker), 2_000);
}

#[test]
fn stake_caps_concurrent_active_stakes() {
    let f = setup();
    for _ in 0..MAX_ACTIVE_STAKES {
        f.client.stake(&f.staker, &1, &MIN_LOCK_LEDGERS);
    }
    assert_eq!(
        f.client.try_stake(&f.staker, &1, &MIN_LOCK_LEDGERS).err(),
        contract_error(StakingError::TooManyActiveStakes)
    );
}

// ---------------------------------------------------------------------------
// voting power
// ---------------------------------------------------------------------------

#[test]
fn max_duration_lock_yields_full_weight() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000, &MAX_LOCK_LEDGERS);
    assert_eq!(f.client.stake_voting_power(&stake_id), 1_000);
    assert_eq!(f.client.voting_power(&f.staker), 1_000);
}

#[test]
fn voting_power_scales_with_lock_duration() {
    let f = setup();
    let quarter = MAX_LOCK_LEDGERS / 4;
    let half = MAX_LOCK_LEDGERS / 2;

    let short = f.client.stake(&f.staker, &1_000_000, &quarter);
    let long = f.client.stake(&f.staker, &1_000_000, &half);

    assert_eq!(
        f.client.stake_voting_power(&short),
        1_000_000 * quarter as i128 / MAX_LOCK_LEDGERS as i128
    );
    assert_eq!(
        f.client.stake_voting_power(&long),
        1_000_000 * half as i128 / MAX_LOCK_LEDGERS as i128
    );
    // Twice the lock, twice the weight, for the same principal.
    assert_eq!(
        f.client.stake_voting_power(&long),
        2 * f.client.stake_voting_power(&short)
    );
}

#[test]
fn voting_power_scales_with_amount() {
    let f = setup();
    let small = f.client.stake(&f.staker, &1_000, &MAX_LOCK_LEDGERS);
    let large = f.client.stake(&f.staker, &3_000, &MAX_LOCK_LEDGERS);

    assert_eq!(
        f.client.stake_voting_power(&large),
        3 * f.client.stake_voting_power(&small)
    );
    assert_eq!(f.client.voting_power(&f.staker), 4_000);
}

#[test]
fn minimum_lock_yields_small_fraction_of_amount() {
    let f = setup();
    let amount = 1_000_000_i128;
    let stake_id = f.client.stake(&f.staker, &amount, &MIN_LOCK_LEDGERS);

    let weight = f.client.stake_voting_power(&stake_id);
    assert_eq!(
        weight,
        amount * MIN_LOCK_LEDGERS as i128 / MAX_LOCK_LEDGERS as i128
    );
    assert!(weight > 0);
    // 30 days out of 4 years is well under a tenth of the principal.
    assert!(weight * 10 < amount);
}

/// Rounding is **down**, so weight is bounded above by the staked amount for
/// every representable amount/duration pair.
#[test]
fn voting_power_never_exceeds_amount() {
    let f = setup();
    let amounts = [
        1_i128,
        2,
        7,
        999,
        1_000_000,
        i128::MAX / MAX_LOCK_LEDGERS as i128,
    ];
    let durations = [
        MIN_LOCK_LEDGERS,
        MIN_LOCK_LEDGERS + 1,
        MAX_LOCK_LEDGERS / 3,
        MAX_LOCK_LEDGERS - 1,
        MAX_LOCK_LEDGERS,
    ];

    for amount in amounts {
        for duration in durations {
            let weight = crate::LrnStaking::weight(
                &f.env,
                &crate::Stake {
                    staker: f.staker.clone(),
                    amount,
                    lock_start_ledger: START_LEDGER,
                    lock_end_ledger: START_LEDGER + duration,
                    withdrawn: false,
                },
            );
            assert!(
                weight <= amount,
                "weight {weight} exceeded amount {amount} at duration {duration}"
            );
            assert!(weight >= 0);
        }
    }
}

#[test]
fn voting_power_drops_to_zero_after_withdrawal() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000, &MAX_LOCK_LEDGERS);
    assert_eq!(f.client.voting_power(&f.staker), 1_000);

    set_sequence(&f.env, START_LEDGER + MAX_LOCK_LEDGERS);
    f.client.unstake(&stake_id);

    assert_eq!(f.client.stake_voting_power(&stake_id), 0);
    assert_eq!(f.client.voting_power(&f.staker), 0);
    assert_eq!(f.client.total_staked(&f.staker), 0);
    assert_eq!(f.client.get_active_stakes(&f.staker).len(), 0);
}

#[test]
fn voting_power_of_unknown_staker_is_zero() {
    let f = setup();
    assert_eq!(f.client.voting_power(&Address::generate(&f.env)), 0);
    assert_eq!(f.client.stake_voting_power(&42), 0);
}

// ---------------------------------------------------------------------------
// unstake
// ---------------------------------------------------------------------------

#[test]
fn unstake_before_lock_end_reverts() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000, &MIN_LOCK_LEDGERS);

    set_sequence(&f.env, START_LEDGER + MIN_LOCK_LEDGERS - 1);
    assert_eq!(
        f.client.try_unstake(&stake_id).err(),
        contract_error(StakingError::LockNotExpired)
    );
    assert_eq!(f.token.balance(&f.contract_id), 1_000);
}

#[test]
fn unstake_at_lock_end_returns_full_principal() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000, &MIN_LOCK_LEDGERS);

    set_sequence(&f.env, START_LEDGER + MIN_LOCK_LEDGERS);
    f.client.unstake(&stake_id);

    assert!(f.client.get_stake(&stake_id).unwrap().withdrawn);
    assert_eq!(f.token.balance(&f.staker), MINT_AMOUNT);
    assert_eq!(f.token.balance(&f.contract_id), 0);
}

#[test]
fn unstake_after_lock_end_succeeds() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000, &MIN_LOCK_LEDGERS);

    set_sequence(&f.env, START_LEDGER + MIN_LOCK_LEDGERS + 5_000);
    f.client.unstake(&stake_id);
    assert_eq!(f.token.balance(&f.staker), MINT_AMOUNT);
}

#[test]
fn unstake_emits_unstaked_event() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000, &MIN_LOCK_LEDGERS);
    set_sequence(&f.env, START_LEDGER + MIN_LOCK_LEDGERS);
    f.client.unstake(&stake_id);

    let expected = crate::Unstaked {
        stake_id,
        staker: f.staker.clone(),
        amount_returned: 1_000,
        penalty: 0,
        emergency: false,
    };
    assert!(was_published(&f.env, &f.contract_id, &expected));
}

#[test]
fn double_unstake_reverts() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000, &MIN_LOCK_LEDGERS);

    set_sequence(&f.env, START_LEDGER + MIN_LOCK_LEDGERS);
    f.client.unstake(&stake_id);

    assert_eq!(
        f.client.try_unstake(&stake_id).err(),
        contract_error(StakingError::AlreadyWithdrawn)
    );
    // …and the emergency path cannot drain it either.
    assert_eq!(
        f.client.try_emergency_unstake(&stake_id).err(),
        contract_error(StakingError::AlreadyWithdrawn)
    );
    assert_eq!(f.token.balance(&f.staker), MINT_AMOUNT);
    assert_eq!(f.token.balance(&f.contract_id), 0);
}

#[test]
fn unstake_unknown_stake_reverts() {
    let f = setup();
    assert_eq!(
        f.client.try_unstake(&99).err(),
        contract_error(StakingError::StakeNotFound)
    );
}

// ---------------------------------------------------------------------------
// emergency unstake
// ---------------------------------------------------------------------------

#[test]
fn emergency_unstake_applies_exact_penalty_and_balances() {
    let f = setup();
    let amount = 1_000_i128;
    let stake_id = f.client.stake(&f.staker, &amount, &MAX_LOCK_LEDGERS);

    let expected_penalty = amount * EMERGENCY_PENALTY_BPS as i128 / BPS_DENOMINATOR;
    let expected_returned = amount - expected_penalty;

    set_sequence(&f.env, START_LEDGER + 1);
    f.client.emergency_unstake(&stake_id);

    assert_eq!(expected_penalty, 200); // 20% of 1_000
    assert_eq!(f.token.balance(&f.treasury), expected_penalty);
    assert_eq!(
        f.token.balance(&f.staker),
        MINT_AMOUNT - amount + expected_returned
    );
    // Nothing is created or destroyed: the contract holds zero afterwards.
    assert_eq!(f.token.balance(&f.contract_id), 0);
    assert_eq!(expected_penalty + expected_returned, amount);

    assert!(f.client.get_stake(&stake_id).unwrap().withdrawn);
    assert_eq!(f.client.voting_power(&f.staker), 0);
}

#[test]
fn emergency_unstake_rounds_penalty_down() {
    let f = setup();
    // 1 × 2000 / 10_000 = 0.2 → penalty rounds down to 0, staker keeps the unit.
    let stake_id = f.client.stake(&f.staker, &1, &MAX_LOCK_LEDGERS);
    set_sequence(&f.env, START_LEDGER + 1);
    f.client.emergency_unstake(&stake_id);

    assert_eq!(f.token.balance(&f.treasury), 0);
    assert_eq!(f.token.balance(&f.staker), MINT_AMOUNT);
    assert_eq!(f.token.balance(&f.contract_id), 0);
}

#[test]
fn emergency_unstake_emits_unstaked_event_with_penalty() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000, &MAX_LOCK_LEDGERS);
    set_sequence(&f.env, START_LEDGER + 1);
    f.client.emergency_unstake(&stake_id);

    let expected = crate::Unstaked {
        stake_id,
        staker: f.staker.clone(),
        amount_returned: 800,
        penalty: 200,
        emergency: true,
    };
    assert!(was_published(&f.env, &f.contract_id, &expected));
}

#[test]
fn emergency_unstake_after_expiry_reverts() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000, &MIN_LOCK_LEDGERS);

    set_sequence(&f.env, START_LEDGER + MIN_LOCK_LEDGERS);
    assert_eq!(
        f.client.try_emergency_unstake(&stake_id).err(),
        contract_error(StakingError::LockAlreadyExpired)
    );
    // The free path is the correct one once matured.
    f.client.unstake(&stake_id);
    assert_eq!(f.token.balance(&f.treasury), 0);
}

#[test]
fn early_exit_is_only_possible_through_the_penalized_path() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000, &MAX_LOCK_LEDGERS);

    set_sequence(&f.env, START_LEDGER + MAX_LOCK_LEDGERS - 1);
    assert_eq!(
        f.client.try_unstake(&stake_id).err(),
        contract_error(StakingError::LockNotExpired)
    );
    f.client.emergency_unstake(&stake_id);
    assert_eq!(f.token.balance(&f.treasury), 200);
}

// ---------------------------------------------------------------------------
// extend_lock
// ---------------------------------------------------------------------------

#[test]
fn extend_lock_increases_voting_power() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000_000, &MIN_LOCK_LEDGERS);
    let before = f.client.stake_voting_power(&stake_id);

    f.client
        .extend_lock(&stake_id, &(START_LEDGER + MAX_LOCK_LEDGERS));

    let after = f.client.stake_voting_power(&stake_id);
    assert!(after > before);
    assert_eq!(after, 1_000_000);
    assert_eq!(
        f.client.get_stake(&stake_id).unwrap().lock_end_ledger,
        START_LEDGER + MAX_LOCK_LEDGERS
    );
}

#[test]
fn extend_lock_emits_event() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000, &MIN_LOCK_LEDGERS);
    let new_end = START_LEDGER + MIN_LOCK_LEDGERS * 2;
    f.client.extend_lock(&stake_id, &new_end);

    let expected = crate::LockExtended {
        stake_id,
        staker: f.staker.clone(),
        old_end_ledger: START_LEDGER + MIN_LOCK_LEDGERS,
        new_end_ledger: new_end,
    };
    assert!(was_published(&f.env, &f.contract_id, &expected));
}

#[test]
fn extend_lock_rejects_earlier_end_ledger() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000, &(MIN_LOCK_LEDGERS * 2));
    let current_end = START_LEDGER + MIN_LOCK_LEDGERS * 2;

    assert_eq!(
        f.client
            .try_extend_lock(&stake_id, &(current_end - 1))
            .err(),
        contract_error(StakingError::LockNotExtended)
    );
    // Equal is not an extension either.
    assert_eq!(
        f.client.try_extend_lock(&stake_id, &current_end).err(),
        contract_error(StakingError::LockNotExtended)
    );
    assert_eq!(
        f.client.get_stake(&stake_id).unwrap().lock_end_ledger,
        current_end
    );
}

#[test]
fn extend_lock_rejects_end_in_the_past() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000, &MIN_LOCK_LEDGERS);

    // Lock has matured; "extending" to an already-passed ledger would buy weight
    // without re-committing anything.
    set_sequence(&f.env, START_LEDGER + MIN_LOCK_LEDGERS + 100);
    assert_eq!(
        f.client
            .try_extend_lock(&stake_id, &(START_LEDGER + MIN_LOCK_LEDGERS + 50))
            .err(),
        contract_error(StakingError::LockNotExtended)
    );
}

#[test]
fn extend_lock_rejects_duration_beyond_maximum() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000, &MIN_LOCK_LEDGERS);

    assert_eq!(
        f.client
            .try_extend_lock(&stake_id, &(START_LEDGER + MAX_LOCK_LEDGERS + 1))
            .err(),
        contract_error(StakingError::InvalidLockDuration)
    );
}

#[test]
fn extend_lock_rejects_withdrawn_stake() {
    let f = setup();
    let stake_id = f.client.stake(&f.staker, &1_000, &MIN_LOCK_LEDGERS);
    set_sequence(&f.env, START_LEDGER + MIN_LOCK_LEDGERS);
    f.client.unstake(&stake_id);

    assert_eq!(
        f.client
            .try_extend_lock(&stake_id, &(START_LEDGER + MAX_LOCK_LEDGERS))
            .err(),
        contract_error(StakingError::AlreadyWithdrawn)
    );
}

// ---------------------------------------------------------------------------
// authorization
// ---------------------------------------------------------------------------

/// Registers the contract and a token without `mock_all_auths`, so every call
/// must carry an explicit authorization.
fn setup_strict_auth<'a>() -> Fixture<'a> {
    let env = Env::default();
    set_sequence(&env, START_LEDGER);

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let staker = Address::generate(&env);

    env.mock_all_auths();
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = sac.address();
    StellarAssetClient::new(&env, &token_address).mint(&staker, &MINT_AMOUNT);

    let contract_id = env.register(LrnStaking, ());
    let client = LrnStakingClient::new(&env, &contract_id);
    client.initialize(&admin, &token_address, &treasury);

    Fixture {
        token: TokenClient::new(&env, &token_address),
        env,
        client,
        contract_id,
        staker,
        treasury,
        admin,
    }
}

#[test]
fn stake_requires_staker_auth() {
    let f = setup_strict_auth();
    let attacker = Address::generate(&f.env);

    f.env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &f.contract_id,
            fn_name: "stake",
            args: (f.staker.clone(), 1_000_i128, MIN_LOCK_LEDGERS).into_val(&f.env),
            sub_invokes: &[],
        },
    }]);

    assert!(
        f.client
            .try_stake(&f.staker, &1_000, &MIN_LOCK_LEDGERS)
            .is_err()
    );
}

#[test]
fn unstake_requires_staker_auth() {
    let f = setup_strict_auth();
    let stake_id = f.client.stake(&f.staker, &1_000, &MIN_LOCK_LEDGERS);
    set_sequence(&f.env, START_LEDGER + MIN_LOCK_LEDGERS);

    let attacker = Address::generate(&f.env);
    f.env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &f.contract_id,
            fn_name: "unstake",
            args: (stake_id,).into_val(&f.env),
            sub_invokes: &[],
        },
    }]);

    assert!(f.client.try_unstake(&stake_id).is_err());
    assert!(!f.client.get_stake(&stake_id).unwrap().withdrawn);
    assert_eq!(f.token.balance(&f.contract_id), 1_000);
}

#[test]
fn emergency_unstake_requires_staker_auth() {
    let f = setup_strict_auth();
    let stake_id = f.client.stake(&f.staker, &1_000, &MIN_LOCK_LEDGERS);

    let attacker = Address::generate(&f.env);
    f.env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &f.contract_id,
            fn_name: "emergency_unstake",
            args: (stake_id,).into_val(&f.env),
            sub_invokes: &[],
        },
    }]);

    assert!(f.client.try_emergency_unstake(&stake_id).is_err());
    assert_eq!(f.token.balance(&f.treasury), 0);
}

#[test]
fn extend_lock_requires_staker_auth() {
    let f = setup_strict_auth();
    let stake_id = f.client.stake(&f.staker, &1_000, &MIN_LOCK_LEDGERS);

    let attacker = Address::generate(&f.env);
    f.env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &f.contract_id,
            fn_name: "extend_lock",
            args: (stake_id, START_LEDGER + MAX_LOCK_LEDGERS).into_val(&f.env),
            sub_invokes: &[],
        },
    }]);

    assert!(
        f.client
            .try_extend_lock(&stake_id, &(START_LEDGER + MAX_LOCK_LEDGERS))
            .is_err()
    );
    assert_eq!(
        f.client.get_stake(&stake_id).unwrap().lock_end_ledger,
        START_LEDGER + MIN_LOCK_LEDGERS
    );
}

#[test]
fn upgrade_requires_admin_auth() {
    let f = setup_strict_auth();
    let attacker = Address::generate(&f.env);
    let wasm_hash = learnvault_shared::upgrade::testutils::upload_upgrade_target(&f.env);

    f.env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &f.contract_id,
            fn_name: "upgrade",
            args: (wasm_hash.clone(),).into_val(&f.env),
            sub_invokes: &[],
        },
    }]);

    assert!(f.client.try_upgrade(&wasm_hash).is_err());
}

// ---------------------------------------------------------------------------
// multi-stake accounting
// ---------------------------------------------------------------------------

#[test]
fn withdrawing_one_stake_leaves_the_others_intact() {
    let f = setup();
    let short = f.client.stake(&f.staker, &1_000, &MIN_LOCK_LEDGERS);
    let long = f.client.stake(&f.staker, &2_000, &MAX_LOCK_LEDGERS);

    set_sequence(&f.env, START_LEDGER + MIN_LOCK_LEDGERS);
    f.client.unstake(&short);

    assert_eq!(f.client.stake_voting_power(&short), 0);
    assert_eq!(f.client.stake_voting_power(&long), 2_000);
    assert_eq!(f.client.voting_power(&f.staker), 2_000);
    assert_eq!(f.client.total_staked(&f.staker), 2_000);
    assert_eq!(f.client.get_active_stakes(&f.staker), vec_of(&f.env, long));
    assert_eq!(f.token.balance(&f.contract_id), 2_000);
}

#[test]
fn stakers_are_isolated_from_each_other() {
    let f = setup();
    let other = Address::generate(&f.env);
    StellarAssetClient::new(&f.env, &f.token.address).mint(&other, &MINT_AMOUNT);

    f.client.stake(&f.staker, &1_000, &MAX_LOCK_LEDGERS);
    f.client.stake(&other, &5_000, &MAX_LOCK_LEDGERS);

    assert_eq!(f.client.voting_power(&f.staker), 1_000);
    assert_eq!(f.client.voting_power(&other), 5_000);
}

#[test]
fn stake_slot_frees_up_after_withdrawal() {
    let f = setup();
    for _ in 0..MAX_ACTIVE_STAKES {
        f.client.stake(&f.staker, &1, &MIN_LOCK_LEDGERS);
    }
    set_sequence(&f.env, START_LEDGER + MIN_LOCK_LEDGERS);
    f.client.unstake(&0);

    // A freed slot can be reused, and ids are never recycled.
    let new_id = f.client.stake(&f.staker, &1, &MIN_LOCK_LEDGERS);
    assert_eq!(new_id, MAX_ACTIVE_STAKES as u64);
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/// True when `event` was published by `contract_id`, matching both topics and data.
///
/// `#[contractevent]` encodes a struct's non-topic fields as a `Map<Symbol, Val>`,
/// so the payloads are compared as maps — `Val` itself is not `PartialEq`.
fn was_published(env: &Env, contract_id: &Address, event: &impl soroban_sdk::Event) -> bool {
    let topics = event.topics(env);
    let data: EventData = event.data(env).into_val(env);
    env.events().all().iter().any(|(cid, t, d)| {
        if &cid != contract_id || t != topics {
            return false;
        }
        d.try_into_val(env)
            .map(|published: EventData| published == data)
            .unwrap_or(false)
    })
}

fn vec_of(env: &Env, id: u64) -> Vec<u64> {
    let mut v = Vec::new(env);
    v.push_back(id);
    v
}
