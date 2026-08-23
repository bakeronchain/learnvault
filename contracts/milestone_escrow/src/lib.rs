#![no_std]

use soroban_sdk::{
    Address, BytesN, Env, String, Symbol, contract, contractclient, contracterror, contractevent,
    contractimpl, contracttype, panic_with_error, symbol_short,
};

use learnvault_shared::upgrade;

pub use upgrade::ContractUpgraded;

const CONFIG_KEY: Symbol = symbol_short!("CONFIG");
const ARBITRATION_KEY: Symbol = symbol_short!("ARBCFG");
/// Stored separately from `ArbitrationConfig`: a custom struct cannot be
/// nested inside an `Option<_>` field of another `#[contracttype]` struct,
/// but storage's own `get()` already returns `Option<T>` for a missing key,
/// so a dedicated key sidesteps the limitation entirely.
const PENDING_ARBITRATION_KEY: Symbol = symbol_short!("ARBPEND");

/// Default delay between queuing and executing an arbitration-contract
/// address change, matching `upgrade_timelock_vault`'s default upgrade
/// timelock. Changing which contract can force a release is exactly as
/// sensitive as changing the WASM itself, so it gets the same waiting period.
const DEFAULT_ARBITRATION_TIMELOCK: u64 = 48 * 60 * 60;

#[derive(Clone)]
#[contracttype]
pub struct Config {
    pub admin: Address,
    pub treasury: Address,
    pub inactivity_window: u64,
}

/// A queued replacement arbitration-contract address and the timestamp it
/// becomes executable.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PendingArbitrationChange {
    pub new_arbitration: Address,
    pub ready_at: u64,
}

/// Authorization path for `release_tranche_via_arbitration`. Deliberately
/// separate from `Config` so wiring up arbitration is opt-in and never
/// changes the shape of the existing admin-gated config.
#[derive(Clone)]
#[contracttype]
pub struct ArbitrationConfig {
    /// The `milestone_arbitration` contract authorized to force a release.
    /// `None` until `set_arbitration_contract` bootstraps it once.
    pub address: Option<Address>,
    pub timelock_duration: u64,
}

/// A trait-only view of `milestone_arbitration::MilestoneArbitration`'s read
/// surface, avoiding a crate dependency between the two contracts -- this
/// only needs to know the function's name and shape to build a client.
#[contractclient(name = "ArbitrationClient")]
pub trait ArbitrationInterface {
    fn get_release_outcome(env: Env, dispute_id: u64) -> Option<(u32, u32, bool)>;
}

#[derive(Clone)]
#[contracttype]
pub struct EscrowRecord {
    pub scholar: Address,
    pub total_amount: i128,
    pub released_amount: i128,
    pub total_tranches: u32,
    pub tranches_released: u32,
    pub last_activity: u64,
    pub treasury: Address,
    pub admin: Address,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Escrow(u32),
    /// Marks a dispute id as already consumed by
    /// `release_tranche_via_arbitration`, so a single arbitration outcome can
    /// never authorize more than one release.
    ArbitrationDisputeUsed(u64),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    EscrowExists = 3,
    EscrowNotFound = 4,
    InvalidAmount = 5,
    InvalidTranches = 6,
    AllTranchesReleased = 7,
    Overpayment = 8,
    InactivityNotReached = 9,
    NothingToReclaim = 10,
    ArithmeticOverflow = 11,
    ArbitrationAlreadySet = 12,
    ArbitrationNotSet = 13,
    ArbitrationChangeAlreadyQueued = 14,
    ArbitrationChangeNotFound = 15,
    ArbitrationTimelockNotExpired = 16,
    ArbitrationNotFavorable = 17,
    DisputeAlreadyConsumed = 18,
}

#[contract]
pub struct MilestoneEscrow;

#[contractevent(topics = ["released"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TrancheReleased {
    #[topic]
    pub scholar: Address,
    #[topic]
    pub proposal_id: u32,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowCreated {
    pub proposal_id: u32,
    pub scholar: Address,
    pub total_amount: i128,
    pub total_tranches: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowReclaimed {
    pub proposal_id: u32,
    pub scholar: Address,
    pub amount_reclaimed: i128,
}

#[contractevent(topics = ["arb_released"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TrancheReleasedViaArbitration {
    #[topic]
    pub scholar: Address,
    #[topic]
    pub proposal_id: u32,
    pub dispute_id: u64,
    pub amount: i128,
}

#[contractevent(topics = ["arb_set"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArbitrationContractSet {
    pub arbitration: Address,
}

