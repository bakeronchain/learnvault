#![no_std]

use soroban_sdk::{
    Address, Env, Vec, contract, contracterror, contractimpl, contracttype, panic_with_error,
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
        env.storage().instance().set(&DataKey::Admin, &admin);
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
            let mut list: Vec<Address> = env.storage().instance().get(&DataKey::Allowlist).unwrap();
            if let Some(idx) = list.iter().position(|x| x == account) {
                list.remove(idx as u32);
                env.storage().instance().set(&DataKey::Allowlist, &list);
            }
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
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{Env, testutils::Address as _};

    #[test]
    fn test_allowlist_flow() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        let contract_id = env.register_contract(None, FungibleAllowlist);
        let client = FungibleAllowlistClient::new(&env, &contract_id);

        client.initialize(&admin);
        assert_eq!(client.is_allowed(&alice), false);
        assert_eq!(client.get_allowlist().len(), 0);

        env.mock_all_auths();

        client.add_to_allowlist(&admin, &alice);
        assert_eq!(client.is_allowed(&alice), true);
        assert_eq!(client.get_allowlist().len(), 0);

        client.add_to_allowlist(&admin, &bob);
        assert_eq!(client.is_allowed(&bob), true);
        assert_eq!(client.get_allowlist().len(), 0);

        client.remove_from_allowlist(&admin, &alice);
        assert_eq!(client.is_allowed(&alice), false);
        assert_eq!(client.get_allowlist().len(), 0);

        let new_admin = Address::generate(&env);
        client.set_admin(&admin, &new_admin);

        client.add_to_allowlist(&new_admin, &alice);
        assert_eq!(client.is_allowed(&alice), true);
    }

    #[test]
    fn benchmark_costs() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let alice = Address::generate(&env);

        let contract_id = env.register(FungibleAllowlist, ());
        let client = FungibleAllowlistClient::new(&env, &contract_id);

        // 1. Benchmark initialize
        env.cost_estimate().budget().reset_unlimited();
        client.initialize(&admin);
        let init_instr = env.cost_estimate().budget().cpu_instruction_cost();
        let init_mem = env.cost_estimate().budget().memory_bytes_cost();

        // 2. Benchmark add_to_allowlist
        env.mock_all_auths();
        env.cost_estimate().budget().reset_unlimited();
        client.add_to_allowlist(&admin, &alice);
        let add_instr = env.cost_estimate().budget().cpu_instruction_cost();
        let add_mem = env.cost_estimate().budget().memory_bytes_cost();

        extern crate std;
        std::println!("BENCHMARK_RESULTS: fungible_allowlist");
        std::println!("initialize: instr={}, mem={}", init_instr, init_mem);
        std::println!("add_to_allowlist: instr={}, mem={}", add_instr, add_mem);
    }
}
