#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env, String, Symbol,
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
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ScholarNFTError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    NotInitialized = 3,
    TokenNotFound = 4,
    Soulbound = 5,
    ScholarAlreadyMinted = 6,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct ScholarNFT;

#[contractimpl]
impl ScholarNFT {
    /// One-time initialisation — sets the admin and zeroes the token counter.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, ScholarNFTError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage()
            .instance()
            .set(&TOKEN_COUNTER_KEY, &0_u64);
    }

    /// Mint a soulbound Scholar NFT to `to`.
    ///
    /// Each scholar may only hold **one** credential; a second mint for the
    /// same address reverts with `ScholarAlreadyMinted`.
    pub fn mint(env: Env, to: Address, metadata_uri: String) -> u64 {
        let admin = Self::admin(&env);
        admin.require_auth();

        // Prevent duplicate mints for the same scholar
        let scholar_key = DataKey::ScholarToken(to.clone());
        if env.storage().persistent().has(&scholar_key) {
            panic_with_error!(&env, ScholarNFTError::ScholarAlreadyMinted);
        }

        let next_token_id = Self::token_counter(&env).saturating_add(1);
        env.storage()
            .instance()
            .set(&TOKEN_COUNTER_KEY, &next_token_id);

        // Owner mapping
        env.storage()
            .persistent()
            .set(&DataKey::Owner(next_token_id), &to);

        // Reverse lookup: scholar -> token id
        env.storage()
            .persistent()
            .set(&scholar_key, &next_token_id);

        // Store the raw URI for token_uri() queries
        env.storage()
            .persistent()
            .set(&DataKey::TokenUri(next_token_id), &metadata_uri);

        // Rich metadata
        let metadata = ScholarMetadata {
            scholar: to,
            program_name: metadata_uri.clone(),
            completion_date: env.ledger().timestamp(),
            ipfs_uri: Some(metadata_uri),
        };
        env.storage()
            .persistent()
            .set(&DataKey::Metadata(next_token_id), &metadata);

        next_token_id
    }

    /// Return the owner of `token_id`. Panics if the token does not exist.
    pub fn owner_of(env: Env, token_id: u64) -> Address {
        env.storage()
            .persistent()
            .get(&DataKey::Owner(token_id))
            .unwrap_or_else(|| panic_with_error!(&env, ScholarNFTError::TokenNotFound))
    }

    /// Return the metadata URI for `token_id`. Panics if the token does not exist.
    pub fn token_uri(env: Env, token_id: u64) -> String {
        env.storage()
            .persistent()
            .get(&DataKey::TokenUri(token_id))
            .unwrap_or_else(|| panic_with_error!(&env, ScholarNFTError::TokenNotFound))
    }

    /// Transfers are **always** rejected — Scholar NFTs are soulbound.
    pub fn transfer(env: Env, _from: Address, _to: Address, _token_id: u64) {
        panic_with_error!(&env, ScholarNFTError::Soulbound)
    }

    /// Look up the token ID held by `scholar`, if any.
    pub fn get_token(env: Env, scholar: Address) -> Option<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::ScholarToken(scholar))
    }

    /// Return the rich metadata struct for `token_id`, if it exists.
    pub fn get_metadata(env: Env, token_id: u64) -> Option<ScholarMetadata> {
        env.storage()
            .persistent()
            .get(&DataKey::Metadata(token_id))
    }

    /// Check whether `scholar` already holds a credential.
    pub fn has_credential(env: Env, scholar: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::ScholarToken(scholar))
    }

    // -- private helpers ----------------------------------------------------

    fn token_counter(env: &Env) -> u64 {
        env.storage()
            .instance()
            .get(&TOKEN_COUNTER_KEY)
            .unwrap_or(0_u64)
    }

    fn admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&ADMIN_KEY)
            .unwrap_or_else(|| panic_with_error!(env, ScholarNFTError::NotInitialized))
    }
}

#[cfg(test)]
mod test;
