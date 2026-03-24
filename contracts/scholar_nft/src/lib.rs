#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env, String, Symbol,
};

const ADMIN_KEY: Symbol = symbol_short!("ADMIN");
const TOKEN_COUNTER_KEY: Symbol = symbol_short!("CTR");

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
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    ScholarAlreadyMinted = 4,
}

#[contract]
pub struct ScholarNft;

#[contractimpl]
impl ScholarNft {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage().instance().set(&TOKEN_COUNTER_KEY, &0_u64);
    }

    pub fn mint(env: Env, scholar: Address, program_name: String, ipfs_uri: Option<String>) -> u64 {
        let admin = Self::admin(&env);
        admin.require_auth();

        let scholar_key = DataKey::ScholarToken(scholar.clone());
        if env.storage().persistent().has(&scholar_key) {
            panic_with_error!(&env, Error::ScholarAlreadyMinted);
        }

        let next_token_id = Self::token_counter(&env).saturating_add(1);
        env.storage().instance().set(&TOKEN_COUNTER_KEY, &next_token_id);
        env.storage()
            .persistent()
            .set(&DataKey::Owner(next_token_id), &scholar);
        env.storage()
            .persistent()
            .set(&scholar_key, &next_token_id);

        let metadata = ScholarMetadata {
            scholar,
            program_name,
            completion_date: env.ledger().timestamp(),
            ipfs_uri,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Metadata(next_token_id), &metadata);

        next_token_id
    }

    pub fn get_token(env: Env, scholar: Address) -> Option<u64> {
        env.storage().persistent().get(&DataKey::ScholarToken(scholar))
    }

    pub fn get_metadata(env: Env, token_id: u64) -> Option<ScholarMetadata> {
        env.storage().persistent().get(&DataKey::Metadata(token_id))
    }

    pub fn has_credential(env: Env, scholar: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::ScholarToken(scholar))
    }

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
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }
}

#[cfg(test)]
mod test {
    extern crate std;

    use soroban_sdk::{testutils::Address as _, Address, Env, String};

    use crate::{Error, ScholarNft, ScholarNftClient};

    fn setup() -> (Env, Address, Address, Address) {
        let env = Env::default();
        let admin = Address::generate(&env);
        let scholar = Address::generate(&env);

        let contract_id = env.register(ScholarNft, ());
        env.mock_all_auths();

        let client = ScholarNftClient::new(&env, &contract_id);
        client.initialize(&admin);

        (env, contract_id, admin, scholar)
    }

    #[test]
    fn mints_and_looks_up_credential() {
        let (env, contract_id, _admin, scholar) = setup();
        let client = ScholarNftClient::new(&env, &contract_id);

        let program_name = String::from_str(&env, "Rust Foundations");
        let ipfs_uri = Some(String::from_str(&env, "ipfs://bafybeigdyrzt"));

        let token_id = client.mint(&scholar, &program_name, &ipfs_uri);
        assert_eq!(token_id, 1);
        assert_eq!(client.get_token(&scholar), Some(1));
        assert!(client.has_credential(&scholar));

        let metadata = client.get_metadata(&token_id).unwrap();
        assert_eq!(metadata.scholar, scholar);
        assert_eq!(metadata.program_name, program_name);
        assert_eq!(metadata.ipfs_uri, ipfs_uri);
    }

    #[test]
    fn rejects_duplicate_mints_for_same_scholar() {
        let (env, contract_id, _admin, scholar) = setup();
        let client = ScholarNftClient::new(&env, &contract_id);

        let program_name = String::from_str(&env, "Solidity Bootcamp");
        client.mint(&scholar, &program_name, &None);

        let duplicate = client.try_mint(&scholar, &program_name, &None);
        assert_eq!(
            duplicate.err(),
            Some(Ok(soroban_sdk::Error::from_contract_error(
                Error::ScholarAlreadyMinted as u32
            )))
        );
    }
}
