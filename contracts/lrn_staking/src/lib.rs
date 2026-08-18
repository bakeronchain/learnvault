#![no_std]

//! # LrnStaking
//!
//! Time-locked LRN staking with **time-weighted governance power**.
//!
//! Governance weight that tracks a spot balance rewards whoever holds the most
//! right now — including someone who acquired tokens yesterday to swing a single
//! vote. This contract ties influence to commitment instead: a staker locks LRN
//! for a duration of their choosing and receives weight proportional to
//! `amount × lock_duration / MAX_LOCK_LEDGERS`. A maximum-length lock yields the
//! full amount as weight; the minimum lock yields a small fraction of it.
//!
//! - Locks can only be **extended**, never shortened.
//! - After `lock_end_ledger` the stake is withdrawable in full through [`LrnStaking::unstake`].
//! - Before `lock_end_ledger` the only exit is [`LrnStaking::emergency_unstake`], which
//!   routes [`EMERGENCY_PENALTY_BPS`] of the principal to the treasury.
//! - A withdrawn stake contributes zero voting power and can never be withdrawn again.
//!
//! ## Token
//!
//! The staked token address is supplied at [`LrnStaking::initialize`] rather than
//! hard-coded, so the contract works against any SEP-41 token that supports
//! `transfer`. This contract is standalone: nothing here is wired into the live
//! governance tally, so `voting_power` is a read-only view until a follow-up
//! change consumes it.
//!
//! ## Relevant issue
//! Implements: https://github.com/bakeronchain/learnvault/issues/1059

use soroban_sdk::{
    Address, BytesN, Env, String, Symbol, Vec, contract, contracterror, contractevent,
    contractimpl, contracttype, panic_with_error, symbol_short, token,
};

use learnvault_shared::upgrade;

pub use upgrade::ContractUpgraded;

// ---------------------------------------------------------------------------
// Storage Constants (assuming ~6s ledger time)
// ---------------------------------------------------------------------------

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const INSTANCE_EXTEND_TO: u32 = DAY_IN_LEDGERS * 30; // 30 days
const PERSISTENT_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const PERSISTENT_EXTEND_TO: u32 = DAY_IN_LEDGERS * 365; // 1 year

// ---------------------------------------------------------------------------
// Staking Constants
// ---------------------------------------------------------------------------

/// Shortest accepted lock: 30 days. Short enough to be approachable, long
/// enough that a lock cannot be opened and closed around a single vote.
pub const MIN_LOCK_LEDGERS: u32 = DAY_IN_LEDGERS * 30;

/// Longest accepted lock: 4 years. Also the denominator of the weight formula,
/// so a four-year lock is the only way to convert LRN into weight one-for-one.
pub const MAX_LOCK_LEDGERS: u32 = DAY_IN_LEDGERS * 365 * 4;

/// Penalty applied to the principal on [`LrnStaking::emergency_unstake`], in
/// basis points (2000 bps = 20%). Routed to the treasury, never burned.
pub const EMERGENCY_PENALTY_BPS: u32 = 2_000;

/// Basis-point denominator.
pub const BPS_DENOMINATOR: i128 = 10_000;

