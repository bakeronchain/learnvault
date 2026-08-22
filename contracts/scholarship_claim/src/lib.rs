#![no_std]

use soroban_sdk::{
    Address, BytesN, Env, String, Symbol, contract, contracterror, contractevent, contractimpl,
    contracttype, panic_with_error, symbol_short,
};

use learnvault_shared::upgrade;

pub use upgrade::ContractUpgraded;

const CONFIG_KEY: Symbol = symbol_short!("CONFIG");

#[derive(Clone)]
#[contracttype]
pub struct Config {
    pub admin: Address,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum AwardStatus {
    Active,
    Claimed,
    Reclaimed,
}

#[derive(Clone)]
#[contracttype]
pub struct AwardRecord {
    pub sponsor: Address,
    pub recipient: Address,
    pub token: Address,
    pub amount: i128,
    pub claim_deadline_ledger: u32,
    pub status: AwardStatus,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Award(u32),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    AwardExists = 3,
    AwardNotFound = 4,
    InvalidAmount = 5,
    InvalidDeadline = 6,
    DeadlinePassed = 7,
    DeadlineNotReached = 8,
    AlreadyClaimed = 9,
    AlreadyReclaimed = 10,
    Unauthorized = 11,
    InvalidNewDeadline = 12,
    ArithmeticOverflow = 13,
}

#[contract]
pub struct ScholarshipClaim;

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AwardCreated {
    pub award_id: u32,
    pub sponsor: Address,
    pub recipient: Address,
    pub token: Address,
    pub amount: i128,
    pub claim_deadline_ledger: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AwardClaimed {
    pub award_id: u32,
    pub recipient: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AwardReclaimed {
    pub award_id: u32,
    pub sponsor: Address,
    pub amount: i128,
}

#[contractimpl]
impl ScholarshipClaim {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&CONFIG_KEY) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();

        let config = Config { admin };
        env.storage().instance().set(&CONFIG_KEY, &config);
        upgrade::init(&env);
    }

    pub fn create_award(
        env: Env,
        award_id: u32,
        sponsor: Address,
        recipient: Address,
        token: Address,
        amount: i128,
        claim_deadline_ledger: u32,
    ) {
        let _config = Self::get_config(&env);
        sponsor.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let current_ledger = env.ledger().sequence();
        if claim_deadline_ledger <= current_ledger {
            panic_with_error!(&env, Error::InvalidDeadline);
        }

        let key = DataKey::Award(award_id);
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::AwardExists);
        }

        // Transfer tokens from sponsor to contract (fully funding the award at creation)
        token_client(&env, &token).transfer(&sponsor, env.current_contract_address(), &amount);

        let record = AwardRecord {
            sponsor: sponsor.clone(),
            recipient: recipient.clone(),
            token: token.clone(),
            amount,
            claim_deadline_ledger,
            status: AwardStatus::Active,
        };
        env.storage().persistent().set(&key, &record);

        AwardCreated {
            award_id,
            sponsor,
            recipient,
            token,
            amount,
            claim_deadline_ledger,
        }
        .publish(&env);
    }

    pub fn claim(env: Env, award_id: u32) {
        let key = DataKey::Award(award_id);
        let mut record = Self::get_or_panic(&env, &key);

        record.recipient.require_auth();

        // Check status first (prevents double-payout)
        if record.status != AwardStatus::Active {
            panic_with_error!(&env, Error::AlreadyClaimed);
        }

        // Check deadline
        let current_ledger = env.ledger().sequence();
        if current_ledger > record.claim_deadline_ledger {
            panic_with_error!(&env, Error::DeadlinePassed);
        }

        // Mark as claimed before transfer (prevents reentrancy)
        record.status = AwardStatus::Claimed;
        env.storage().persistent().set(&key, &record);

        // Transfer to recipient
        token_client(&env, &record.token).transfer(
            &env.current_contract_address(),
            &record.recipient,
            &record.amount,
        );

        AwardClaimed {
            award_id,
            recipient: record.recipient,
            amount: record.amount,
        }
        .publish(&env);
    }

    pub fn reclaim(env: Env, award_id: u32) {
        let key = DataKey::Award(award_id);
        let mut record = Self::get_or_panic(&env, &key);

        record.sponsor.require_auth();

        // Check status first (prevents double-payout)
        if record.status == AwardStatus::Claimed {
            panic_with_error!(&env, Error::AlreadyClaimed);
        }
        if record.status == AwardStatus::Reclaimed {
            panic_with_error!(&env, Error::AlreadyReclaimed);
        }

        // Check deadline - sponsor must wait until after deadline
        let current_ledger = env.ledger().sequence();
        if current_ledger <= record.claim_deadline_ledger {
            panic_with_error!(&env, Error::DeadlineNotReached);
        }

        // Mark as reclaimed before transfer (prevents reentrancy)
        record.status = AwardStatus::Reclaimed;
        env.storage().persistent().set(&key, &record);

        // Transfer back to sponsor
        token_client(&env, &record.token).transfer(
            &env.current_contract_address(),
            &record.sponsor,
            &record.amount,
        );

        AwardReclaimed {
            award_id,
            sponsor: record.sponsor,
            amount: record.amount,
        }
        .publish(&env);
    }

    pub fn extend_deadline(env: Env, award_id: u32, new_deadline: u32) {
        let key = DataKey::Award(award_id);
        let mut record = Self::get_or_panic(&env, &key);

        record.sponsor.require_auth();

        // Cannot extend if already claimed or reclaimed
        if record.status != AwardStatus::Active {
            panic_with_error!(&env, Error::AlreadyClaimed);
        }

        // New deadline must be later than current deadline
        if new_deadline <= record.claim_deadline_ledger {
            panic_with_error!(&env, Error::InvalidNewDeadline);
        }

        record.claim_deadline_ledger = new_deadline;
        env.storage().persistent().set(&key, &record);
    }

    pub fn get_award(env: Env, award_id: u32) -> Option<AwardRecord> {
        let key = DataKey::Award(award_id);
        env.storage().persistent().get(&key)
    }

    fn get_or_panic(env: &Env, key: &DataKey) -> AwardRecord {
        if let Some(record) = env.storage().persistent().get::<_, AwardRecord>(key) {
            record
        } else {
            panic_with_error!(env, Error::AwardNotFound);
        }
    }

    fn admin(env: &Env) -> Address {
        Self::get_config(env).admin
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
}

mod token {
    use soroban_sdk::{Address, Env, token::TokenClient};

    pub fn token_client<'a>(env: &Env, token: &Address) -> TokenClient<'a> {
        TokenClient::new(env, token)
    }
}

use token::token_client;

#[cfg(test)]
mod test;
