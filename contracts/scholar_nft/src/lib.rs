#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    Address, Env, String, contract, contracterror, contractimpl, contracttype, panic_with_error,
    symbol_short,
};
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env, String, Symbol,
};

// ---------------------------------------------------------------------------
// Storage Constants (assuming ~6s ledger time)
// ---------------------------------------------------------------------------

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const INSTANCE_EXTEND_TO: u32 = DAY_IN_LEDGERS * 30; // 30 days
const PERSISTENT_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const PERSISTENT_EXTEND_TO: u32 = DAY_IN_LEDGERS * 365; // 1 year

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum DataKey {
    Admin,
    Counter,
    Owner(u64),      // token_id -> Address
    TokenUri(u64),   // token_id -> String
    Revoked(u64),    // token_id -> String (reason)
}

// ---------------------------------------------------------------------------
// Event data types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct ScholarNFT;

#[contractimpl]
impl ScholarNFT {
    /// Initialize the contract with an admin address.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, ScholarNFTError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Counter, &0_u64);

        // Emit initialized event
        env.events().publish(
            (symbol_short!("init"),),
            InitializedEventData { admin },
        );
        
        Self::extend_instance(&env);
    }

    /// Mint a new soulbound NFT. Only callable by admin.
    pub fn mint(env: Env, to: Address, metadata_uri: String) -> u64 {
        let admin = Self::get_admin(&env);
        admin.require_auth();

        let token_id = Self::next_token_id(&env);
        let owner_key = DataKey::Owner(token_id);
        if env.storage().persistent().has(&owner_key) {
            panic_with_error!(&env, ScholarNFTError::TokenExists);
        }

        env.storage().persistent().set(&key, &to);
        env.storage().persistent().set(&DataKey::TokenUri(token_id), &uri);
        
        Self::extend_persistent(&env, &key);
        Self::extend_persistent(&env, &DataKey::TokenUri(token_id));

        // Emit minted event
        env.events().publish(
            (symbol_short!("minted"), token_id, to.clone()),
            MintEventData {
                owner: to,
                metadata_uri: uri,
            },
        );

        token_id
    }

    /// Revoke a credential. Only callable by admin.
    pub fn revoke(env: Env, admin: Address, token_id: u64, reason: String) {
        admin.require_auth();
        let stored_admin = Self::get_admin(&env);
        if admin != stored_admin {
            panic_with_error!(&env, Error::Unauthorized);
        }

        let key = DataKey::Owner(token_id);
        if !env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::TokenNotFound);
        }

        let revoked_key = DataKey::Revoked(token_id);
        if env.storage().persistent().has(&revoked_key) {
            return;
        }

        env.storage().persistent().set(&revoked_key, &reason);

        Self::extend_persistent(&env, &revoked_key);
        
        // Emit revoked event
        env.events().publish(
            (symbol_short!("revoked"), token_id),
            reason,
        );
    }

    /// Transfers are **always** rejected — Scholar NFTs are soulbound.
    pub fn transfer(env: Env, from: Address, to: Address, token_id: u64) {
        // Emit transfer attempted event before panicking
        env.events().publish(
            (symbol_short!("xfer_att"),),
            TransferAttemptEventData {
                from,
                to,
                token_id,
            },
        );
        panic_with_error!(&env, Error::Soulbound)
    }

    /// Returns the owner of the token.
    pub fn owner_of(env: Env, token_id: u64) -> Address {
        Self::extend_instance(&env);
        let revoked_key = DataKey::Revoked(token_id);
        if env.storage().persistent().has(&revoked_key) {
            Self::extend_persistent(&env, &revoked_key);
            panic_with_error!(&env, Error::TokenRevoked);
        }
 
        let key = DataKey::Owner(token_id);
        if let Some(owner) = env.storage().persistent().get::<_, Address>(&key) {
            Self::extend_persistent(&env, &key);
            owner
        } else {
            panic_with_error!(&env, ScholarNFTError::TokenNotFound);
        }
    }

    /// Returns the URI of the token.
    pub fn token_uri(env: Env, token_id: u64) -> String {
        let key = DataKey::TokenUri(token_id);
        if let Some(uri) = env.storage().persistent().get::<_, String>(&key) {
            uri
        } else {
            panic_with_error!(&env, Error::TokenNotFound);
        }
    }

    /// Returns true if the token is a valid credential (not revoked and exists).
    pub fn has_credential(env: Env, token_id: u64) -> bool {
        if env.storage().persistent().has(&DataKey::Revoked(token_id)) {
            return false;
        }

        env.storage().persistent().has(&DataKey::Owner(token_id))
    }

    /// Returns true if the token has been revoked.
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
