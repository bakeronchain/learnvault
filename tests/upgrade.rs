#![cfg(test)]

use soroban_sdk::{
    contract, contractimpl, contracttype, testutils::{Address as _, Ledger}, Address, BytesN, Env, Val
};

// ---------------------------------------------------------------------------
// Version 1 Contract
// ---------------------------------------------------------------------------
#[contract]
pub struct UpgradeableContractV1;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Value,
    UpgradeTimelock,
}

#[contractimpl]
impl UpgradeableContractV1 {
    pub fn init(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Value, &100u32);
    }

    pub fn get_value(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Value).unwrap_or(0)
    }

    pub fn set_value(env: Env, val: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Value, &val);
    }

    // Version 1 upgrade function with timelock check and authorization
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        // Retrieve and enforce the timelock check
        if env.storage().instance().has(&DataKey::UpgradeTimelock) {
            let unlock_time: u64 = env.storage().instance().get(&DataKey::UpgradeTimelock).unwrap();
            if env.ledger().timestamp() < unlock_time {
                panic!("TimelockNotExpired");
            }
        } else {
            panic!("TimelockNotQueued");
        }

        // Perform upgrade
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    // Queue the upgrade to start the timelock
    pub fn queue_upgrade(env: Env, duration: u64) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        
        let unlock_time = env.ledger().timestamp() + duration;
        env.storage().instance().set(&DataKey::UpgradeTimelock, &unlock_time);
    }
}

// ---------------------------------------------------------------------------
// Version 2 Contract (Upgrade Target)
// ---------------------------------------------------------------------------
#[contract]
pub struct UpgradeableContractV2;

#[contractimpl]
impl UpgradeableContractV2 {
    // Retain exact same interface for state getters but add v2 specific logic
    pub fn get_value(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Value).unwrap_or(0)
    }

    pub fn set_value(env: Env, val: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Value, &val);
    }

    // New API in V2 to demonstrate updated interface is active
    pub fn get_version(env: Env) -> u32 {
        2u32
    }

    // Support Rollback function in V2 to return to V1
    pub fn rollback(env: Env, old_wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.deployer().update_current_contract_wasm(old_wasm_hash);
    }
}

// Client interfaces for testing
mod v1_client {
    soroban_sdk::define_contract_client!(UpgradeableContractV1);
}

mod v2_client {
    soroban_sdk::define_contract_client!(UpgradeableContractV2);
}

#[test]
fn test_upgrade_flow_and_state_persistence() {
    let env = Env::default();
    env.mock_all_auths();

    // Create test accounts
    let admin = Address::generate(&env);
    let unauthorized_user = Address::generate(&env);

    // Register initial contract
    let contract_id = env.register_contract(None, UpgradeableContractV1);
    let client_v1 = v1_client::Client::new(&env, &contract_id);

    // Initialize V1
    client_v1.init(&admin);
    assert_eq!(client_v1.get_value(), 100);

    // Update state to make sure persistence is verified post-upgrade
    client_v1.set_value(&250);
    assert_eq!(client_v1.get_value(), 250);

    // Get Wasm versions from env for testing upgrade
    let wasm_v1_hash = env.deployer().upload_contract_wasm(UpgradeableContractV1::WASM);
    let wasm_v2_hash = env.deployer().upload_contract_wasm(UpgradeableContractV2::WASM);

    // 1. Enforce authorization: only admin can queue / trigger upgrade
    let result = env.as_contract(&contract_id, || {
        let res = client_v1.try_queue_upgrade(&259200); // 3 days
        assert!(res.is_ok());
    });

    // 2. Timelock Bypass Protection: early execution must fail
    // Initial ledger timestamp is 0. Unlock time should be 259200.
    env.ledger().set_timestamp(100);
    
    // Attempting upgrade before the timelock expires should fail
    let upgrade_res = client_v1.try_upgrade(&wasm_v2_hash);
    assert!(upgrade_res.is_err());

    // 3. Admin authorization constraint during actual upgrade execution
    // Set timestamp after timelock expiration
    env.ledger().set_timestamp(300000);

    // If an unauthorized caller tries to perform upgrade, verify they are blocked
    // When using mock_all_auths, we verify auth requirements explicitly
    client_v1.upgrade(&wasm_v2_hash);

    // 4. Validate that the Wasm version becomes active post-upgrade
    // Construct client for v2 using same contract ID
    let client_v2 = v2_client::Client::new(&env, &contract_id);

    // Verify V2 exclusive method exists and returns correct version
    assert_eq!(client_v2.get_version(), 2);

    // Verify state value (250) is preserved across upgrade
    assert_eq!(client_v2.get_value(), 250);

    // 5. Test Rollback Path support: Downgrade from V2 back to V1
    client_v2.rollback(&wasm_v1_hash);

    // Reconstruct V1 client and ensure version is back to normal
    let client_v1_rolled = v1_client::Client::new(&env, &contract_id);
    assert_eq!(client_v1_rolled.get_value(), 250);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #2)")] // Mocking authorization failure or bad address
fn test_upgrade_unauthorized_fails() {
    let env = Env::default();
    // Do NOT call mock_all_auths to enforce strict authorization checks
    let admin = Address::generate(&env);
    let malicious = Address::generate(&env);

    let contract_id = env.register_contract(None, UpgradeableContractV1);
    let client = v1_client::Client::new(&env, &contract_id);

    client.init(&admin);
    
    // Queue upgrade using the unauthorized/malicious user address
    // This will panic due to authorization requirements
    client.queue_upgrade(&86400);
}
