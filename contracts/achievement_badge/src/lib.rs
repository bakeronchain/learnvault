#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    Address, BytesN, Env, String, Symbol, Vec, contract, contracterror, contractimpl, contracttype,
    panic_with_error, symbol_short,
};

// ---------------------------------------------------------------------------
// Storage Constants (assuming ~6s ledger time)
// ---------------------------------------------------------------------------

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const INSTANCE_EXTEND_TO: u32 = DAY_IN_LEDGERS * 30; // 30 days
const TTL_MIN: u32 = DAY_IN_LEDGERS;
const TTL_MAX: u32 = DAY_IN_LEDGERS * 365; // 1 year

use learnvault_shared::upgrade;

pub use upgrade::ContractUpgraded;

const ADMIN_KEY: Symbol = symbol_short!("ADMIN");
const TOKEN_COUNTER_KEY: Symbol = symbol_short!("TCOUNTER");

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct BadgeMetadata {
    pub owner: Address,
    pub badge_type: String,
    pub metadata_uri: String,
    pub awarded_at: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum DataKey {
    Admin,
    Counter,
    Owner(u64),
    TokenUri(u64),
    Metadata(u64),
    // Track badge types per address to prevent duplicates
    // Key: (Address, badge_type) -> token_id
    BadgeType(Address, String),
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct MintEventData {
    pub token_id: u64,
    pub owner: Address,
    pub badge_type: String,
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
pub struct AdminChangedEventData {
    pub old_admin: Address,
    pub new_admin: Address,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AchievementBadgeError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    TokenNotFound = 4,
    TokenExists = 6,
    Soulbound = 7,
    CounterOverflow = 9,
    BadgeAlreadyAwarded = 10,
}

#[contract]
pub struct AchievementBadge;

#[contractimpl]
impl AchievementBadge {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, AchievementBadgeError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&ADMIN_KEY, &admin);
        upgrade::init(&env);
        env.storage().instance().set(&TOKEN_COUNTER_KEY, &0_u64);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Counter, &0_u64);

        env.events()
            .publish((symbol_short!("init"),), InitializedEventData { admin });

        Self::extend_instance(&env);
    }

    pub fn mint(env: Env, to: Address, badge_type: String, metadata_uri: String) -> u64 {
        let admin = Self::get_admin(&env);
        admin.require_auth();

        // Check if this badge type has already been awarded to this address
        let badge_type_key = DataKey::BadgeType(to.clone(), badge_type.clone());
        if env.storage().persistent().has(&badge_type_key) {
            panic_with_error!(&env, AchievementBadgeError::BadgeAlreadyAwarded);
        }

        let token_id = Self::next_token_id(&env);
        let owner_key = DataKey::Owner(token_id);
        if env.storage().persistent().has(&owner_key) {
            panic_with_error!(&env, AchievementBadgeError::TokenExists);
        }

        env.storage().persistent().set(&owner_key, &to);
        Self::extend_persistent(&env, &owner_key);

        env.storage()
            .persistent()
            .set(&DataKey::TokenUri(token_id), &metadata_uri.clone());
        Self::extend_persistent(&env, &DataKey::TokenUri(token_id));

        let metadata = BadgeMetadata {
            owner: to.clone(),
            badge_type: badge_type.clone(),
            metadata_uri: metadata_uri.clone(),
            awarded_at: env.ledger().timestamp(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::Metadata(token_id), &metadata);
        Self::extend_persistent(&env, &DataKey::Metadata(token_id));

        // Track that this badge type has been awarded to this address
        env.storage()
            .persistent()
            .set(&badge_type_key, &token_id);
        Self::extend_persistent(&env, &badge_type_key);

        env.events().publish(
            (symbol_short!("minted"), token_id),
            MintEventData {
                token_id,
                owner: to,
                badge_type,
            },
        );

        token_id
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
            panic_with_error!(&env, AchievementBadgeError::TokenNotFound);
        }
    }

    pub fn get_metadata(env: Env, token_id: u64) -> BadgeMetadata {
        Self::extend_instance(&env);
        let key = DataKey::Metadata(token_id);
        if let Some(metadata) = env.storage().persistent().get::<_, BadgeMetadata>(&key) {
            Self::extend_persistent(&env, &key);
            metadata
        } else {
            panic_with_error!(&env, AchievementBadgeError::TokenNotFound);
        }
    }

    pub fn token_counter(env: Env) -> u64 {
        Self::extend_instance(&env);
        env.storage()
            .instance()
            .get(&TOKEN_COUNTER_KEY)
            .unwrap_or(0_u64)
    }

    /// Get all badge token IDs for a given address
    pub fn badges_of(env: Env, address: Address) -> Vec<u64> {
        Self::extend_instance(&env);
        let count = Self::token_counter(env.clone());
        let mut badges = Vec::new(&env);
        for i in 1..=count {
            if let Some(owner) = env
                .storage()
                .persistent()
                .get::<_, Address>(&DataKey::Owner(i))
            {
                if owner == address {
                    badges.push_back(i);
                }
                Self::extend_persistent(&env, &DataKey::Owner(i));
            }
        }
        badges
    }

    /// Check if an address has been awarded a specific badge type
    pub fn has_badge(env: Env, address: Address, badge_type: String) -> bool {
        Self::extend_instance(&env);
        let key = DataKey::BadgeType(address, badge_type);
        let has_badge = env.storage().persistent().has(&key);
        if has_badge {
            Self::extend_persistent(&env, &key);
        }
        has_badge
    }

    /// Get token ID for a specific badge type awarded to an address
    pub fn get_badge_token_id(env: Env, address: Address, badge_type: String) -> Option<u64> {
        Self::extend_instance(&env);
        let key = DataKey::BadgeType(address, badge_type);
        if let Some(token_id) = env.storage().persistent().get::<_, u64>(&key) {
            Self::extend_persistent(&env, &key);
            Some(token_id)
        } else {
            None
        }
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
        panic_with_error!(&env, AchievementBadgeError::Soulbound);
    }

    pub fn owner_of(env: Env, token_id: u64) -> Address {
        Self::extend_instance(&env);
        let key = DataKey::Owner(token_id);
        if let Some(owner) = env.storage().persistent().get::<_, Address>(&key) {
            Self::extend_persistent(&env, &key);
            owner
        } else {
            panic_with_error!(&env, AchievementBadgeError::TokenNotFound);
        }
    }

    fn next_token_id(env: &Env) -> u64 {
        let mut counter = env
            .storage()
            .instance()
            .get(&TOKEN_COUNTER_KEY)
            .unwrap_or(0_u64);
        counter = counter
            .checked_add(1)
            .unwrap_or_else(|| panic_with_error!(env, AchievementBadgeError::CounterOverflow));
        env.storage().instance().set(&TOKEN_COUNTER_KEY, &counter);
        counter
    }

    fn get_admin(env: &Env) -> Address {
        Self::extend_instance(env);
        env.storage()
            .instance()
            .get::<_, Address>(&ADMIN_KEY)
            .unwrap_or_else(|| panic_with_error!(env, AchievementBadgeError::NotInitialized))
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
