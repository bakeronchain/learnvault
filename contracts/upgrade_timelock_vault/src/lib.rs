#![no_std]

//! # Upgrade Timelock Vault
//!
//! A dedicated vault for secure contract upgrade timelocking.
//!
//! This contract provides isolated storage for upgrade proposals with timelock
//! enforcement, separating timelock logic from governance contract logic for
//! enhanced security.
//!
//! ## Features
//!
//! - Queue upgrade proposals with timelock
//! - Enforce timelock period at execution time
//! - Admin cancellation with refund capability
//! - Event emission for all operations
//!
//! ## Security Model
//!
//! The timelock vault ensures that contract upgrades undergo a mandatory
//! waiting period after governance approval, providing time for review and
//! potential cancellation. The vault isolates upgrade storage from governance
//! logic to prevent accidental or malicious modifications.
//!
//! ## Usage
//!
//! 1. Governance contract calls `queue_upgrade()` after proposal approval
//! 2. Wait for timelock period (default 48 hours)
//! 3. Governance contract calls `execute_upgrade()` to get WASM hash
//! 4. Governance contract performs the actual upgrade
//! 5. Admin can `cancel_upgrade()` during timelock period

use soroban_sdk::{
    Address, BytesN, Env, Symbol, contract, contracterror, contractevent, contractimpl,
    contracttype, panic_with_error, symbol_short,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFIG_KEY: Symbol = symbol_short!("CONFIG");

// Default timelock duration: 48 hours in seconds
const DEFAULT_TIMELOCK_DURATION: u64 = 48 * 60 * 60;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub timelock_duration: u64,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum UpgradeTimelockError {
    /// Contract has not been initialized.
    NotInitialized = 1,
    /// Caller is not the contract admin.
    Unauthorized = 2,
    /// Upgrade proposal already exists for this contract.
    UpgradeAlreadyQueued = 3,
    /// No upgrade proposal found for this contract.
    UpgradeNotFound = 4,
    /// Timelock period has not elapsed yet.
    TimelockNotExpired = 5,
    /// Contract has already been initialized.
    AlreadyInitialized = 6,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpgradeProposal {
    /// The contract address to be upgraded
    pub contract_address: Address,
    /// The new WASM hash for the upgrade
    pub new_wasm_hash: BytesN<32>,
    /// Timestamp when the upgrade was queued
    pub queued_at: u64,
    /// Admin who queued the upgrade
    pub admin: Address,
}

#[contracttype]
pub enum DataKey {
    UpgradeProposal(Address),
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent(topics = ["upgrade_queued"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpgradeQueued {
    #[topic]
    pub contract_address: Address,
    pub new_wasm_hash: BytesN<32>,
    pub queued_at: u64,
    pub admin: Address,
}

#[contractevent(topics = ["upgrade_executed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpgradeExecuted {
    #[topic]
    pub contract_address: Address,
    pub new_wasm_hash: BytesN<32>,
    pub executed_at: u64,
}

#[contractevent(topics = ["upgrade_cancelled"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpgradeCancelled {
    #[topic]
    pub contract_address: Address,
    pub new_wasm_hash: BytesN<32>,
    pub cancelled_at: u64,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct UpgradeTimelockVault;

#[contractimpl]
impl UpgradeTimelockVault {
    /// Initialize the timelock vault.
    ///
    /// Sets the admin and default timelock duration (48 hours).
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&CONFIG_KEY) {
            panic_with_error!(&env, UpgradeTimelockError::AlreadyInitialized);
        }
        let config = Config {
            admin,
            timelock_duration: DEFAULT_TIMELOCK_DURATION,
        };
        env.storage().instance().set(&CONFIG_KEY, &config);
    }

    /// Set the timelock duration. Admin only.
    pub fn set_timelock_duration(env: Env, duration_seconds: u64) {
        let mut config = Self::get_config(&env);
        config.admin.require_auth();
        config.timelock_duration = duration_seconds;
        env.storage().instance().set(&CONFIG_KEY, &config);
    }

    /// Get the current timelock duration.
    pub fn get_timelock_duration(env: Env) -> u64 {
        Self::get_config(&env).timelock_duration
    }

    /// Queue an upgrade proposal for a contract.
    ///
    /// Only the admin can queue upgrades. Stores the proposal with current timestamp.
    pub fn queue_upgrade(env: Env, contract_address: Address, new_wasm_hash: BytesN<32>) {
        let config = Self::get_config(&env);
        config.admin.require_auth();

        let key = DataKey::UpgradeProposal(contract_address.clone());
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, UpgradeTimelockError::UpgradeAlreadyQueued);
        }

        let proposal = UpgradeProposal {
            contract_address: contract_address.clone(),
            new_wasm_hash: new_wasm_hash.clone(),
            queued_at: env.ledger().timestamp(),
            admin: config.admin.clone(),
        };

        env.storage().persistent().set(&key, &proposal);

        UpgradeQueued {
            contract_address,
            new_wasm_hash,
            queued_at: proposal.queued_at,
            admin: proposal.admin,
        }
        .publish(&env);
    }

    /// Execute an upgrade proposal.
    ///
    /// Checks that the timelock has expired, then returns the WASM hash for upgrade.
    /// The caller (governance contract) is responsible for performing the actual upgrade.
    /// Removes the proposal from storage after successful execution.
    pub fn execute_upgrade(env: Env, contract_address: Address) -> BytesN<32> {
        let config = Self::get_config(&env);
        config.admin.require_auth();

        let key = DataKey::UpgradeProposal(contract_address.clone());
        let proposal: UpgradeProposal = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, UpgradeTimelockError::UpgradeNotFound));

        let current_time = env.ledger().timestamp();
        if current_time < proposal.queued_at + config.timelock_duration {
            panic_with_error!(&env, UpgradeTimelockError::TimelockNotExpired);
        }

        // Remove the proposal from storage
        env.storage().persistent().remove(&key);

        UpgradeExecuted {
            contract_address,
            new_wasm_hash: proposal.new_wasm_hash.clone(),
            executed_at: current_time,
        }
        .publish(&env);

        proposal.new_wasm_hash
    }

    /// Cancel an upgrade proposal. Admin only.
    ///
    /// Removes the queued upgrade proposal. Can be called at any time during timelock.
    pub fn cancel_upgrade(env: Env, contract_address: Address) {
        let config = Self::get_config(&env);
        config.admin.require_auth();

        let key = DataKey::UpgradeProposal(contract_address.clone());
        let proposal: UpgradeProposal = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, UpgradeTimelockError::UpgradeNotFound));

        env.storage().persistent().remove(&key);

        UpgradeCancelled {
            contract_address,
            new_wasm_hash: proposal.new_wasm_hash,
            cancelled_at: env.ledger().timestamp(),
        }
        .publish(&env);
    }

    /// Get an upgrade proposal for a contract.
    ///
    /// Returns the proposal details if one exists.
    pub fn get_upgrade_proposal(env: Env, contract_address: Address) -> Option<UpgradeProposal> {
        let key = DataKey::UpgradeProposal(contract_address);
        env.storage().persistent().get(&key)
    }

    /// Check if an upgrade is ready for execution.
    ///
    /// Returns true if the timelock has expired for the given contract.
    pub fn is_upgrade_ready(env: Env, contract_address: Address) -> bool {
        if let Some(proposal) = Self::get_upgrade_proposal(env.clone(), contract_address) {
            let config = Self::get_config(&env);
            let current_time = env.ledger().timestamp();
            current_time >= proposal.queued_at + config.timelock_duration
        } else {
            false
        }
    }

    /// Get the admin address.
    pub fn get_admin(env: Env) -> Address {
        Self::get_config(&env).admin
    }

    fn get_config(env: &Env) -> Config {
        env.storage()
            .instance()
            .get(&CONFIG_KEY)
            .unwrap_or_else(|| panic_with_error!(env, UpgradeTimelockError::NotInitialized))
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::{Address, BytesN, Env, IntoVal, contractclient};

    #[contractclient(name = "UpgradeTimelockVaultClient")]
    pub trait UpgradeTimelockVaultInterface {
        fn initialize(env: Env, admin: Address);
        fn set_timelock_duration(env: Env, duration_seconds: u64);
        fn get_timelock_duration(env: Env) -> u64;
        fn queue_upgrade(env: Env, contract_address: Address, new_wasm_hash: BytesN<32>);
        fn execute_upgrade(env: Env, contract_address: Address) -> BytesN<32>;
        fn cancel_upgrade(env: Env, contract_address: Address);
        fn get_upgrade_proposal(env: Env, contract_address: Address) -> Option<UpgradeProposal>;
        fn is_upgrade_ready(env: Env, contract_address: Address) -> bool;
        fn get_admin(env: Env) -> Address;
    }

    fn create_env() -> Env {
        Env::default()
    }

    fn create_admin(env: &Env) -> Address {
        Address::generate(env)
    }

    fn create_contract(env: &Env) -> Address {
        Address::generate(env)
    }

    fn create_wasm_hash(env: &Env) -> BytesN<32> {
        BytesN::from_array(env, &[0; 32])
    }

    #[test]
    fn test_initialize() {
        let env = create_env();
        let admin = create_admin(&env);
        let contract = UpgradeTimelockVaultClient::new(
            &env,
            &env.register_contract(None, UpgradeTimelockVault {}),
        );

        contract.initialize(&admin);

        assert_eq!(contract.get_admin(), admin);
        assert_eq!(contract.get_timelock_duration(), DEFAULT_TIMELOCK_DURATION);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #6)")]
    fn test_initialize_twice_fails() {
        let env = create_env();
        let admin = create_admin(&env);
        let contract = UpgradeTimelockVaultClient::new(
            &env,
            &env.register_contract(None, UpgradeTimelockVault {}),
        );

        contract.initialize(&admin);
        contract.initialize(&admin);
    }

    #[test]
    fn test_set_timelock_duration() {
        let env = create_env();
        let admin = create_admin(&env);
        let contract = UpgradeTimelockVaultClient::new(
            &env,
            &env.register_contract(None, UpgradeTimelockVault {}),
        );

        contract.initialize(&admin);

        let new_duration = 24 * 60 * 60; // 24 hours
        env.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &admin,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &contract.address,
                fn_name: "set_timelock_duration",
                args: (new_duration,).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        contract.set_timelock_duration(&new_duration);

        assert_eq!(contract.get_timelock_duration(), new_duration);
    }

    #[test]
    #[should_panic(expected = "Unauthorized")]
    fn test_set_timelock_duration_unauthorized() {
        let env = create_env();
        let admin = create_admin(&env);
        let unauthorized = create_admin(&env);
        let contract = UpgradeTimelockVaultClient::new(
            &env,
            &env.register_contract(None, UpgradeTimelockVault {}),
        );

        contract.initialize(&admin);

        env.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &unauthorized,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &contract.address,
                fn_name: "set_timelock_duration",
                args: (24 * 60 * 60,).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        contract.set_timelock_duration(&(24 * 60 * 60));
    }

    #[test]
    fn test_queue_upgrade() {
        let env = create_env();
        let admin = create_admin(&env);
        let contract_addr = create_contract(&env);
        let wasm_hash = create_wasm_hash(&env);
        let contract = UpgradeTimelockVaultClient::new(
            &env,
            &env.register_contract(None, UpgradeTimelockVault {}),
        );

        contract.initialize(&admin);
        env.ledger().set_timestamp(1);

        env.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &admin,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &contract.address,
                fn_name: "queue_upgrade",
                args: (contract_addr.clone(), wasm_hash.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        contract.queue_upgrade(&contract_addr, &wasm_hash);

        let proposal = contract.get_upgrade_proposal(&contract_addr).unwrap();
        assert_eq!(proposal.contract_address, contract_addr);
        assert_eq!(proposal.new_wasm_hash, wasm_hash);
        assert_eq!(proposal.admin, admin);
        assert!(proposal.queued_at > 0);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #3)")]
    fn test_queue_upgrade_twice_fails() {
        let env = create_env();
        let admin = create_admin(&env);
        let contract_addr = create_contract(&env);
        let wasm_hash = create_wasm_hash(&env);
        let contract = UpgradeTimelockVaultClient::new(
            &env,
            &env.register_contract(None, UpgradeTimelockVault {}),
        );

        contract.initialize(&admin);

        env.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &admin,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &contract.address,
                fn_name: "queue_upgrade",
                args: (contract_addr.clone(), wasm_hash.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        contract.queue_upgrade(&contract_addr, &wasm_hash);

        env.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &admin,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &contract.address,
                fn_name: "queue_upgrade",
                args: (contract_addr.clone(), wasm_hash.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        contract.queue_upgrade(&contract_addr, &wasm_hash);
    }

    #[test]
    fn test_execute_upgrade() {
        let env = create_env();
        let admin = create_admin(&env);
        let contract_addr = create_contract(&env);
        let wasm_hash = create_wasm_hash(&env);
        let contract = UpgradeTimelockVaultClient::new(
            &env,
            &env.register_contract(None, UpgradeTimelockVault {}),
        );

        contract.initialize(&admin);

        // Queue upgrade
        env.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &admin,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &contract.address,
                fn_name: "queue_upgrade",
                args: (contract_addr.clone(), wasm_hash.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        contract.queue_upgrade(&contract_addr, &wasm_hash);

        // Fast forward time past timelock
        env.ledger()
            .set_timestamp(env.ledger().timestamp() + DEFAULT_TIMELOCK_DURATION + 1);

        // Execute upgrade
        let returned_hash = contract.execute_upgrade(&contract_addr);
        assert_eq!(returned_hash, wasm_hash);

        // Proposal should be removed
        assert!(contract.get_upgrade_proposal(&contract_addr).is_none());
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #5)")]
    fn test_execute_upgrade_before_timelock() {
        let env = create_env();
        let admin = create_admin(&env);
        let contract_addr = create_contract(&env);
        let wasm_hash = create_wasm_hash(&env);
        let contract = UpgradeTimelockVaultClient::new(
            &env,
            &env.register_contract(None, UpgradeTimelockVault {}),
        );

        contract.initialize(&admin);

        // Queue upgrade
        env.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &admin,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &contract.address,
                fn_name: "queue_upgrade",
                args: (contract_addr.clone(), wasm_hash.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        contract.queue_upgrade(&contract_addr, &wasm_hash);

        // Try to execute immediately (before timelock)
        contract.execute_upgrade(&contract_addr);
    }

    #[test]
    fn test_cancel_upgrade() {
        let env = create_env();
        let admin = create_admin(&env);
        let contract_addr = create_contract(&env);
        let wasm_hash = create_wasm_hash(&env);
        let contract = UpgradeTimelockVaultClient::new(
            &env,
            &env.register_contract(None, UpgradeTimelockVault {}),
        );

        contract.initialize(&admin);

        // Queue upgrade
        env.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &admin,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &contract.address,
                fn_name: "queue_upgrade",
                args: (contract_addr.clone(), wasm_hash.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        contract.queue_upgrade(&contract_addr, &wasm_hash);

        // Cancel upgrade
        env.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &admin,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &contract.address,
                fn_name: "cancel_upgrade",
                args: (contract_addr.clone(),).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        contract.cancel_upgrade(&contract_addr);

        // Proposal should be removed
        assert!(contract.get_upgrade_proposal(&contract_addr).is_none());
    }

    #[test]
    fn test_is_upgrade_ready() {
        let env = create_env();
        let admin = create_admin(&env);
        let contract_addr = create_contract(&env);
        let wasm_hash = create_wasm_hash(&env);
        let contract = UpgradeTimelockVaultClient::new(
            &env,
            &env.register_contract(None, UpgradeTimelockVault {}),
        );

        contract.initialize(&admin);

        // No proposal yet
        assert!(!contract.is_upgrade_ready(&contract_addr));

        // Queue upgrade
        env.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &admin,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &contract.address,
                fn_name: "queue_upgrade",
                args: (contract_addr.clone(), wasm_hash.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        contract.queue_upgrade(&contract_addr, &wasm_hash);

        // Not ready yet
        assert!(!contract.is_upgrade_ready(&contract_addr));

        // Fast forward time
        env.ledger()
            .set_timestamp(env.ledger().timestamp() + DEFAULT_TIMELOCK_DURATION + 1);

        // Now ready
        assert!(contract.is_upgrade_ready(&contract_addr));
    }

    #[test]
    fn benchmark_costs() {
        let env = create_env();
        let admin = create_admin(&env);
        let contract_addr = create_contract(&env);
        let wasm_hash = create_wasm_hash(&env);
        let contract = UpgradeTimelockVaultClient::new(
            &env,
            &env.register_contract(None, UpgradeTimelockVault {}),
        );

        contract.initialize(&admin);

        // 1. Benchmark queue_upgrade
        env.cost_estimate().budget().reset_unlimited();
        env.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &admin,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &contract.address,
                fn_name: "queue_upgrade",
                args: (contract_addr.clone(), wasm_hash.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        contract.queue_upgrade(&contract_addr, &wasm_hash);
        let queue_instr = env.cost_estimate().budget().cpu_instruction_cost();
        let queue_mem = env.cost_estimate().budget().memory_bytes_cost();

        // 2. Benchmark execute_upgrade
        env.ledger()
            .set_timestamp(env.ledger().timestamp() + DEFAULT_TIMELOCK_DURATION + 1);
        env.cost_estimate().budget().reset_unlimited();
        env.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &admin,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &contract.address,
                fn_name: "execute_upgrade",
                args: (contract_addr.clone(),).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        contract.execute_upgrade(&contract_addr);
        let exec_instr = env.cost_estimate().budget().cpu_instruction_cost();
        let exec_mem = env.cost_estimate().budget().memory_bytes_cost();

        extern crate std;
        std::println!("BENCHMARK_RESULTS: upgrade_timelock_vault");
        std::println!("queue_upgrade: instr={}, mem={}", queue_instr, queue_mem);
        std::println!("execute_upgrade: instr={}, mem={}", exec_instr, exec_mem);
    }
}
