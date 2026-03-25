#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env, Symbol,
};

const ADMIN_KEY: Symbol = symbol_short!("ADMIN");

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    TokenCount,
    TokenOwner(u32),
    TokenUri(u32),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum NFTError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Soulbound = 3,
    Unauthorized = 4,
    TokenNotFound = 5,
}

#[contract]
pub struct ScholarNFT;

#[contractimpl]
impl ScholarNFT {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, NFTError::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage().instance().set(&DataKey::TokenCount, &0_u32);
    }

    pub fn admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get::<_, Address>(&ADMIN_KEY)
            .unwrap_or_else(|| panic_with_error!(&env, NFTError::NotInitialized))
    }

    pub fn token_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get::<_, u32>(&DataKey::TokenCount)
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod test;
