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
    Allowlist,
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
        let empty_list: Vec<Address> = Vec::new(&env);
        env.storage()
            .instance()
            .set(&DataKey::Allowlist, &empty_list);
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
            let mut list: Vec<Address> = env.storage().instance().get(&DataKey::Allowlist).unwrap();
            list.push_back(account);
            env.storage().instance().set(&DataKey::Allowlist, &list);
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
            let list: Vec<Address> = env.storage().instance().get(&DataKey::Allowlist).unwrap();
            let mut new_list: Vec<Address> = Vec::new(&env);
            for x in list.iter() {
                if x != account {
                    new_list.push_back(x);
                }
            }
            env.storage().instance().set(&DataKey::Allowlist, &new_list);
        }
    }

    pub fn is_allowed(env: Env, account: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::IsAllowed(account))
            .unwrap_or(false)
    }

    pub fn get_allowlist(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Allowlist)
            .unwrap_or_else(|| Vec::new(&env))
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
        assert_eq!(client.get_allowlist().len(), 1);
        assert_eq!(client.get_allowlist().get(0).unwrap(), alice);

        client.add_to_allowlist(&admin, &bob);
        assert_eq!(client.is_allowed(&bob), true);
        assert_eq!(client.get_allowlist().len(), 2);

        client.remove_from_allowlist(&admin, &alice);
        assert_eq!(client.is_allowed(&alice), false);
        assert_eq!(client.get_allowlist().len(), 1);
        assert_eq!(client.get_allowlist().get(0).unwrap(), bob);

        let new_admin = Address::generate(&env);
        client.set_admin(&admin, &new_admin);

        client.add_to_allowlist(&new_admin, &alice);
        assert_eq!(client.is_allowed(&alice), true);
    }
}
