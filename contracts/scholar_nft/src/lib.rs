#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error,
    symbol_short, Address, Env, String, Symbol,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const INSTANCE_EXTEND_TO: u32 = DAY_IN_LEDGERS * 30;
const PERSISTENT_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const PERSISTENT_EXTEND_TO: u32 = DAY_IN_LEDGERS * 365;

const ADMIN_KEY: Symbol = symbol_short!("ADMIN");
const TOKEN_COUNTER_KEY: Symbol = symbol_short!("TCOUNTER");

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ScholarMetadata {
    pub owner: Address,
    pub metadata_uri: String,
    pub issued_at: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum DataKey {
    Admin,
    Counter,
    Owner(u64),
    TokenUri(u64),
    Revoked(u64),
    Metadata(u64),
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct MintEventData {
    pub token_id: u64,
    pub owner: Address,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct TransferAttemptEventData {
    pub from: Address,
    pub to: Address,
    pub token_id: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct InitializedEventData {
    pub admin: Address,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct RevokedEventData {
    pub token_id: u64,
    pub reason: String,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ScholarNFTError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    TokenNotFound = 4,
    TokenRevoked = 5,
    TokenExists = 6,
    Soulbound = 7,
    AlreadyRevoked = 8,
}

#[contract]
pub struct ScholarNFT;

#[contractimpl]
impl ScholarNFT {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, ScholarNFTError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage().instance().set(&TOKEN_COUNTER_KEY, &0_u64);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Counter, &0_u64);

        env.events().publish(
            (symbol_short!("init"),),
            InitializedEventData { admin },
        );

        Self::extend_instance(&env);
    }

    pub fn mint(env: Env, to: Address, metadata_uri: String) -> u64 {
        let admin = Self::get_admin(&env);
        admin.require_auth();

        let token_id = Self::next_token_id(&env);
        let owner_key = DataKey::Owner(token_id);
        if env.storage().persistent().has(&owner_key) {
            panic_with_error!(&env, ScholarNFTError::TokenExists);
        }

        env.storage().persistent().set(&owner_key, &to);
        env.storage()
            .persistent()
            .set(&DataKey::TokenUri(token_id), &metadata_uri);

        let metadata = ScholarMetadata {
            owner: to.clone(),
            metadata_uri: metadata_uri.clone(),
            issued_at: env.ledger().timestamp(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::Metadata(token_id), &metadata);

        env.events().publish(
            (symbol_short!("minted"), token_id),
            MintEventData {
                token_id,
                owner: to,
            },
        );

        token_id
    }

    pub fn revoke(env: Env, admin: Address, token_id: u64, reason: String) {
        admin.require_auth();
        let stored_admin = Self::get_admin(&env);
        if admin != stored_admin {
            panic_with_error!(&env, ScholarNFTError::Unauthorized);
        }

        let owner_key = DataKey::Owner(token_id);
        if !env.storage().persistent().has(&owner_key) {
            panic_with_error!(&env, ScholarNFTError::TokenNotFound);
        }

        let revoked_key = DataKey::Revoked(token_id);
        if env.storage().persistent().has(&revoked_key) {
            panic_with_error!(&env, ScholarNFTError::AlreadyRevoked);
        }

        env.storage().persistent().set(&revoked_key, &reason);
        Self::extend_persistent(&env, &revoked_key);

        env.events().publish(
            (symbol_short!("revoked"), token_id),
            RevokedEventData { token_id, reason },
        );
    }

    pub fn token_uri(env: Env, token_id: u64) -> String {
        let key = DataKey::TokenUri(token_id);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ScholarNFTError::TokenNotFound))
    }

    pub fn get_metadata(env: Env, token_id: u64) -> ScholarMetadata {
        let key = DataKey::Metadata(token_id);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ScholarNFTError::TokenNotFound))
    }

    pub fn token_counter(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&TOKEN_COUNTER_KEY)
            .unwrap_or(0_u64)
    }

    pub fn transfer(env: Env, from: Address, to: Address, token_id: u64) {
        env.events().publish(
            (symbol_short!("xfer_att"),),
            TransferAttemptEventData { from, to, token_id },
        );
        panic_with_error!(&env, ScholarNFTError::Soulbound);
    }

    pub fn owner_of(env: Env, token_id: u64) -> Address {
        Self::extend_instance(&env);
        let revoked_key = DataKey::Revoked(token_id);
        if env.storage().persistent().has(&revoked_key) {
            Self::extend_persistent(&env, &revoked_key);
            panic_with_error!(&env, ScholarNFTError::TokenRevoked);
        }

        let key = DataKey::Owner(token_id);
        if let Some(owner) = env.storage().persistent().get::<_, Address>(&key) {
            Self::extend_persistent(&env, &key);
            owner
        } else {
            panic_with_error!(&env, ScholarNFTError::TokenNotFound);
        }
    }

    pub fn has_credential(env: Env, token_id: u64) -> bool {
        if env.storage().persistent().has(&DataKey::Revoked(token_id)) {
            return false;
        }
        env.storage().persistent().has(&DataKey::Owner(token_id))
    }

    pub fn is_revoked(env: Env, token_id: u64) -> bool {
        env.storage().persistent().has(&DataKey::Revoked(token_id))
    }

    pub fn get_revocation_reason(env: Env, token_id: u64) -> Option<String> {
        env.storage().persistent().get(&DataKey::Revoked(token_id))
    }

    fn next_token_id(env: &Env) -> u64 {
        let mut counter = env
            .storage()
            .instance()
            .get(&TOKEN_COUNTER_KEY)
            .unwrap_or(0_u64);
        counter = counter.saturating_add(1);
        env.storage().instance().set(&TOKEN_COUNTER_KEY, &counter);
        counter
    }

    fn get_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get::<_, Address>(&ADMIN_KEY)
            .unwrap_or_else(|| panic_with_error!(env, ScholarNFTError::NotInitialized))
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
}

#[cfg(test)]
mod test;