/// Upper bound on concurrently active stakes per address. Keeps
/// [`LrnStaking::voting_power`] bounded — it iterates the caller's active
/// stakes, and an unbounded list would eventually exceed the CPU budget.
pub const MAX_ACTIVE_STAKES: u32 = 50;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum StakingError {
    /// `initialize` was already called.
    AlreadyInitialized = 1,
    /// Contract has not been initialized.
    NotInitialized = 2,
    /// Stake amount must be greater than zero.
    InvalidAmount = 3,
    /// Lock duration is outside [`MIN_LOCK_LEDGERS`]..=[`MAX_LOCK_LEDGERS`].
    InvalidLockDuration = 4,
    /// No stake exists with the supplied id.
    StakeNotFound = 5,
    /// Stake has already been withdrawn.
    AlreadyWithdrawn = 6,
    /// Lock has not reached `lock_end_ledger` yet.
    LockNotExpired = 7,
    /// Lock is already withdrawable; use `unstake` instead of the penalized path.
    LockAlreadyExpired = 8,
    /// New end ledger does not extend the lock; locks can never be shortened.
    LockNotExtended = 9,
    /// Arithmetic overflow or underflow was detected.
    ArithmeticOverflow = 10,
    /// Address already holds [`MAX_ACTIVE_STAKES`] active stakes.
    TooManyActiveStakes = 11,
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const CONFIG_KEY: Symbol = symbol_short!("CONFIG");
const NEXT_ID_KEY: Symbol = symbol_short!("NEXTID");

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Stake record by id. Kept forever, including after withdrawal, so a
    /// withdrawn stake can never be replayed.
    Stake(u64),
    /// Ids of an address's currently active (not withdrawn) stakes.
    Active(Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    /// SEP-41 token that is locked by this contract (LRN).
    pub lrn_token: Address,
    /// Recipient of emergency-unstake penalties.
    pub treasury: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Stake {
    pub staker: Address,
    pub amount: i128,
    pub lock_start_ledger: u32,
    pub lock_end_ledger: u32,
    pub withdrawn: bool,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Staked {
    pub stake_id: u64,
    pub staker: Address,
    pub amount: i128,
    pub lock_start_ledger: u32,
    pub lock_end_ledger: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Unstaked {
    pub stake_id: u64,
    pub staker: Address,
    /// Principal returned to the staker.
    pub amount_returned: i128,
    /// Amount routed to the treasury. Always zero on the non-emergency path.
    pub penalty: i128,
    /// `true` when withdrawn early through `emergency_unstake`.
    pub emergency: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LockExtended {
    pub stake_id: u64,
    pub staker: Address,
    pub old_end_ledger: u32,
    pub new_end_ledger: u32,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct LrnStaking;

#[contractimpl]
impl LrnStaking {
    /// Initialise the contract. Can only be called once.
    ///
    /// `lrn_token` is the SEP-41 token locked by this contract; `treasury`
    /// receives emergency-unstake penalties.
    pub fn initialize(env: Env, admin: Address, lrn_token: Address, treasury: Address) {
        if env.storage().instance().has(&CONFIG_KEY) {
            panic_with_error!(&env, StakingError::AlreadyInitialized);
        }
        admin.require_auth();

        let config = Config {
            admin,
            lrn_token,
            treasury,
        };
        env.storage().instance().set(&CONFIG_KEY, &config);
        env.storage().instance().set(&NEXT_ID_KEY, &0_u64);
        upgrade::init(&env);

        Self::extend_instance(&env);
    }

    // -----------------------------------------------------------------------
    // Staking
    // -----------------------------------------------------------------------

    /// Lock `amount` LRN for `lock_duration_ledgers` and return the new stake id.
    ///
    /// Transfers the principal into this contract. The duration must fall within
    /// [`MIN_LOCK_LEDGERS`]..=[`MAX_LOCK_LEDGERS`]; it is fixed at stake time and
    /// can afterwards only be pushed further out via [`Self::extend_lock`].
    pub fn stake(env: Env, staker: Address, amount: i128, lock_duration_ledgers: u32) -> u64 {
        staker.require_auth();
        Self::extend_instance(&env);
        let config = Self::config(&env);

        if amount <= 0 {
            panic_with_error!(&env, StakingError::InvalidAmount);
        }
        if !(MIN_LOCK_LEDGERS..=MAX_LOCK_LEDGERS).contains(&lock_duration_ledgers) {
            panic_with_error!(&env, StakingError::InvalidLockDuration);
        }

        let lock_start_ledger = env.ledger().sequence();
        let lock_end_ledger = lock_start_ledger
            .checked_add(lock_duration_ledgers)
            .unwrap_or_else(|| panic_with_error!(&env, StakingError::ArithmeticOverflow));

        let mut active = Self::active_ids(&env, &staker);
        if active.len() >= MAX_ACTIVE_STAKES {
            panic_with_error!(&env, StakingError::TooManyActiveStakes);
        }

        let stake_id: u64 = env.storage().instance().get(&NEXT_ID_KEY).unwrap_or(0);
        let next_id = stake_id
            .checked_add(1)
            .unwrap_or_else(|| panic_with_error!(&env, StakingError::ArithmeticOverflow));
        env.storage().instance().set(&NEXT_ID_KEY, &next_id);

        let stake = Stake {
            staker: staker.clone(),
            amount,
            lock_start_ledger,
            lock_end_ledger,
            withdrawn: false,
        };
        Self::put_stake(&env, stake_id, &stake);

        active.push_back(stake_id);
        Self::put_active_ids(&env, &staker, &active);

        Self::token(&env, &config).transfer(&staker, env.current_contract_address(), &amount);

        Staked {
            stake_id,
            staker,
            amount,
            lock_start_ledger,
            lock_end_ledger,
        }
        .publish(&env);

        stake_id
    }

    /// Withdraw a matured stake in full. Staker-authorized, and only at or after
    /// `lock_end_ledger`.
    pub fn unstake(env: Env, stake_id: u64) {
        Self::extend_instance(&env);
        let config = Self::config(&env);
        let mut stake = Self::get_or_panic(&env, stake_id);

        stake.staker.require_auth();

        if stake.withdrawn {
            panic_with_error!(&env, StakingError::AlreadyWithdrawn);
        }
        if env.ledger().sequence() < stake.lock_end_ledger {
            panic_with_error!(&env, StakingError::LockNotExpired);
        }

        let amount = stake.amount;
        stake.withdrawn = true;
        Self::put_stake(&env, stake_id, &stake);
        Self::deactivate(&env, &stake.staker, stake_id);

        Self::token(&env, &config).transfer(
            &env.current_contract_address(),
            &stake.staker,
            &amount,
        );

        Unstaked {
            stake_id,
            staker: stake.staker,
            amount_returned: amount,
            penalty: 0,
            emergency: false,
        }
        .publish(&env);
    }

    /// Withdraw a stake **before** `lock_end_ledger`, paying
    /// [`EMERGENCY_PENALTY_BPS`] of the principal to the treasury.
    ///
    /// The penalty is routed to the treasury rather than burned: LRN is earned by
    /// learners rather than bought, so destroying it removes proof of work that
    /// can never be re-minted, while the treasury recycles it into scholarships.
    /// Routing also keeps the penalty auditable on-chain as a treasury inflow.
    ///
    /// The penalty rounds **down**, so the staker is never charged more than
    /// `amount × EMERGENCY_PENALTY_BPS / 10_000`, and
    /// `amount_returned + penalty == amount` exactly.
    pub fn emergency_unstake(env: Env, stake_id: u64) {
        Self::extend_instance(&env);
        let config = Self::config(&env);
        let mut stake = Self::get_or_panic(&env, stake_id);

        stake.staker.require_auth();

        if stake.withdrawn {
            panic_with_error!(&env, StakingError::AlreadyWithdrawn);
        }
        if env.ledger().sequence() >= stake.lock_end_ledger {
            panic_with_error!(&env, StakingError::LockAlreadyExpired);
        }

        let amount = stake.amount;
        let penalty =
            Self::checked_mul(&env, amount, EMERGENCY_PENALTY_BPS as i128) / BPS_DENOMINATOR;
        let amount_returned = Self::checked_sub(&env, amount, penalty);

        stake.withdrawn = true;
        Self::put_stake(&env, stake_id, &stake);
        Self::deactivate(&env, &stake.staker, stake_id);

        let token = Self::token(&env, &config);
        if penalty > 0 {
            token.transfer(&env.current_contract_address(), &config.treasury, &penalty);
        }
        if amount_returned > 0 {
            token.transfer(
                &env.current_contract_address(),
                &stake.staker,
                &amount_returned,
            );
        }

        Unstaked {
            stake_id,
            staker: stake.staker,
            amount_returned,
            penalty,
            emergency: true,
        }
        .publish(&env);
    }

    /// Push a stake's `lock_end_ledger` further out, raising its voting power.
    ///
    /// `new_end_ledger` must be strictly later than the current end and strictly
    /// in the future, and the resulting duration measured from `lock_start_ledger`
    /// must not exceed [`MAX_LOCK_LEDGERS`]. There is no path that shortens a lock.
    pub fn extend_lock(env: Env, stake_id: u64, new_end_ledger: u32) {
        Self::extend_instance(&env);
        let mut stake = Self::get_or_panic(&env, stake_id);

        stake.staker.require_auth();

        if stake.withdrawn {
            panic_with_error!(&env, StakingError::AlreadyWithdrawn);
        }
        // Strictly later than today's end, and strictly in the future — otherwise
        // an expired lock could buy weight without re-committing anything.
        if new_end_ledger <= stake.lock_end_ledger || new_end_ledger <= env.ledger().sequence() {
            panic_with_error!(&env, StakingError::LockNotExtended);
        }

        let new_duration = new_end_ledger
            .checked_sub(stake.lock_start_ledger)
            .unwrap_or_else(|| panic_with_error!(&env, StakingError::ArithmeticOverflow));
        if new_duration > MAX_LOCK_LEDGERS {
            panic_with_error!(&env, StakingError::InvalidLockDuration);
        }

        let old_end_ledger = stake.lock_end_ledger;
        stake.lock_end_ledger = new_end_ledger;
        Self::put_stake(&env, stake_id, &stake);

        LockExtended {
            stake_id,
            staker: stake.staker,
            old_end_ledger,
            new_end_ledger,
        }
        .publish(&env);
    }

    // -----------------------------------------------------------------------
    // Read functions
    // -----------------------------------------------------------------------

    /// Total time-weighted governance power held by `staker`.
    ///
    /// Sums [`Self::stake_voting_power`] over the staker's active stakes.
    /// Withdrawn stakes contribute nothing.
    pub fn voting_power(env: Env, staker: Address) -> i128 {
        let active = Self::active_ids(&env, &staker);
        let mut total: i128 = 0;
        for stake_id in active.iter() {
            if let Some(stake) = Self::load(&env, stake_id) {
                if stake.withdrawn {
                    continue;
                }
                total = Self::checked_add(&env, total, Self::weight(&env, &stake));
            }
        }
        total
    }

    /// Governance power contributed by a single stake, or zero once withdrawn.
    ///
    /// `weight = amount × lock_duration / MAX_LOCK_LEDGERS`, multiplying before
    /// dividing and **rounding down**. Because `lock_duration <= MAX_LOCK_LEDGERS`
    /// is enforced on every write path, the result can never exceed `amount`.
    pub fn stake_voting_power(env: Env, stake_id: u64) -> i128 {
        match Self::load(&env, stake_id) {
            Some(stake) if !stake.withdrawn => Self::weight(&env, &stake),
            _ => 0,
        }
    }

    /// Total principal currently locked by `staker` across active stakes.
    pub fn total_staked(env: Env, staker: Address) -> i128 {
        let active = Self::active_ids(&env, &staker);
        let mut total: i128 = 0;
        for stake_id in active.iter() {
            if let Some(stake) = Self::load(&env, stake_id)
                && !stake.withdrawn
            {
                total = Self::checked_add(&env, total, stake.amount);
            }
        }
        total
    }

    pub fn get_stake(env: Env, stake_id: u64) -> Option<Stake> {
        Self::load(&env, stake_id)
    }

    /// Ids of `staker`'s active stakes, in the order they were opened.
    pub fn get_active_stakes(env: Env, staker: Address) -> Vec<u64> {
        Self::active_ids(&env, &staker)
    }

    pub fn get_config(env: Env) -> Config {
        Self::config(&env)
    }

    /// `(MIN_LOCK_LEDGERS, MAX_LOCK_LEDGERS, EMERGENCY_PENALTY_BPS)`.
    pub fn get_lock_params(_env: Env) -> (u32, u32, u32) {
        (MIN_LOCK_LEDGERS, MAX_LOCK_LEDGERS, EMERGENCY_PENALTY_BPS)
    }

    pub fn get_version(env: Env) -> String {
        String::from_str(&env, "1.0.0")
    }

    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    /// Replace the current contract WASM with a new uploaded hash. Admin only.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin = Self::config(&env).admin;
        admin.require_auth();
        upgrade::apply(&env, &admin, &new_wasm_hash);
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    fn weight(env: &Env, stake: &Stake) -> i128 {
        let duration = stake
            .lock_end_ledger
            .saturating_sub(stake.lock_start_ledger)
            .min(MAX_LOCK_LEDGERS);
        Self::checked_mul(env, stake.amount, duration as i128) / (MAX_LOCK_LEDGERS as i128)
    }

    fn config(env: &Env) -> Config {
        env.storage()
            .instance()
            .get(&CONFIG_KEY)
            .unwrap_or_else(|| panic_with_error!(env, StakingError::NotInitialized))
    }

    fn token<'a>(env: &Env, config: &Config) -> token::Client<'a> {
        token::Client::new(env, &config.lrn_token)
    }

    fn load(env: &Env, stake_id: u64) -> Option<Stake> {
        let key = DataKey::Stake(stake_id);
        let stake: Option<Stake> = env.storage().persistent().get(&key);
        if stake.is_some() {
            Self::extend_persistent(env, &key);
        }
        stake
    }

    fn get_or_panic(env: &Env, stake_id: u64) -> Stake {
        Self::load(env, stake_id)
            .unwrap_or_else(|| panic_with_error!(env, StakingError::StakeNotFound))
    }

    fn put_stake(env: &Env, stake_id: u64, stake: &Stake) {
        let key = DataKey::Stake(stake_id);
        env.storage().persistent().set(&key, stake);
        Self::extend_persistent(env, &key);
    }

    fn active_ids(env: &Env, staker: &Address) -> Vec<u64> {
        let key = DataKey::Active(staker.clone());
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(env))
    }

    fn put_active_ids(env: &Env, staker: &Address, ids: &Vec<u64>) {
        let key = DataKey::Active(staker.clone());
        env.storage().persistent().set(&key, ids);
        Self::extend_persistent(env, &key);
    }

    /// Drop `stake_id` from the staker's active list. The stake record itself is
    /// kept (with `withdrawn = true`) so a second withdrawal still fails loudly.
    fn deactivate(env: &Env, staker: &Address, stake_id: u64) {
        let ids = Self::active_ids(env, staker);
        if let Some(index) = ids.first_index_of(stake_id) {
            let mut remaining = ids;
            remaining.remove(index);
            Self::put_active_ids(env, staker, &remaining);
        }
    }

    fn extend_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_EXTEND_TO);
    }

    fn extend_persistent(env: &Env, key: &DataKey) {
        env.storage()
            .persistent()
            .extend_ttl(key, PERSISTENT_BUMP_THRESHOLD, PERSISTENT_EXTEND_TO);
    }

    fn checked_add(env: &Env, left: i128, right: i128) -> i128 {
        left.checked_add(right)
            .unwrap_or_else(|| panic_with_error!(env, StakingError::ArithmeticOverflow))
    }

    fn checked_sub(env: &Env, left: i128, right: i128) -> i128 {
        left.checked_sub(right)
            .unwrap_or_else(|| panic_with_error!(env, StakingError::ArithmeticOverflow))
    }

    fn checked_mul(env: &Env, left: i128, right: i128) -> i128 {
        left.checked_mul(right)
            .unwrap_or_else(|| panic_with_error!(env, StakingError::ArithmeticOverflow))
    }
}

#[cfg(test)]
mod test;
