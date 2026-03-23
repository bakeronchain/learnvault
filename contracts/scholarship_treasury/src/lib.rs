#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address, Env,
    Symbol,
};

const ADMIN_KEY: Symbol = symbol_short!("ADMIN");
const GOV_KEY: Symbol = symbol_short!("GOV");
const USDC_KEY: Symbol = symbol_short!("USDC");
const TOTAL_KEY: Symbol = symbol_short!("TOTAL");

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Donor(Address),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidAmount = 3,
    InsufficientFunds = 4,
}

#[contract]
pub struct ScholarshipTreasury;

#[contractimpl]
impl ScholarshipTreasury {
    pub fn initialize(env: Env, admin: Address, usdc_token: Address, governance_contract: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage().instance().set(&USDC_KEY, &usdc_token);
        env.storage().instance().set(&GOV_KEY, &governance_contract);
        env.storage().instance().set(&TOTAL_KEY, &0_i128);
    }

    pub fn deposit(env: Env, donor: Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        donor.require_auth();

        let usdc = token::client(&env);
        usdc.transfer(&donor, &env.current_contract_address(), &amount);

        let donor_key = DataKey::Donor(donor);
        let current = env
            .storage()
            .persistent()
            .get::<_, i128>(&donor_key)
            .unwrap_or(0);
        env.storage().persistent().set(&donor_key, &(current + amount));

        let total = env.storage().instance().get::<_, i128>(&TOTAL_KEY).unwrap_or(0);
        env.storage().instance().set(&TOTAL_KEY, &(total + amount));
    }

    pub fn disburse(env: Env, recipient: Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let governance = Self::governance_contract(&env);
        governance.require_auth();

        let total = env.storage().instance().get::<_, i128>(&TOTAL_KEY).unwrap_or(0);
        if amount > total {
            panic_with_error!(&env, Error::InsufficientFunds);
        }

        token::client(&env).transfer(&env.current_contract_address(), &recipient, &amount);
        env.storage().instance().set(&TOTAL_KEY, &(total - amount));
    }

    pub fn get_balance(env: Env) -> i128 {
        env.storage().instance().get::<_, i128>(&TOTAL_KEY).unwrap_or(0)
    }

    pub fn get_donor_total(env: Env, donor: Address) -> i128 {
        env.storage()
            .persistent()
            .get::<_, i128>(&DataKey::Donor(donor))
            .unwrap_or(0)
    }

    fn governance_contract(env: &Env) -> Address {
        if let Some(governance) = env.storage().instance().get::<_, Address>(&GOV_KEY) {
            governance
        } else {
            panic_with_error!(env, Error::NotInitialized);
        }
    }
}

mod token {
    #[cfg(test)]
    mod test_token {
        use soroban_sdk::{symbol_short, Address, Env, Symbol};

        const TOKEN_KEY: Symbol = symbol_short!("TOK");

        pub fn contract_id(env: &Env) -> Address {
            env.storage()
                .instance()
                .get::<_, Address>(&TOKEN_KEY)
                .expect("token contract not initialized")
        }

        pub fn register(env: &Env, admin: &Address) {
            let sac = env.register_stellar_asset_contract_v2(admin.clone());
            env.storage().instance().set(&TOKEN_KEY, &sac.address());
        }

        pub fn client<'a>(env: &Env) -> soroban_sdk::token::TokenClient<'a> {
            soroban_sdk::token::TokenClient::new(env, &contract_id(env))
        }
    }

    #[cfg(not(test))]
    stellar_registry::import_asset!("usdc");

    #[cfg(test)]
    pub use test_token::*;
}

#[cfg(test)]
mod test;
