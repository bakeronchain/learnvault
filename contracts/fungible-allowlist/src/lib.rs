#![no_std]

use soroban_sdk::{
    Address, Env, Vec, contract, contracterror, contractimpl, contracttype, panic_with_error,
    symbol_short,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum AllowlistError {
    Unauthorized = 1,
    AlreadyInitialized = 2,
    NotInitialized = 3,
}

#[contracttype]
pub enum DataKey {
    Admin,
    IsAllowed(Address),
}

#[contract]
pub struct FungibleAllowlist;

#[contractimpl]
impl FungibleAllowlist {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, AllowlistError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.events().publish((symbol_short!("init"),), admin);
    }

    pub fn add_to_allowlist(env: Env, admin: Address, account: Address) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, AllowlistError::NotInitialized));
        if admin != stored_admin {
            panic_with_error!(&env, AllowlistError::Unauthorized);
        }

        if !Self::is_allowed(env.clone(), account.clone()) {
            env.storage()
                .persistent()
                .set(&DataKey::IsAllowed(account.clone()), &true);
            env.events().publish((symbol_short!("added"),), account.clone());
        }
    }

    pub fn remove_from_allowlist(env: Env, admin: Address, account: Address) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, AllowlistError::NotInitialized));
        if admin != stored_admin {
            panic_with_error!(&env, AllowlistError::Unauthorized);
        }

        if Self::is_allowed(env.clone(), account.clone()) {
            env.storage()
                .persistent()
                .set(&DataKey::IsAllowed(account.clone()), &false);
            env.events().publish((symbol_short!("removed"),), account.clone());
        }
    }

    pub fn is_allowed(env: Env, account: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::IsAllowed(account))
            .unwrap_or(false)
    }

    pub fn get_allowlist(env: Env) -> Vec<Address> {
        // Enumeration should be rebuilt off-chain from events or indexers.
        Vec::new(&env)
    }

    pub fn set_admin(env: Env, admin: Address, new_admin: Address) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, AllowlistError::NotInitialized));
        if admin != stored_admin {
            panic_with_error!(&env, AllowlistError::Unauthorized);
        }
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        env.events().publish((symbol_short!("new_admin"),), new_admin);
    }
}

#[cfg(test)]
mod test;