#[contractevent(topics = ["arb_queue"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArbitrationChangeQueued {
    pub new_arbitration: Address,
    pub ready_at: u64,
}

#[contractevent(topics = ["arb_exec"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArbitrationChangeExecuted {
    pub old_arbitration: Option<Address>,
    pub new_arbitration: Address,
}

#[contractevent(topics = ["arb_cncl"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArbitrationChangeCancelled {
    pub cancelled_arbitration: Address,
}

#[contractimpl]
impl MilestoneEscrow {
    pub fn initialize(env: Env, admin: Address, treasury: Address, inactivity_window_seconds: u64) {
        if env.storage().instance().has(&CONFIG_KEY) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();

        let config = Config {
            admin,
            treasury,
            inactivity_window: inactivity_window_seconds,
        };
        env.storage().instance().set(&CONFIG_KEY, &config);
        upgrade::init(&env);
    }

    pub fn create_escrow(
        env: Env,
        proposal_id: u32,
        scholar: Address,
        amount: i128,
        tranches: u32,
    ) {
        let config = Self::get_config(&env);
        config.treasury.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        if tranches == 0 {
            panic_with_error!(&env, Error::InvalidTranches);
        }

        let key = DataKey::Escrow(proposal_id);
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::EscrowExists);
        }

        xlm::token_client(&env).transfer(&config.treasury, env.current_contract_address(), &amount);

        let record = EscrowRecord {
            scholar,
            total_amount: amount,
            released_amount: 0,
            total_tranches: tranches,
            tranches_released: 0,
            last_activity: env.ledger().timestamp(),
            treasury: config.treasury.clone(),
            admin: config.admin.clone(),
        };
        env.storage().persistent().set(&key, &record);

        EscrowCreated {
            proposal_id,
            scholar: record.scholar.clone(),
            total_amount: record.total_amount,
            total_tranches: record.total_tranches,
        }
        .publish(&env);
    }

    pub fn release_tranche(env: Env, proposal_id: u32) {
        let key = DataKey::Escrow(proposal_id);
        let mut record = Self::get_or_panic(&env, &key);

        record.admin.require_auth();

        if record.tranches_released >= record.total_tranches {
            panic_with_error!(&env, Error::AllTranchesReleased);
        }

        let amount = Self::next_tranche_amount(&env, &record);
        record.released_amount = Self::checked_add_i128(&env, record.released_amount, amount);
        record.tranches_released = Self::checked_add_u32(&env, record.tranches_released, 1);
        record.last_activity = env.ledger().timestamp();
        env.storage().persistent().set(&key, &record);

        xlm::token_client(&env).transfer(&env.current_contract_address(), &record.scholar, &amount);

        TrancheReleased {
            scholar: record.scholar.clone(),
            proposal_id,
            amount,
        }
        .publish(&env);
    }

    /// Release the next tranche on the authority of a resolved on-chain
    /// arbitration dispute, instead of the escrow admin's signature.
    ///
    /// Permissionless by design -- like `milestone_arbitration::resolve`, the
    /// correctness of this call rests entirely on independently-verified
    /// on-chain state (the arbitration contract's own `get_release_outcome`),
    /// never on who happens to submit the transaction. `dispute_id` can only
    /// ever authorize one release: it is marked consumed before the transfer
    /// and checked on every call.
    pub fn release_tranche_via_arbitration(env: Env, proposal_id: u32, dispute_id: u64) {
        let arbitration = Self::get_arbitration_contract(env.clone())
            .unwrap_or_else(|| panic_with_error!(&env, Error::ArbitrationNotSet));

        let used_key = DataKey::ArbitrationDisputeUsed(dispute_id);
        if env.storage().persistent().has(&used_key) {
            panic_with_error!(&env, Error::DisputeAlreadyConsumed);
        }

        let outcome = ArbitrationClient::new(&env, &arbitration).get_release_outcome(&dispute_id);
        let favorable = matches!(
            outcome,
            Some((outcome_proposal_id, _milestone_id, release))
                if outcome_proposal_id == proposal_id && release
        );
        if !favorable {
            panic_with_error!(&env, Error::ArbitrationNotFavorable);
        }

        env.storage().persistent().set(&used_key, &true);

        let key = DataKey::Escrow(proposal_id);
        let mut record = Self::get_or_panic(&env, &key);

        if record.tranches_released >= record.total_tranches {
            panic_with_error!(&env, Error::AllTranchesReleased);
        }

        let amount = Self::next_tranche_amount(&env, &record);
        record.released_amount = Self::checked_add_i128(&env, record.released_amount, amount);
        record.tranches_released = Self::checked_add_u32(&env, record.tranches_released, 1);
        record.last_activity = env.ledger().timestamp();
        env.storage().persistent().set(&key, &record);

        xlm::token_client(&env).transfer(&env.current_contract_address(), &record.scholar, &amount);

        TrancheReleasedViaArbitration {
            scholar: record.scholar.clone(),
            proposal_id,
            dispute_id,
            amount,
        }
        .publish(&env);
    }

    // -----------------------------------------------------------------------
    // Arbitration wiring (timelocked, see module-level design notes in the PR)
    // -----------------------------------------------------------------------

    /// Bootstrap the arbitration contract address. Admin-gated, but only
    /// callable once -- every change after this goes through
    /// `queue_arbitration_change` / `execute_arbitration_change` instead, so
    /// no single admin call can ever redirect an already-live escrow's
    /// arbitration authority.
    pub fn set_arbitration_contract(env: Env, arbitration: Address) {
        let admin = Self::admin(&env);
        admin.require_auth();

        let mut arb_config = Self::get_arbitration_config(&env);
        if arb_config.address.is_some() {
            panic_with_error!(&env, Error::ArbitrationAlreadySet);
        }
        arb_config.address = Some(arbitration.clone());
        env.storage().instance().set(&ARBITRATION_KEY, &arb_config);

        ArbitrationContractSet { arbitration }.publish(&env);
    }

    /// Queue a replacement arbitration-contract address. Executable no
    /// sooner than `timelock_duration` (48h by default) after this call.
    pub fn queue_arbitration_change(env: Env, new_arbitration: Address) {
        let admin = Self::admin(&env);
        admin.require_auth();

        let arb_config = Self::get_arbitration_config(&env);
        if arb_config.address.is_none() {
            panic_with_error!(&env, Error::ArbitrationNotSet);
        }
        if env.storage().instance().has(&PENDING_ARBITRATION_KEY) {
            panic_with_error!(&env, Error::ArbitrationChangeAlreadyQueued);
        }

        let ready_at = env
            .ledger()
            .timestamp()
            .checked_add(arb_config.timelock_duration)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ArithmeticOverflow));
        let pending = PendingArbitrationChange {
            new_arbitration: new_arbitration.clone(),
            ready_at,
        };
        env.storage()
            .instance()
            .set(&PENDING_ARBITRATION_KEY, &pending);

        ArbitrationChangeQueued {
            new_arbitration,
            ready_at,
        }
        .publish(&env);
    }

    /// Apply a queued arbitration-contract change once its timelock has
    /// elapsed.
    pub fn execute_arbitration_change(env: Env) {
        let admin = Self::admin(&env);
        admin.require_auth();

        let mut arb_config = Self::get_arbitration_config(&env);
        let pending: PendingArbitrationChange = env
            .storage()
            .instance()
            .get(&PENDING_ARBITRATION_KEY)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ArbitrationChangeNotFound));
        let PendingArbitrationChange {
            new_arbitration,
            ready_at,
        } = pending;

        if env.ledger().timestamp() < ready_at {
            panic_with_error!(&env, Error::ArbitrationTimelockNotExpired);
        }

        let old_arbitration = arb_config.address.clone();
        arb_config.address = Some(new_arbitration.clone());
        env.storage().instance().set(&ARBITRATION_KEY, &arb_config);
        env.storage().instance().remove(&PENDING_ARBITRATION_KEY);

        ArbitrationChangeExecuted {
            old_arbitration,
            new_arbitration,
        }
        .publish(&env);
    }

    /// Cancel a queued arbitration-contract change before it executes.
    pub fn cancel_arbitration_change(env: Env) {
        let admin = Self::admin(&env);
        admin.require_auth();

        let pending: PendingArbitrationChange = env
            .storage()
            .instance()
            .get(&PENDING_ARBITRATION_KEY)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ArbitrationChangeNotFound));

        env.storage().instance().remove(&PENDING_ARBITRATION_KEY);

        ArbitrationChangeCancelled {
            cancelled_arbitration: pending.new_arbitration,
        }
        .publish(&env);
    }

    pub fn get_arbitration_contract(env: Env) -> Option<Address> {
        Self::get_arbitration_config(&env).address
    }

    pub fn get_pending_arbitration_change(env: Env) -> Option<PendingArbitrationChange> {
        env.storage().instance().get(&PENDING_ARBITRATION_KEY)
    }

    pub fn reclaim_inactive(env: Env, proposal_id: u32) {
        let key = DataKey::Escrow(proposal_id);
        let mut record = Self::get_or_panic(&env, &key);

        record.admin.require_auth();

        let now = env.ledger().timestamp();
        let inactive_for = now.saturating_sub(record.last_activity);
        let config = Self::get_config(&env);
        if inactive_for < config.inactivity_window {
            panic_with_error!(&env, Error::InactivityNotReached);
        }

        let unspent = Self::checked_sub_i128(&env, record.total_amount, record.released_amount);
        if unspent <= 0 {
            panic_with_error!(&env, Error::NothingToReclaim);
        }

        record.released_amount = record.total_amount;
        record.last_activity = now;
        env.storage().persistent().set(&key, &record);

        xlm::token_client(&env).transfer(
            &env.current_contract_address(),
            &record.treasury,
            &unspent,
        );

        EscrowReclaimed {
            proposal_id,
            scholar: record.scholar.clone(),
            amount_reclaimed: unspent,
        }
        .publish(&env);
    }

    pub fn get_escrow(env: Env, proposal_id: u32) -> Option<EscrowRecord> {
        let key = DataKey::Escrow(proposal_id);
        env.storage().persistent().get(&key)
    }

    fn get_or_panic(env: &Env, key: &DataKey) -> EscrowRecord {
        if let Some(record) = env.storage().persistent().get::<_, EscrowRecord>(key) {
            record
        } else {
            panic_with_error!(env, Error::EscrowNotFound);
        }
    }

    fn next_tranche_amount(env: &Env, record: &EscrowRecord) -> i128 {
        let remaining = Self::checked_sub_i128(env, record.total_amount, record.released_amount);
        let next_tranche_index = Self::checked_add_u32(env, record.tranches_released, 1);
        let is_last = next_tranche_index == record.total_tranches;
        let amount = if is_last {
            remaining
        } else {
            record.total_amount / (record.total_tranches as i128)
        };

        let released_after = Self::checked_add_i128(env, record.released_amount, amount);
        if amount <= 0 || released_after > record.total_amount {
            panic_with_error!(env, Error::Overpayment);
        }
        amount
    }

    fn admin(env: &Env) -> Address {
        Self::get_config(env).admin
    }

    fn get_arbitration_config(env: &Env) -> ArbitrationConfig {
        env.storage()
            .instance()
            .get(&ARBITRATION_KEY)
            .unwrap_or(ArbitrationConfig {
                address: None,
                timelock_duration: DEFAULT_ARBITRATION_TIMELOCK,
            })
    }

    fn get_config(env: &Env) -> Config {
        env.storage()
            .instance()
            .get(&CONFIG_KEY)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    pub fn get_version(env: Env) -> String {
        String::from_str(&env, "1.0.0")
    }

    /// Replace the current contract WASM with a new uploaded hash. Admin only.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin = Self::admin(&env);
        admin.require_auth();
        upgrade::apply(&env, &admin, &new_wasm_hash);
    }

    fn checked_add_i128(env: &Env, left: i128, right: i128) -> i128 {
        left.checked_add(right)
            .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow))
    }

    fn checked_sub_i128(env: &Env, left: i128, right: i128) -> i128 {
        left.checked_sub(right)
            .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow))
    }

    fn checked_add_u32(env: &Env, left: u32, right: u32) -> u32 {
        left.checked_add(right)
            .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow))
    }
}

mod xlm {
    #[cfg(test)]
    mod test_xlm {
        use soroban_sdk::{Address, Env, Symbol, symbol_short};

        const XLM_KEY: Symbol = symbol_short!("XLM");

        pub fn contract_id(env: &Env) -> Address {
            env.storage()
                .instance()
                .get::<_, Address>(&XLM_KEY)
                .expect("XLM contract not initialized")
        }

        pub fn register(env: &Env, admin: &Address) {
            let sac = env.register_stellar_asset_contract_v2(admin.clone());
            env.storage().instance().set(&XLM_KEY, &sac.address());
        }

        pub fn token_client<'a>(env: &Env) -> soroban_sdk::token::TokenClient<'a> {
            soroban_sdk::token::TokenClient::new(env, &contract_id(env))
        }
    }

    #[cfg(not(test))]
    mod live_xlm {
        use soroban_sdk::Env;

        stellar_registry::import_asset!("xlm");

        pub fn token_client<'a>(env: &Env) -> soroban_sdk::token::TokenClient<'a> {
            xlm::token_client(env)
        }
    }

    #[cfg(not(test))]
    pub use live_xlm::*;

    #[cfg(test)]
    pub use test_xlm::*;
}

#[cfg(test)]
mod test;
