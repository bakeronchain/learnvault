#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    Address, BytesN, Env, String, Symbol, Vec, contract, contracterror, contractimpl, contracttype,
    panic_with_error, symbol_short,
};

use learnvault_shared::upgrade;

pub use upgrade::ContractUpgraded;

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const INSTANCE_EXTEND_TO: u32 = DAY_IN_LEDGERS * 30;
const TTL_MIN: u32 = DAY_IN_LEDGERS;
const TTL_MAX: u32 = DAY_IN_LEDGERS * 365;

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
    Scholars,
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

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct AdminChangedEventData {
    pub old_admin: Address,
    pub new_admin: Address,
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
        upgrade::init(&env);
        env.storage().instance().set(&TOKEN_COUNTER_KEY, &0_u64);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Counter, &0_u64);
        let scholars: Vec<Address> = Vec::new(&env);
        env.storage()
            .persistent()
            .set(&DataKey::Scholars, &scholars);
        Self::extend_persistent(&env, &DataKey::Scholars);

        env.events()
            .publish((symbol_short!("init"),), InitializedEventData { admin });

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
        Self::extend_persistent(&env, &owner_key);

        env.storage()
            .persistent()
            .set(&DataKey::TokenUri(token_id), &metadata_uri);
        Self::extend_persistent(&env, &DataKey::TokenUri(token_id));

        let metadata = ScholarMetadata {
            owner: to.clone(),
            metadata_uri: metadata_uri.clone(),
            issued_at: env.ledger().timestamp(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::Metadata(token_id), &metadata);
        Self::extend_persistent(&env, &DataKey::Metadata(token_id));

        let mut scholars: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::Scholars)
            .unwrap_or_else(|| Vec::new(&env));
        scholars.push_back(to.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Scholars, &scholars);
        Self::extend_persistent(&env, &DataKey::Scholars);

        env.events().publish(
            (symbol_short!("minted"), token_id),
            MintEventData {
                token_id,
                owner: to,
            },
        );

        token_id
    }

    pub fn revoke(env: Env, token_id: u64, reason: String) {
        let admin = Self::get_admin(&env);
        admin.require_auth();

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

    pub fn transfer_admin(env: Env, new_admin: Address) {
        let old_admin = Self::get_admin(&env);
        old_admin.require_auth();

        env.storage().instance().set(&ADMIN_KEY, &new_admin);
        env.storage().instance().set(&DataKey::Admin, &new_admin);

        env.events().publish(
            (symbol_short!("adm_chng"),),
            AdminChangedEventData {
                old_admin,
                new_admin,
            },
        );

        Self::extend_instance(&env);
    }

    pub fn token_uri(env: Env, token_id: u64) -> String {
        Self::extend_instance(&env);
        let key = DataKey::TokenUri(token_id);
        if let Some(uri) = env.storage().persistent().get::<_, String>(&key) {
            Self::extend_persistent(&env, &key);
            uri
        } else {
            panic_with_error!(&env, ScholarNFTError::TokenNotFound);
        }
    }

    pub fn get_metadata_uri(env: Env, token_id: u64) -> String {
        Self::extend_instance(&env);
        let key = DataKey::TokenUri(token_id);
        if let Some(uri) = env.storage().persistent().get::<_, String>(&key) {
            Self::extend_persistent(&env, &key);
            uri
        } else {
            panic_with_error!(&env, ScholarNFTError::TokenNotFound);
        }
    }

    pub fn get_metadata(env: Env, token_id: u64) -> ScholarMetadata {
        Self::extend_instance(&env);
        let key = DataKey::Metadata(token_id);
        if let Some(metadata) = env.storage().persistent().get::<_, ScholarMetadata>(&key) {
            Self::extend_persistent(&env, &key);
            metadata
        } else {
            panic_with_error!(&env, ScholarNFTError::TokenNotFound);
        }
    }

    pub fn token_counter(env: Env) -> u64 {
        Self::extend_instance(&env);
        env.storage()
            .instance()
            .get(&TOKEN_COUNTER_KEY)
            .unwrap_or(0_u64)
    }

    pub fn get_all_scholars(env: Env) -> Vec<Address> {
        Self::extend_instance(&env);
        let key = DataKey::Scholars;
        let scholars: Vec<Address> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(&env));
        if env.storage().persistent().has(&key) {
            Self::extend_persistent(&env, &key);
        }
        scholars
    }

    /// Replace the current contract WASM with a new uploaded hash. Admin only.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin = Self::get_admin(&env);
        admin.require_auth();
        upgrade::apply(&env, &admin, &new_wasm_hash);
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
        Self::extend_instance(&env);
        let revoked_key = DataKey::Revoked(token_id);
        if env.storage().persistent().has(&revoked_key) {
            Self::extend_persistent(&env, &revoked_key);
            return false;
        }
        let owner_key = DataKey::Owner(token_id);
        let exists = env.storage().persistent().has(&owner_key);
        if exists {
            Self::extend_persistent(&env, &owner_key);
        }
        exists
    }

    pub fn is_revoked(env: Env, token_id: u64) -> bool {
        Self::extend_instance(&env);
        let key = DataKey::Revoked(token_id);
        let revoked = env.storage().persistent().has(&key);
        if revoked {
            Self::extend_persistent(&env, &key);
        }
        revoked
    }

    pub fn get_revocation_reason(env: Env, token_id: u64) -> Option<String> {
        Self::extend_instance(&env);
        let key = DataKey::Revoked(token_id);
        if let Some(reason) = env.storage().persistent().get::<_, String>(&key) {
            Self::extend_persistent(&env, &key);
            Some(reason)
        } else {
            None
        }
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
        Self::extend_instance(env);
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
        env.storage().persistent().extend_ttl(key, TTL_MIN, TTL_MAX);
    }
}

#[cfg(test)]
mod test;
