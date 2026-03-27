#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env, String,
};

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
        env.storage().instance().set(&DataKey::Admin, &admin);
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
