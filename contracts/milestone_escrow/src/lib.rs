#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address, Env,
    Symbol,
};

const INACTIVITY_WINDOW_SECONDS: u64 = 30 * 24 * 60 * 60;
const ADMIN_KEY: Symbol = symbol_short!("ADMIN");
const TREASURY_KEY: Symbol = symbol_short!("TREAS");

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
}

#[contract]
pub struct MilestoneEscrow;

#[contractimpl]
impl MilestoneEscrow {
    pub fn initialize(env: Env, admin: Address, treasury: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage().instance().set(&TREASURY_KEY, &treasury);
    }

    pub fn create_escrow(
        env: Env,
        proposal_id: u32,
        scholar: Address,
        amount: i128,
        tranches: u32,
    ) {
        let treasury = Self::treasury(&env);
        treasury.require_auth();

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

        xlm::token_client(&env).transfer(&treasury, &env.current_contract_address(), &amount);

        let record = EscrowRecord {
            scholar,
            total_amount: amount,
            released_amount: 0,
            total_tranches: tranches,
            tranches_released: 0,
            last_activity: env.ledger().timestamp(),
            treasury: treasury.clone(),
            admin: Self::admin(&env),
        };
        env.storage().persistent().set(&key, &record);
    }

    pub fn release_tranche(env: Env, proposal_id: u32) {
        let admin = Self::admin(&env);
        admin.require_auth();

        let key = DataKey::Escrow(proposal_id);
        let mut record = Self::get_or_panic(&env, &key);

        if record.tranches_released >= record.total_tranches {
            panic_with_error!(&env, Error::AllTranchesReleased);
        }

        let amount = Self::next_tranche_amount(&env, &record);
        xlm::token_client(&env).transfer(&env.current_contract_address(), &record.scholar, &amount);

        record.released_amount += amount;
        record.tranches_released += 1;
        record.last_activity = env.ledger().timestamp();
        env.storage().persistent().set(&key, &record);

        env.events().publish(
            (symbol_short!("released"), record.scholar, proposal_id),
            amount,
        );
    }

    pub fn reclaim_inactive(env: Env, proposal_id: u32) {
        let key = DataKey::Escrow(proposal_id);
        let mut record = Self::get_or_panic(&env, &key);

        let now = env.ledger().timestamp();
        let inactive_for = now.saturating_sub(record.last_activity);
        if inactive_for < INACTIVITY_WINDOW_SECONDS {
            panic_with_error!(&env, Error::InactivityNotReached);
        }

        let unspent = record.total_amount - record.released_amount;
        if unspent <= 0 {
            panic_with_error!(&env, Error::NothingToReclaim);
        }

        xlm::token_client(&env).transfer(&env.current_contract_address(), &record.treasury, &unspent);

        record.released_amount = record.total_amount;
        record.last_activity = now;
        env.storage().persistent().set(&key, &record);
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
        let remaining = record.total_amount - record.released_amount;
        let is_last = record.tranches_released + 1 == record.total_tranches;
        let amount = if is_last {
            remaining
        } else {
            record.total_amount / (record.total_tranches as i128)
        };

        if amount <= 0 || record.released_amount + amount > record.total_amount {
            panic_with_error!(env, Error::Overpayment);
        }
        amount
    }

    fn admin(env: &Env) -> Address {
        if let Some(admin) = env.storage().instance().get::<_, Address>(&ADMIN_KEY) {
            admin
        } else {
            panic_with_error!(env, Error::NotInitialized);
        }
    }

    fn treasury(env: &Env) -> Address {
        if let Some(treasury) = env.storage().instance().get::<_, Address>(&TREASURY_KEY) {
            treasury
        } else {
            panic_with_error!(env, Error::NotInitialized);
        }
    }
}

mod xlm {
    #[cfg(test)]
    mod test_xlm {
        use soroban_sdk::{symbol_short, Address, Env, Symbol};

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
    stellar_registry::import_asset!("xlm");

    #[cfg(test)]
    pub use test_xlm::*;
}

#[cfg(test)]
mod test;
