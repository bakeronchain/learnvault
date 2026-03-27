#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env, String,
};

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const ADMIN_KEY: Symbol = symbol_short!("ADMIN");
const TOKEN_COUNTER_KEY: Symbol = symbol_short!("CTR");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Clone)]
#[contracttype]
pub struct ScholarMetadata {
    pub scholar: Address,
    pub program_name: String,
    pub completion_date: u64,
    pub ipfs_uri: Option<String>,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Owner(u64),
    ScholarToken(Address),
    Metadata(u64),
    TokenUri(u64),
}

// ---------------------------------------------------------------------------
// Event data types
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct MintEventData {
    pub owner: Address,
    pub metadata_uri: String,
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

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    TokenNotFound = 4,
    TokenRevoked = 5,
    TokenExists = 6,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Owner(u64),      // token_id -> Address
    Revoked(u64),    // token_id -> String (reason)
}

#[contract]
pub struct ScholarNFT;

#[contractimpl]
impl ScholarNFT {
    /// Initialize the contract with an admin address.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage()
            .instance()
            .set(&TOKEN_COUNTER_KEY, &0_u64);

        // Emit initialized event
        env.events().publish(
            (symbol_short!("init"),),
            InitializedEventData { admin },
        );
    }

    /// Mint a new soulbound NFT. Only callable by admin.
    pub fn mint(env: Env, to: Address, token_id: u64) {
        let admin = Self::get_admin(&env);
        admin.require_auth();

        let key = DataKey::Owner(token_id);
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::TokenExists);
        }

        env.storage().persistent().set(&key, &to);

        env.events().publish(
            (symbol_short!("minted"), token_id, to.clone()),
            to,
        );
    }

    /// Revoke a credential. Only callable by admin.
    pub fn revoke(env: Env, admin: Address, token_id: u64, reason: String) {
        // Admin-only guard
        admin.require_auth();
        let stored_admin = Self::get_admin(&env);
        if admin != stored_admin {
            panic_with_error!(&env, Error::Unauthorized);
        }

        // Store the raw URI for token_uri() queries
        env.storage()
            .persistent()
            .set(&DataKey::TokenUri(next_token_id), &metadata_uri);

        // Rich metadata
        let metadata = ScholarMetadata {
            scholar: to.clone(),
            program_name: metadata_uri.clone(),
            completion_date: env.ledger().timestamp(),
            ipfs_uri: Some(metadata_uri.clone()),
        };
        env.storage()
            .persistent()
            .set(&DataKey::Metadata(next_token_id), &metadata);

        // Emit mint event
        env.events().publish(
            (symbol_short!("mint"), next_token_id),
            MintEventData {
                owner: to,
                metadata_uri,
            },
        );

        next_token_id
    }
        let key = DataKey::Owner(token_id);
        if !env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::TokenNotFound);
        }

        // Mark the token as revoked in storage
        let revoked_key = DataKey::Revoked(token_id);
        if env.storage().persistent().has(&revoked_key) {
             return;
        }

        env.storage().persistent().set(&revoked_key, &reason);

        // Emit { topic: ["revoked", token_id], data: { reason } } event
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
        panic_with_error!(&env, ScholarNFTError::Soulbound)
    }
    /// Returns the owner of the token.
    /// owner_of() should return an error or special value for revoked tokens.
    pub fn owner_of(env: Env, token_id: u64) -> Address {
        if env.storage().persistent().has(&DataKey::Revoked(token_id)) {
            panic_with_error!(&env, Error::TokenRevoked);
        }

        let key = DataKey::Owner(token_id);
        if let Some(owner) = env.storage().persistent().get::<_, Address>(&key) {
            owner
        } else {
            panic_with_error!(&env, Error::TokenNotFound);
        }
    }

    /// Returns true if the token is a valid credential.
    /// has_credential() should return false for revoked tokens.
    pub fn has_credential(env: Env, token_id: u64) -> bool {
        if env.storage().persistent().has(&DataKey::Revoked(token_id)) {
            return false;
        }

        env.storage().persistent().has(&DataKey::Owner(token_id))
    }

    pub fn get_revocation_reason(env: Env, token_id: u64) -> Option<String> {
        env.storage().persistent().get(&DataKey::Revoked(token_id))
    }

    fn get_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get::<_, Address>(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }
}

#[cfg(test)]
mod test;
